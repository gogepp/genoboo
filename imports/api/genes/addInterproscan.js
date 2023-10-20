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
  constructor(annot) {
    this.bulkOp = interproscanCollection.rawCollection().initializeUnorderedBulkOp();
    this.geneBulkOp = Genes.rawCollection().initializeUnorderedBulkOp();
    this.currentProt = ""
    this.currentGene = ""
    this.currentContent = []
    this.currentDB = []
    this.currentOnto = [],
    this.currentAnnotationName = "",
    this.annot = annot
  }

  finalize = () => {
    // Add last bulk
    if (this.currentProt !== ""){
      this.addToBulk()
    }

    if (this.bulkOp.length > 0){
      return this.bulkOp.execute();
    }
    return { nUpserted: 0 }
  }

  updateGenes = () => {
    // Update genes with dbxref and Ontology
    if (this.geneBulkOp.length > 0){
      return this.geneBulkOp.execute();
    }
    return { nMatched: 0 }
  }

  addToBulk = () => {
    if (this.currentContent.length > 0){
      this.bulkOp.find({
        gene_id: this.currentGene,
        protein_id: this.currentProt,
        annotationName: this.currentAnnotationName
      }).upsert().update(
        {
          $set: {
            gene_id: this.currentGene,
            protein_id: this.currentProt,
            annotationName: this.currentAnnotationName,
            protein_domains: this.currentContent
          },
        },
        {
          upsert: false,
          multi: true,
        },
      );
    }

    if (this.currentDB != [] || this.currentOnto != []){
      this.geneBulkOp.find({ID: this.currentGene, annotationName: this.currentAnnotationName}).update({
        $addToSet: {
          'attributes.Ontology_term': { $each: this.currentOnto },
          'attributes.Dbxref': { $each: this.currentDB }
        }
      });
    }
  }
}

/**
 * @param {*} fileName
 */
const addInterproscan = new ValidatedMethod({
  name: 'addInterproscan',
  validate: new SimpleSchema({
    fileName: { type: String },
    annot: {
      type: String,
      optional: true,
    },
    parser: {
      type: String,
      allowedValues: ['tsv', 'gff3'],
    },
  }).validator(),
  applyOptions: {
    noRetry: true,
  },
  run({ fileName, annot, parser }) {
    if (!this.userId) {
      throw new Meteor.Error('not-authorized');
    }
    if (!Roles.userIsInRole(this.userId, 'admin')) {
      throw new Meteor.Error('not-authorized');
    }

    const job = new Job(jobQueue, 'addInterproscan', { fileName, annot, parser });
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
