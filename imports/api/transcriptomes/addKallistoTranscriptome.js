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

const getGenomeId = (data, annot) => {
  const firstTranscripts = data.slice(0, 10).map((line) => decodeURIComponent(line.target_id));
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

const parseKallistoTsv = ({
  fileName, annot, sampleName, replicaGroup,
  description, permission = 'admin', isPublic = false,
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
    complete({ data }, _file) {
      let nInserted = 0;

      const {genomeId, annotationName} = getGenomeId(data, annot);

      if (typeof genomeId === 'undefined') {
        reject(new Meteor.Error('Could not find genomeId for first transcript'));
      }

      const unit = "tpm"

      const experimentId = ExperimentInfo.insert({
        genomeId,
        annotationName,
        sampleName,
        replicaGroup,
        description,
        permission,
        isPublic,
        unit
      });

      data.forEach(({ target_id, tpm, est_counts }) => {
        let geneQuery = {
          $or: [
            { ID: decodeURIComponent(target_id) },
            { 'subfeatures.ID': decodeURIComponent(target_id) },
          ],
        }

        if (annot){
          geneQuery['annotationName'] = annot
        }

        const gene = Genes.findOne(geneQuery);

        if (typeof gene === 'undefined') {
          logger.warn(`${target_id} not found`);
        } else {
          nInserted += 1;
          bulkOp.insert({
            geneId: gene.ID,
            annotationName,
            tpm,
            est_counts,
            experimentId,
          });
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

const addKallistoTranscriptome = new ValidatedMethod({
  name: 'addKallistoTranscriptome',
  validate: new SimpleSchema({
    fileName: String,
    annot: {
      type: String,
      optional: true,
    },
    sampleName: String,
    replicaGroup: String,
    description: String,
    isPublic: Boolean
  }).validator(),
  applyOptions: {
    noRetry: true,
  },
  run({
    fileName, annot, sampleName, replicaGroup, description, isPublic
  }) {
    if (!this.userId) {
      throw new Meteor.Error('not-authorized');
    }
    if (!Roles.userIsInRole(this.userId, 'admin')) {
      throw new Meteor.Error('not-authorized');
    }
    return parseKallistoTsv({
      fileName, annot, sampleName, replicaGroup, description, isPublic
    })
      .catch((error) => {
        logger.warn(error);
      });
  },
});

export default addKallistoTranscriptome;
