import SimpleSchema from 'simpl-schema';
import { Mongo } from 'meteor/mongo';

const VALID_SUBFEATURE_TYPES = [
  'transcript',
  'mRNA',
  'CDS',
  'exon',
  'five_prime_UTR',
  'three_prime_UTR',
];
const VALID_INTERVAL_TYPES = [].concat(VALID_SUBFEATURE_TYPES, ['gene']);

const Genes = new Mongo.Collection('genes');

// create a base schema so we can add it at multiple places
const IntervalBaseSchema = new SimpleSchema(
  {
    seq: {
      type: String,
      label: 'Reference sequence of this feature',
    },
    start: {
      type: SimpleSchema.Integer,
      label: 'Start coordinate',
      min: 0,
    },
    end: {
      type: SimpleSchema.Integer,
      label: 'End coordinate',
    },
    score: {
      type: String,
      label: 'Score',
      custom() {
        if (!this.isSet) {
          return 'required';
        }
        if (this.value === '.') {
          return true;
        }
        const parsedValue = parseFloat(this.value);
        // eslint-disable-next-line no-restricted-globals
        if (isNaN(parsedValue)) {
          return 'scoreError';
        }
        return true;
      },
    },
    attributes: {
      type: Object,
      blackbox: true,
      // index: true,
      label: 'Any attributes',
    },
    children: {
      type: Array, // [String],
      optional: true,
      label: 'Child subfeatures',
    },
    'children.$': {
      type: String,
    },
  },
  {
    keepRawDefinition: true,
  }
);

// Define subfeature schema first so we can then add it to the gene schema
const SubfeatureSchema = new SimpleSchema(
  {
    ID: {
      type: String,
      index: true,
      label: 'Subfeature ID',
    },
    protein_id: {
      type: String,
      optional: true,
      index: true,
      label: 'Linked protein ID for mRNA',
    },
    phase: {
      type: SimpleSchema.oneOf(SimpleSchema.Integer, String),
      allowedValues: [0, 1, 2, '.'],
      label: 'phase',
    },
    type: {
      type: String,
      allowedValues: VALID_SUBFEATURE_TYPES,
      label: 'Subfeature types',
    },
    parents: {
      type: Array,
      label: 'Parent subfeatures',
    },
    'parents.$': {
      type: String,
    },
  },
  {
    keepRawDefinition: true,
  }
);

// Extend the subfeature schema with base subfeatures.
SubfeatureSchema.extend(IntervalBaseSchema);

// Basic schema to store orthgroup information on the gene
const OrthogroupSchema = new SimpleSchema(
  {
    id: {
      type: String,
      index: true,
      label: 'Orthogroup DB identifier (_id in orthogroup collection)',
    },
    name: {
      type: String,
      index: true,
      label: 'Orthogroup name',
    },
  }
)

const GeneSchema = new SimpleSchema(
  {
    ID: {
      type: String,
      index: true,
      label: 'Gene ID',
    },
    editing: {
      type: String,
      optional: true,
    },
    viewing: {
      type: Array,
      optional: true,
    },
    'viewing.$': {
      type: String,
    },
    changed: {
      type: Boolean,
      optional: true,
    },
    subfeatures: {
      type: Array,
      label: 'Array of subfeatures',
    },
    'subfeatures.$': {
      type: SubfeatureSchema,
      label: 'Gene subfeatures',
    },
    genomeId: {
      type: String,
      index: true,
      label: 'Reference genome DB identifier (_id in genome collection)',
    },
    annotationName: {
      type: String,
      index: true,
      label: 'Annotation name',
    },
    orthogroup: {
      type: OrthogroupSchema,
      index: true,
      optional: true,
      label: 'Orthogroup information',
    },
    eggnogId: {
      type: String,
      index: true,
      optional: true,
      label: 'eggnog DB identifier (_id in eggnog collection)',
    },
    hectarId: {
      type: String,
      index: true,
      optional: true,
      label: 'Hectar identifier (_id in hectar collection)',
    },
    seqid: {
      type: String,
      label: 'ID of the sequence on which the gene is, e.g. chr1',
    },
    source: {
      type: String,
      label: 'Source of the annotation',
    },
    type: {
      type: String,
      allowedValues: ['gene'],
      label:
        'Type of the top level annotation (currently only "gene" is allowed)',
    },
    strand: {
      type: String,
      allowedValues: ['+', '-'],
      label: 'Strand',
    },
  },
  {
    keepRawDefinition: true,
  }
);

// Extend the gene schema with base features.
GeneSchema.extend(IntervalBaseSchema);


Genes.attachSchema(GeneSchema);

Genes.createIndex({ID: 'text', 'annotationName': 'text', 'subfeatures.ID': 'text'}, {name: 'Id and annotation index', unique: true})

export {
  Genes,
  GeneSchema,
  SubfeatureSchema,
  VALID_SUBFEATURE_TYPES,
  VALID_INTERVAL_TYPES,
};
