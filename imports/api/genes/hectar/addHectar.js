import { hectarCollection } from '/imports/api/genes/hectar/hectarCollection.js';
import jobQueue, { Job } from '/imports/api/jobqueue/jobqueue.js';
import { ValidatedMethod } from 'meteor/mdg:validated-method';
import { Genes } from '/imports/api/genes/geneCollection.js';
import logger from '/imports/api/util/logger.js';
import { Roles } from 'meteor/alanning:roles';
import SimpleSchema from 'simpl-schema';
import { Meteor } from 'meteor/meteor';

class HectarProcessor {
  constructor() {
    // Not a bulk mongo suite.
    this.genesDb = Genes.rawCollection();
    this.nHectar = 0;
  }

  /**
   * Function that returns the total number of insertions or updates in the
   * hectar collection.
   * @function
   * @return {Number} Return the total number of insertions or updates of
   * hectar.
   */
  getNumberHectar() {
    return this.nHectar;
  }

  parse = (line) => {
    if (!(line[0] === '#' || line.split('\t').length <= 1)) {
      // Get all hectar informations line by line and separated by tabs.
      const [
        proteinId,
        predictedTargetingCategory,
        signalPeptideScore,
        signalPeptideCleavageSite,
        typeIISignalAnchorScore,
        chloroplastScore,
        mitochondrionScore,
        otherScore,
        ] = line.split('\t');

      // Organize data in a dictionary.
      const annotations = {
        protein_id: proteinId,
        predicted_targeting_category: predictedTargetingCategory,
        signal_peptide_score: signalPeptideScore,
        signal_peptide_cleavage_site: signalPeptideCleavageSite,
        typeII_signal_anchor_score: typeIISignalAnchorScore,
        chloroplast_score: chloroplastScore,
        mitochondrion_score: mitochondrionScore,
        other_score: otherScore,
      };

      // Filters undefined data (with a dash) and splits into an array for
      // comma-separated data.
      for (const [key, value] of Object.entries(annotations)) {
        if (value[0] === '-') {
          annotations[key] = undefined;
        }
        if (value.indexOf(',') > -1) {
          annotations[key] = value.split(',');
        }
      }

      // If subfeatures is found in genes database (e.g: ID =
      // MMUCEDO_000002-T1).
      const subfeatureIsFound = Genes.findOne({
          $or: [
            { 'subfeatures.ID': protein_id },
            { 'subfeatures.protein_id': protein_id },
          ],
      });

      if (typeof subfeatureIsFound !== 'undefined') {
        // Increment hectar.
        this.nHectar += 1;

        // Update or insert if no matching documents were found.
        const documentHectar = hectarCollection.upsert(
          { protein_id: proteinId }, // selector.
          annotations, // modifier.
        );

        // Update hectarId in genes database.
        if (typeof documentHectar.insertedId !== 'undefined') {
          // Hectar _id is created.
          return this.genesDb.update({
              $or: [
                { 'subfeatures.ID': proteinId },
                { 'subfeatures.protein_id': proteinId },
            ]},
            { $set: { hectarId: documentHectar.insertedId } },
          );
        } else {
          // Hectar already exists.
          const hectarIdentifiant = hectarCollection.findOne({ protein_id: proteinId })._id;
          return this.genesDb.update(
            { $or: [{'subfeatures.ID': proteinId}, {'subfeatures.protein_id': proteinId}] },
            { $set: { hectarId: hectarIdentifiant } },
          );
        }
      } else {
        logger.warn(`
Warning ! ${proteinId} hectar annotation did
not find a matching protein domain in the genes database.
${proteinId} is not added to the hectar database.`);
      }
    }
  };
}

const addHectar = new ValidatedMethod({
  name: 'addHectar',
  validate: new SimpleSchema({
    fileName: { type: String },
  }).validator(),
  applyOptions: {
    noRetry: true,
  },
  run({ fileName }) {
    if (!this.userId) {
      throw new Meteor.Error('not-authorized');
    }
    if (!Roles.userIsInRole(this.userId, 'admin')) {
      throw new Meteor.Error('not-authorized');
    }

    logger.log('file :', { fileName });
    const job = new Job(jobQueue, 'addHectar', { fileName });
    const jobId = job.priority('high').save();

    let { status } = job.doc;
    logger.debug(`Job status: ${status}`);
    while ((status !== 'completed') && (status !== 'failed')) {
      const { doc } = job.refresh();
      status = doc.status;
    }
    return { result: job.doc.result, jobStatus: status};
  },
});

export default addHectar;
export { HectarProcessor };
