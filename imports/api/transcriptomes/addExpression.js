import { Meteor } from 'meteor/meteor';
import { ValidatedMethod } from 'meteor/mdg:validated-method';
import { Roles } from 'meteor/alanning:roles';

import SimpleSchema from 'simpl-schema';
import Papa from 'papaparse';
import fs from 'fs';

import { Genes } from '/imports/api/genes/geneCollection.js';
import {
  ExperimentInfo, Transcriptomes,
} from '/imports/api/transcriptomes/transcriptome_collection.js';
import logger from '/imports/api/util/logger.js';

const getGenomeId = (data) => {
  const firstTranscripts = data.slice(0, 10).map((line) => line.gene);
  logger.debug(firstTranscripts);
  const gene = Genes.findOne({
    $or: [
      { ID: { $in: firstTranscripts } },
      { 'subfeatures.ID': { $in: firstTranscripts } },
    ],
  });
  if (typeof gene === "undefined"){
    return undefined
  }
  logger.debug(gene.genomeId);
  return gene.genomeId
};

const parseExpressionTsv = ({
  fileName, description, replicas = [], replicaNames = [], permission = 'admin', isPublic = false,
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
              let split = replica.split(",")
              let replicaName = replicaNumber + 1
              if (replicaNames.length >= replicaNumber + 1){
                  replicaName = replicaNames[replicaNumber]
              } else if (replicaGroups.length > split[0]) {
                  replicaName = replicaGroups[replicaName]
              }
              split.forEach((column, i) => {
                  replicaNamesDict[column] = replicaName
              });

          });
      }

      let firstColumn = replicaGroups.shift();
      const genomeId = getGenomeId(data);

      if (typeof genomeId === 'undefined') {
        reject(new Meteor.Error('Could not find genomeId for first transcript'));
      }

      let experiments = {}
      replicaGroups.forEach((replicaGroup, replicaIndex) => {
          const sampleName = replicaIndex + 1 in replicaNamesDict ? replicaNamesDict[replicaIndex + 1] : replicaGroup
          experiments[replicaGroup] = ExperimentInfo.insert({
            genomeId,
            sampleName,
            replicaGroup,
            description,
            permission,
            isPublic,
        });
      });

      data.forEach((row) => {
        const gene = Genes.findOne({
          $or: [
            { ID: row[firstColumn] },
            { 'subfeatures.ID': row[firstColumn] },
          ],
        });

        if (typeof gene === 'undefined') {
          logger.warn(`${target_id} not found`);
        } else {
          nInserted += 1;
          replicaGroups.forEach((replicaGroup) => {
              bulkOp.insert({
                geneId: gene.ID,
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
  name: 'addTranscriptome',
  validate: new SimpleSchema({
    fileName: String,
    description: String,
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
  }).validator(),
  applyOptions: {
    noRetry: true,
  },
  run({
    fileName, description, replicas, replicaNames
  }) {
    if (!this.userId) {
      throw new Meteor.Error('not-authorized');
    }
    if (!Roles.userIsInRole(this.userId, 'admin')) {
      throw new Meteor.Error('not-authorized');
    }
    return parseExpressionTsv({
      fileName, description, replicas, replicaNames
    })
      .catch((error) => {
        logger.warn(error);
      });
  },
});

export default addExpression;
