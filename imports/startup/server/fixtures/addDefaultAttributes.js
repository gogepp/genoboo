import { attributeCollection } from '/imports/api/genes/attributeCollection.js';

import logger from '/imports/api/util/logger.js';

const PERMANENT_ATTRIBUTES = [
  {
    name: 'Note',
    query: 'attributes.Note',
    display: false
  },
  {
    name: 'Dbxref',
    query: 'attributes.Dbxref',
    display: false
  },
  {
    name: 'Ontology Term',
    query: 'attributes.Ontology_term',
    display: false
  },
  {
    name: 'Orthogroup',
    query: 'orthogroup.name',
    display: false
  },
  {
    name: 'Gene ID',
    query: 'ID',
    display: true
  },
  {
    name: 'Has changes',
    query: 'changed',
    display: false
  },
  {
    name: 'Genome',
    query: 'genomeId',
    display: true
  },
  {
    name: 'Annotation',
    query: 'annotationName',
    display: true
  },
];

export default function addDefaultAttributes() {
  // add some default attributes to filter on
  PERMANENT_ATTRIBUTES.forEach(({ name, query, display }) => {
    const existingAttribute = attributeCollection.findOne({ name });
    if (typeof existingAttribute === 'undefined') {
      logger.log(`Adding default filter option: ${name}`);
      attributeCollection.update(
        {
          name,
        },
        {
          $setOnInsert: {
            name,
            query,
            defaultShow: display,
            defaultSearch: display,
            allGenomes: true,
          },
        },
        {
          upsert: true,
        },
      ); // end update
    } // end if
  }); // end foreach
}
