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

const parseTranscriptomeTsv = ({
  fileName, description, permission = 'admin', isPublic = false,
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
      let samples = meta['fields']
      samples.shift();

      const genomeId = getGenomeId(data);

      if (typeof genomeId === 'undefined') {
        reject(new Meteor.Error('Could not find genomeId for first transcript'));
      }

      var replicaGroup = "Replica 1"
      let experiments = {}
      samples.forEach((sampleName) =>{
          experiments[sampleName] = ExperimentInfo.insert({
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
            { ID: row.gene },
            { 'subfeatures.ID': row.gene },
          ],
        });

        if (typeof gene === 'undefined') {
          logger.warn(`${target_id} not found`);
        } else {
          nInserted += 1;
          samples.forEach((sampleName) => {
              bulkOp.insert({
                geneId: gene.ID,
                est_counts: row[sampleName],
                tpm: row[sampleName],
                experimentId: experiments[sampleName]
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

const addTranscriptome = new ValidatedMethod({
  name: 'addTranscriptome',
  validate: new SimpleSchema({
    fileName: String,
    description: String,
  }).validator(),
  applyOptions: {
    noRetry: true,
  },
  run({
    fileName, description,
  }) {
    if (!this.userId) {
      throw new Meteor.Error('not-authorized');
    }
    if (!Roles.userIsInRole(this.userId, 'admin')) {
      throw new Meteor.Error('not-authorized');
    }
    return parseTranscriptomeTsv({
      fileName, description,
    })
      .catch((error) => {
        logger.warn(error);
      });
  },
});

export default addTranscriptome;
