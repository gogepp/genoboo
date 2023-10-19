import { Mongo } from 'meteor/mongo';
import SimpleSchema from 'simpl-schema';

const orthogroupSchema = new SimpleSchema({
  name: {
    type: String,
    label: 'Orthogroup name (based on file name)',
  },
  geneIds: {
    type: Array,
    label: 'Array of all gene IDs in the orthogroup',
  },
  'geneIds.$': {
    type: String,
    label: 'Gene ID string',
  },
  annotations: {
    type: Array,
    label: 'Array of all annotations names in the orthogroup',
  },
  'annotations.$': {
    type: String,
    label: 'Annotation name',
  },
  tree: {
    type: Object,
    blackbox: true,
    label: 'Newick formatted phylogenetic tree',
  },
  size: {
    type: Number,
    label: 'Orthogroup size',
  },
  genomes: {
    type: Object,
    blackbox: true,
    label: 'Dict of genomes in the orthogroups, with name and gene count for each'
  },
});

const orthogroupCollection = new Mongo.Collection('orthogroups');

orthogroupCollection.attachSchema(orthogroupSchema);

export { orthogroupCollection, orthogroupSchema };
