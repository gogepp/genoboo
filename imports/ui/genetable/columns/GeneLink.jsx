import { Meteor } from 'meteor/meteor';

import React from 'react';
import { Link } from 'react-router-dom';

export default function GeneLink({ gene }) {
  const geneId = gene.ID
 
  const query = new URLSearchParams();
  query.set("annotation", gene.annotationName);
  const url = `/gene/${geneId}?${query.toString()}`

  return (
    <Link to={url} className="genelink" title={geneId}>
      { geneId }
    </Link>
  );
}
