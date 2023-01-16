import { genomeCollection } from '/imports/api/genomes/genomeCollection.js';
import jobQueue, { Job } from '/imports/api/jobqueue/jobqueue.js';
import { ValidatedMethod } from 'meteor/mdg:validated-method';
import logger from '/imports/api/util/logger.js';
import { Roles } from 'meteor/alanning:roles';
import SimpleSchema from 'simpl-schema';
import { Meteor } from 'meteor/meteor';

const addAnnotationTrack = new ValidatedMethod({
  name: 'addAnnotationTrack',
  validate: new SimpleSchema({
    fileName: {
      type: String,
    },
    genomeName: {
      type: String,
    },
    motif: {
      type: String,
      optional: true,
    },
    type: {
      type: String,
      optional: true,
      custom() {
        return true;
      },
    },
    keep: {
      type: Boolean,
      optional: true,
    },
    overwrite: {
      type: Boolean,
      optional: true,
    },
    verbose: {
      type: Boolean,
    },
  }).validator(),
  applyOptions: {
    noRetry: true,
  },
  run({
    fileName, genomeName, motif, type, keep, overwrite, verbose, strict = true,
  }) {
    if (!this.userId || !Roles.userIsInRole(this.userId, 'admin')) {
      throw new Meteor.Error('not-authorized');
    }

    const existingGenome = genomeCollection.findOne({ name: genomeName });
    if (!existingGenome) {
      throw new Meteor.Error(`Unknown genome name: ${genomeName}`);
    }
    if (typeof existingGenome.annotationTrack !== 'undefined') {
      throw new Meteor.Error(`Genome ${genomeName} already has an annotation track`);
    }

    const genomeId = existingGenome._id;

    const job = new Job(
      jobQueue,
      'addAnnotation',
      {
        fileName,
        genomeName,
        genomeId,
        motif,
        keep,
        overwrite,
        type,
        verbose,
      },
    );
    const jobId = job.priority('high').save();

    let { status } = job.doc;
    logger.debug(`Job status: ${status}`);
    while (status !== 'completed') {
      const { doc } = job.refresh();
      status = doc.status;
    }

    return { result: job.doc.result };

    // return gffFileToMongoDb({
    //   fileName, genomeId, motif, keepdata: keepIdField, type, verbose, strict,
    // }).catch((error) => {
    //   logger.warn(error);
    //   throw new Meteor.Error(error);
    // });
  },
});

export default addAnnotationTrack;
