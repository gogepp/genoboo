import SimpleSchema from 'simpl-schema';
import { Mongo } from 'meteor/mongo';

const interproscanSchema = new SimpleSchema({
  geneId: {
    type: String,
    label: 'Linked gene ID',
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
  },
});

const interproscanCollection = new Mongo.Collection('interproscan');

export { interproscanCollection, interproscanSchema };
