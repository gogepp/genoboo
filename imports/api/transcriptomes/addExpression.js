import { Meteor } from 'meteor/meteor';
import { ValidatedMethod } from 'meteor/mdg:validated-method';
import { Roles } from 'meteor/alanning:roles';

import SimpleSchema from 'simpl-schema';
import Papa from 'papaparse';
import fs from 'fs';

import { Genes } from '/imports/api/genes/geneCollection.js';
import { genomeCollection } from '/imports/api/genomes/genomeCollection';
import {
  ExperimentInfo, Transcriptomes,
} from '/imports/api/transcriptomes/transcriptome_collection.js';
import logger from '/imports/api/util/logger.js';

const getGenomeId = (data, firstColumn, genome, annot) => {

  if (genome){
    // Skip using the genes, directly get the genome itself using the name
    let genomeQuery = {
      name: genome
    }
    if (annot){
      genomeQuery["annotationTrack.name"] = annot
    }
    const foundGenome = genomeCollection.findOne(genomeQuery);
    if (typeof foundGenome === "undefined"){
      return {genomeId: undefined, annotationName: undefined}
    }
    return {genomeId: foundGenome._id, annotationName: annot}
  }

  const firstTranscripts = data.slice(0, 10).map((line) => decodeURIComponent(line[firstColumn]));
  logger.debug(firstTranscripts);

  let geneQuery = {
    $or: [
      { ID: { $in: firstTranscripts } },
      { 'subfeatures.ID': { $in: firstTranscripts } },
    ],
  }

  if (annot){
    geneQuery['annotationName'] = annot
  }

  const gene = Genes.findOne(geneQuery);

  if (typeof gene === "undefined"){
    return {genomeId: undefined, annotationName: undefined}
  }
  logger.debug(gene.genomeId);
  return {genomeId: gene.genomeId, annotationName: gene.annotationName}
};

const parseExpressionTsv = ({
  fileName, description, annot, genome, replicas = [], replicaNames = [], permission = 'admin', isPublic = false,
}) => new Promise((resolve, reject) => {
  const fileHandle = fs.readFileSync(fileName, { encoding: 'binary' });
  const bulkOp = Transcriptomes.rawCollection().initializeUnorderedBulkOp();
  Papa.parse(fileHandle, {
    delimiter: '\t',
    dynamicTyping: true,
    skipEmptyLines: true,
    comments: '#',
    header: true,
    error(error, _file) {
      reject(new Meteor.Error(error));
    },
    complete({ data, meta }, _file) {
      let nInserted = 0;
      // Remove "Gene" column, leaving samples only
      let replicaGroups = meta['fields']
      let replicaNamesDict = {}

      if (replicas.length > 0){
          replicas.forEach((replica, replicaNumber) => {
              let replicaColVal = []
              replica.split(",").forEach(part => {
                part = part.trim();
                if (part.includes(':')) {
                  const [start, end] = part.split(':').map(Number);
                  const step = start <= end ? 1 : -1;
                  for (let i = start; step > 0 ? i <= end : i >= end; i += step) {
                      replicaColVal.push(i);
                  }
                } else {
                    replicaColVal.push(Number(part));
                }
              })
              let replicaName = replicaNumber + 1
              // If there is a matching element in the replicaNames array, use it
              if (replicaNames.length >= replicaNumber + 1){
                  replicaName = replicaNames[replicaNumber]
              } else if (replicaGroups.length > replicaColVal[0]) {
              // Else, use the name of the first column of the replicagroup
                  replicaName = replicaGroups[replicaColVal[0]]
              }
              replicaColVal.forEach((column, i) => {
                  replicaNamesDict[column] = replicaName
              });
          });
          // Use the remainder of replicaNames
          if (replicas.length < replicaNames.length){
            let remainderNames = replicaNames.splice(replicaNames.length - replicas.length)
            let currentIndex = 0
            for (let i = 1; i < replicaGroups.length; i++){
              if (! (i + 1 in replicaNamesDict)){
                replicaNamesDict[i + 1] = remainderNames[currentIndex]
                currentIndex += 1
              }
              if (currentIndex + 1 > remainderNames.length ){break}
            }
          }
      } else if (replicaNames.length > 0) {
          replicaNames.forEach((replicaName, replicaNameNumber) => {
            replicaNamesDict[replicaNameNumber + 1] = replicaName
          })
      }

      let firstColumn = replicaGroups.shift();

      const {genomeId, annotationName} = getGenomeId(data, firstColumn, genome, annot);

      if (typeof genomeId === 'undefined') {
        reject(new Meteor.Error('Could not find genomeId for first transcript'));
      }

      let experiments = {}
      replicaGroups.forEach((sampleName, replicaIndex) => {
          const replicaGroup = replicaIndex + 1 in replicaNamesDict ? replicaNamesDict[replicaIndex + 1] : sampleName
          experiments[sampleName] = ExperimentInfo.insert({
            genomeId,
            annotationName,
            sampleName,
            replicaGroup,
            description,
            permission,
            isPublic,
        });
      });

      data.forEach((row) => {
        let geneQuery = {
          $or: [
            { ID: decodeURIComponent(row[firstColumn]) },
            { 'subfeatures.ID': decodeURIComponent(row[firstColumn]) },
          ],
        }

        if (annot){
          geneQuery['annotationName'] = annot
        }

        const gene = Genes.findOne(geneQuery);

        if (typeof gene === 'undefined') {
          logger.warn(`${row[firstColumn]} not found`);
        } else {
          nInserted += 1;
          replicaGroups.forEach((replicaGroup) => {
              bulkOp.insert({
                geneId: gene.ID,
                annotationName,
                tpm: row[replicaGroup],
                experimentId: experiments[replicaGroup]
              });
          })
        }
      });
      let bulkOpResult
      if (bulkOp.length > 0) {
        bulkOpResult = bulkOp.execute();
      } else {
        bulkOpResult = { ok: "", writeErrors: "", nInserted: 0 };
      }
      resolve(bulkOpResult);
    },
  });
});

const addExpression = new ValidatedMethod({
  name: 'addExpression',
  validate: new SimpleSchema({
    fileName: String,
    description: String,
    annot: {
      type: String,
      optional: true,
    },
    genome: {
      type: String,
      optional: true,
    },
    replicas: {
      type: Array,
      optional: true,
      defaultValue: []
    },
    'replicas.$': {
      type: String,
    },
    replicaNames: {
      type: Array,
      optional: true,
      defaultValue: []
    },
    'replicaNames.$': {
      type: String,
    },
    isPublic: Boolean,
  }).validator(),
  applyOptions: {
    noRetry: true,
  },
  run({
    fileName, description, annot, genome, replicas, replicaNames, isPublic
  }) {
    if (!this.userId) {
      throw new Meteor.Error('not-authorized');
    }
    if (!Roles.userIsInRole(this.userId, 'admin')) {
      throw new Meteor.Error('not-authorized');
    }
    return parseExpressionTsv({
      fileName, description, annot, genome, replicas, replicaNames, isPublic
    })
      .catch((error) => {
        logger.warn(error);
        throw new Meteor.Error(error)
      });
  },
});

export default addExpression;
