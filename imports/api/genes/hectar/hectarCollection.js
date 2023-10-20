import SimpleSchema from 'simpl-schema';
import { Mongo } from 'meteor/mongo';

const hectarSchema = new SimpleSchema({
  protein_id: {
    type: String,
    label: 'Query sequence name and type.',
  },
  annotationName: {
    type: String,
    label: 'Annotation name',
  },
  predicted_targeting_category: {
    type: String,
    label: 'Predicted sub-cellular localization.',
  },
  signal_peptide_score: {
    type: String,
    label: 'Probability (score) to be a signal peptide.',
  },
  signal_peptide_cleavage_site: {
    type: String,
    label: 'Predicted cleavage site of signal peptide.',
  },
  typeII_signal_anchor_score: {
    type: String,
    label: 'Probability (score) to be a type II signal anchor.',
  },
  chloroplast_score: {
    type: String,
    label: 'Probability (score) to be in chloroplast.',
  },
  mitochondrion_score: {
    type: String,
    label: 'Probability (score) to be in mitochondrion.',
  },
  other_score: {
    type: String,
    label: 'Probability (score) to be elsewhere .',
  },
});

const hectarCollection = new Mongo.Collection('hectar');

export { hectarCollection, hectarSchema };
