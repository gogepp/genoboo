import { Mongo } from 'meteor/mongo';
import SimpleSchema from 'simpl-schema';

const genomeSequenceCollection = new Mongo.Collection('genomeSequences');

const genomeSequenceSchema = new SimpleSchema({
  header: {
    type: String,
    index: true,
    label: 'Fasta style sequence header',
  },
  seq: {
    type: String,
    label: 'Nucleotide sequence',
  },
  genomeId: {
    type: String,
    index: true,
    label: 'Genome ID in genome collection',
  },
  start: {
    type: Number,
    index: true,
    label: 'Start position of sequence fragment on original sequence',
  },
  end: {
    type: Number,
    index: true,
    label: 'End position of sequence fragment on original sequence',
  },
  permission: {
    type: String,
    label: 'Permission level that is allowed to see this reference',
  },
  isPublic: {
    type: Boolean,
    label: 'Publicly available genome',
    optional: true,
  },
});

genomeSequenceCollection.attachSchema(genomeSequenceSchema);

const genomeCollection = new Mongo.Collection('genomes');

const genomeSchema = new SimpleSchema({
  _id: {
    type: String,
  },
  name: {
    type: String,
    label: 'Reference name',
    index: true,
    unique: true,
  },
  permission: {
    type: String,
    label: 'Permission level that is allowed to see this reference',
  },
  isPublic: {
    type: Boolean,
    label: 'Publicly available genome',
  },
  description: {
    type: String,
    label: 'Reference sequence description',
  },
  organism: {
    type: String,
    label: 'Organism name',
  },
  annotationTrack: {
    type: Array,
    optional: true,
    label: 'Genome annotations',
  },
  'annotationTrack.$': {
    type: Object
  },
  'annotationTrack.$.name': {
    type: String,
    label: 'Annotation track name',
  },
  'annotationTrack.$.blastDb': {
    type: Object,
    optional: true,
    label: 'Annotation track BLAST database identifiers',
  },
  'annotationTrack.$.blastDb.nucl': {
    type: String,
    label: 'Nucleotide BLAST database',
  },
  'annotationTrack.$.blastDb.prot': {
    type: String,
    label: 'Protein BLAST database',
  },
});

genomeCollection.attachSchema(genomeSchema);

export {
  genomeCollection,
  genomeSchema,
  genomeSequenceCollection,
  genomeSequenceSchema,
};
