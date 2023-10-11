import SimpleSchema from 'simpl-schema';
import { Mongo } from 'meteor/mongo';

const interproscanSchema = new SimpleSchema({
  gene_id: {
    type: String,
    index: true,
    label: 'Linked gene ID',
  },
  protein_id: {
    type: String,
    label: 'Linked protein ID',
  },
  annotationName: {
    type: String,
    label: 'Annotation name',
  },
  protein_domains: {
    type: Array,
    label: 'Interproscan protein domains',
    optional: true,
  },
  'protein_domains.$': {
    type: Object,
    label: 'Interproscan protein domain',
    blackbox: true,
  }
});

const interproscanCollection = new Mongo.Collection('interproscan');

export { interproscanCollection, interproscanSchema };
