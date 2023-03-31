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
    re_protein: {
      type: String,
      optional: true,
    },
    re_protein_capture: {
      type: String,
      optional: true,
      defaultValue: '^(.*?)$'
    },
    attr_protein: {
      type: String,
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
    fileName, genomeName, re_protein, re_protein_capture, attr_protein, verbose,
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
        re_protein,
        re_protein_capture,
        attr_protein,
        verbose,
      },
    );
    job.priority('high').save();

    let { status } = job.doc;
    logger.warn(`Job status: ${status}`);
    while ((status !== 'completed') && (status !== 'failed')) {
      const { doc } = job.refresh();
      status = doc.status;
    }
    return { result: job.doc.result, jobStatus: status};
  },
});

export default addAnnotation;
