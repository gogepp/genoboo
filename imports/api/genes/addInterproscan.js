import jobQueue, { Job } from '/imports/api/jobqueue/jobqueue.js';
import { ValidatedMethod } from 'meteor/mdg:validated-method';
import { Genes } from '/imports/api/genes/geneCollection.js';
import { interproscanCollection } from '/imports/api/genes/interproscan/interproscanCollection.js';
import logger from '/imports/api/util/logger.js';
import { Roles } from 'meteor/alanning:roles';
import SimpleSchema from 'simpl-schema';
import { Meteor } from 'meteor/meteor';

/**
 * @method parse
 * @method finalize
 */
class InterproscanProcessor {
  constructor() {
    this.bulkOp = interproscanCollection.rawCollection().initializeUnorderedBulkOp();
    this.currentProt = ""
    this.currentGene = ""
    this.currentContent = []
    this.currentDB = []
    this.currentOnto = []
  }

  finalize = () => {
    if (this.bulkOp.length > 0){
      return this.bulkOp.execute();
    }
    return { nMatched: 0 }
  }

  addToBulk = () => {
    this.bulkOp.find({
      geneId: this.currentGene,
    }).upsert().update(
      {
        $set: {
          geneId: this.currentGene,
          protein_domains: this.currentConten
        },
      },
      {
        upsert: false,
        multi: true,
      },
    );
  }
}

/**
 * @param {*} fileName
 */
const addInterproscan = new ValidatedMethod({
  name: 'addInterproscan',
  validate: new SimpleSchema({
    fileName: { type: String },
    parser: {
      type: String,
      allowedValues: ['tsv', 'gff3'],
    },
  }).validator(),
  applyOptions: {
    noRetry: true,
  },
  run({ fileName, parser }) {
    if (!this.userId) {
      throw new Meteor.Error('not-authorized');
    }
    if (!Roles.userIsInRole(this.userId, 'admin')) {
      throw new Meteor.Error('not-authorized');
    }

    const job = new Job(jobQueue, 'addInterproscan', { fileName, parser });
    const jobId = job.priority('high').save();

    // Continue with synchronous processing
    let { status } = job.doc;
    logger.debug(`Job status: ${status}`);
    while ((status !== 'completed') && (status !== 'failed')) {
      const { doc } = job.refresh();
      status = doc.status;
    }
    return { result: job.doc.result, jobStatus: status};
  },
});

export default addInterproscan;
export { InterproscanProcessor };
