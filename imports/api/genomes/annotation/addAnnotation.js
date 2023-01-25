import { ValidatedMethod } from 'meteor/mdg:validated-method';
import { Roles } from 'meteor/alanning:roles';
import SimpleSchema from 'simpl-schema';
import { Meteor } from 'meteor/meteor';
import { genomeCollection } from '../genomeCollection';
import jobQueue, { Job } from '../../jobqueue/jobqueue';
import logger from '../../util/logger';

const addAnnotation = new ValidatedMethod({
  name: 'addAnnotation',
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
    fileName, genomeName, motif, type, keep, overwrite, verbose,
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
    job.priority('high').save();

    let { status } = job.doc;
    logger.debug(`Job status: ${status}`);
    while (status !== 'completed') {
      const { doc } = job.refresh();
      status = doc.status;
    }

    return { result: job.doc.result };
  },
});

export default addAnnotation;
