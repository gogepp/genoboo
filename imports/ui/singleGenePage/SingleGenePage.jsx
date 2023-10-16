import { Meteor } from 'meteor/meteor';
import { withTracker } from 'meteor/react-meteor-data';

import React from 'react';
import { Link } from 'react-router-dom';
import hash from 'object-hash';

import { Genes } from '/imports/api/genes/geneCollection.js';
import { genomeCollection } from '/imports/api/genomes/genomeCollection.js';

import { branch, compose } from '/imports/ui/util/uiUtil.jsx';

import NotFound from '/imports/ui/main/NotFound.jsx';

import GeneralInfo from './GeneralInfo.jsx';
import Genemodel from './Genemodel.jsx';
import Seq from './Seq.jsx';
import ProteinDomains from './ProteinDomains.jsx';
import Eggnog from './eggnog/Eggnog.jsx';
import Hectar from './hectar/Hectar.jsx';
import SequenceSimilarity from './alignment/SequenceSimilarity.jsx';
import Orthogroup from './orthoGroup/Orthogroup.jsx';

import GeneExpression from './geneExpression/GeneExpression.jsx';

import './singleGenePage.scss';

function hasOwnProperty(obj, prop) {
  return Object.hasOwnProperty.call(obj, prop);
}

function Loading() {
  return <div>Loading...</div>;
}

function isLoading({ loading }) {
  return loading;
}

function isNotFound({ genes }) {
  return genes.length === 0;
}

function isMultiple({ genes }) {
  return genes.length > 1;
}

function Multiple( {genes} ){
    let gene = genes[0]

    let content = genes.map(gene => {
      const query = new URLSearchParams();
      query.set("annotation", gene.annotationName);
      const url = `/gene/${gene.ID}?${query.toString()}`
      return (
        <p><Link to={url} className="genelink" title={gene.annotationName}>
          { gene.annotationName }
        </Link></p>
      );
    })

    return (
      <div className="container">
        <div className="card single-gene-page">
          <header className="has-background-light">
            <h4 className="title is-size-4 has-text-weight-light">
              {`${gene.ID} `}
            </h4>
            <div className="box">
              <p>This gene is defined in several annotations. Please select one:</p>
              <article className="message is-light">
                {content}
              </article>
            </div>
          </header>
        </div>
      </div>
    );
}

function geneDataTracker({ match, genomeDataCache, location }) {
  const { geneId } = match.params;
  const annotation = new URLSearchParams(location.search).get("annotation");
  const geneSub = Meteor.subscribe('singleGene', { geneId });
  let genes
  if (annotation) {
    genes = Genes.find({ ID: geneId, annotationName: annotation }).fetch();
  } else {
    genes = Genes.find({ ID: geneId }).fetch();
  }

  const loading = !geneSub.ready();
  return {
    loading,
    genes,
    genomeDataCache,
  };
}

function genomeDataTracker({ genes, genomeDataCache }) {
  // const genomeSub = Meteor.subscribe('genomes');
  let gene = genes[0]
  const { genomeId } = gene;
  let genome;
  let genomeSub;
  if (hasOwnProperty(genomeDataCache, genomeId) && typeof genomeDataCache[genomeId] !== 'undefined') {
    genome = genomeDataCache[genomeId];
  } else {
    genomeSub = Meteor.subscribe('genomes');
    genome = genomeCollection.findOne({ _id: gene.genomeId });
    genomeDataCache[genomeId] = genome;
  }

  const loading = typeof genomeSub !== 'undefined'
    ? !genomeSub.ready()
    : false;
  return {
    loading,
    gene,
    genome,
  };
}

function SingleGenePage({ gene, genome = {} }) {
  return (
    <div className="container">
      <div className="card single-gene-page">
        <header className="has-background-light">
          <h4 className="title is-size-4 has-text-weight-light">
            {`${gene.ID} `}
            <small className="text-muted">{genome.name}&nbsp;</small>
            <small className="text-muted">{gene.annotationName}</small>
          </h4>
          <div className="tabs is-boxed">
            <ul>
              <li className="is-active">
                <a href="#general-info">
                  General Information
                </a>
              </li>
              <li>
                <a href="#genemodel">
                  Gene model
                </a>
              </li>
              <li>
                <a href="#sequence">
                  Coding Sequence
                </a>
              </li>
              <li>
                <a href="#protein-domains">
                  Protein Domains
                </a>
              </li>
              <li>
                <a href="#orthogroup">
                  Orthogroup
                </a>
              </li>
              <li>
                <a href="#eggnog">
                  EggNOG
                </a>
              </li>
              <li>
                <a href="#hectar">
                  Hectar
                </a>
              </li>
              <li>
                <a href="#sequence-similarity">
                  Sequence Similarity
                </a>
              </li>
              <li>
                <a href="#expression">
                  Expression
                </a>
              </li>
            </ul>
          </div>
        </header>
        <div className="card-content">
          <GeneralInfo
            key={hash(gene.attributes)}
            gene={gene}
            genome={genome}
          />
          <section id="genemodel">
            <Genemodel gene={gene} showXAxis showHeader resizable />
          </section>
          <Seq gene={gene} />
          <section id="protein-domains">
            <ProteinDomains gene={gene} showHeader resizable />
          </section>
          <section id="orthogroup">
            <Orthogroup gene={gene} showHeader resizable />
          </section>
          <section id="eggnog">
            <Eggnog gene={gene} showHeader resizable />
          </section>
          <section id="hectar">
            <Hectar gene={gene} showHeader resizable />
          </section>
          <section id="sequence-similarity">
            <SequenceSimilarity gene={gene} showHeader={true} resizable />
          </section>
          <section id="expression">
            <GeneExpression gene={gene} showHeader resizable />
          </section>
        </div>
        <div className="card-footer text-muted">
          Gene info page for
          {` ${gene.ID}`}
        </div>
      </div>
    </div>
  );
}

export default compose(
  withTracker(geneDataTracker),
  branch(isLoading, Loading),
  branch(isNotFound, NotFound),
  branch(isMultiple, Multiple),
  withTracker(genomeDataTracker),
  branch(isLoading, Loading),
)(SingleGenePage);
