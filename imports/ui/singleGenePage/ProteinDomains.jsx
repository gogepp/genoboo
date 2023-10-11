/* eslint-disable max-classes-per-file */
import React, { useState } from 'react';
import { scaleLinear } from 'd3';// -scale';
import { groupBy } from 'lodash';
import ReactResizeDetector from 'react-resize-detector';
import randomColor from 'randomcolor';

import { interproscanCollection } from '/imports/api/genes/interproscan/interproscanCollection.js';
import { withTracker } from 'meteor/react-meteor-data';
import { getGeneSequences } from '/imports/api/util/util.js';

import { branch, compose } from '/imports/ui/util/uiUtil.jsx';

import {
  Popover, PopoverTrigger, PopoverBody,
} from '/imports/ui/util/Popover.jsx';

import './proteinDomains.scss';


function Loading() {
  return <div>Loading...</div>;
}

function isLoading({ loading }) {
  return loading;
}

function XAxis({
  scale, numTicks, transform, seqid,
}) {
  const range = scale.range();

  const [start, end] = scale.domain();

  const stepSize = Math.round((end - start) / numTicks);

  const ticks = [start];

  for (let i = 1; i < numTicks; i += 1) {
    ticks.push(start + (i * stepSize));
  }
  ticks.push(end);
  return (
    <g className="x-axis" transform={transform}>
      <text
        className="axis-label"
        x={range[0]}
        y="0"
        dy="5"
        textAnchor="left"
        fontSize="10"
      >
        {seqid}
      </text>
      <line
        className="backbone"
        x1={range[0]}
        x2={range[1]}
        y1="25"
        y2="25"
        stroke="black"
      />
      {
        ticks.map((tick, tickIndex) => {
          const pos = scale(tick);
          let textAnchor;
          if (tickIndex === 0) {
            textAnchor = 'start';
          } else if (tickIndex === ticks.length - 1) {
            textAnchor = 'end';
          } else {
            textAnchor = 'middle';
          }
          return (
            <g className="tick" key={tick}>
              <line x1={pos} x2={pos} y1="20" y2="25" stroke="black" />
              <text
                x={pos}
                y="10"
                dy="5"
                textAnchor={textAnchor}
                fontSize="10"
              >
                { tick }
              </text>
            </g>
          );
        })
      }
    </g>
  );
}

function ProteinDomain({
  interproId, start, end, name, domainIndex, scale, Dbxref = [], Ontology_term = [], signature_desc, source, score,
}) {
  const fill = interproId === 'Unintegrated signature'
    ? 'grey'
    : randomColor({ seed: interproId });
  const style = { fill, fillOpacity: 0.5 };
  const targetId = `${name.replace(/[:\.]/g, '_')}_${start}_${end}`;
  return (
    <Popover>
      <PopoverTrigger>
        <rect
          className="protein-domain-interval"
          x={scale(start)}
          width={scale(end) - scale(start)}
          y="0"
          height="8"
          rx="2"
          ry="2"
          style={style}
          id={targetId}
        />
      </PopoverTrigger>
      <PopoverBody header={name}>
        <div className="panel-block">
          <table className="table is-small is-narrow is-hoverable">
            <tbody>
              <tr>
                <td>Signature description</td>
                <td>{signature_desc || 'Not available'}</td>
              </tr>
              <tr>
                <td>Coordinates</td>
                <td>
                  {`${start}..${end}`}
                </td>
              </tr>
              <tr>
                <td>Score</td>
                <td>{score}</td>
              </tr>
              <tr>
                <td>Source</td>
                <td>{source}</td>
              </tr>
              { Dbxref.length > 0 && (
              <tr>
                <td>Dbxref</td>
                <td>
                  <ul>
                    { Dbxref.map((xref) => (
                      <li key={xref}>{ xref }</li>
                    ))}
                  </ul>
                </td>
              </tr>
              )}
              { Ontology_term.length > 0 && (
              <tr>
                <td>Ontology term</td>
                <td>
                  <ul>
                    { Ontology_term.map((term) => (
                      <li key={term}>{ term }</li>
                    ))}
                  </ul>
                </td>
              </tr>
              )}
            </tbody>
          </table>
        </div>
      </PopoverBody>
    </Popover>
  );
}

function SourceGroup({
  source, domains, transform, scale,
}) {
  return (
    <g transform={transform}>
      {
          domains.map((domain, domainIndex) => (
            <ProteinDomain
              key={domainIndex}
              {...domain}
              scale={scale}
            />
          ))
      }
    </g>
  );
}

function InterproGroup({
  interproId, sourceGroups, transform, scale,
}) {
  const [xMin, xMax] = scale.range();
  const descriptions = new Set();
  Object.entries(sourceGroups).forEach((sourceGroup, sourceIndex) => {
    const [source, domains] = sourceGroup;
    domains.forEach((domain) => {
      if (typeof domain.signature_desc !== 'undefined') {
        descriptions.add(domain.signature_desc);
      }
    });
  });
  const description = [...descriptions].sort((a, b) => b.length - a.length)[0];
  let content = interproId
  if (interproId !== 'Unintegrated signature'){
    content = (
      <>
      <a
        href={`https://www.ebi.ac.uk/interpro/entry/${interproId}`}
        style={{ fontSize: '.7rem' }}
        target="_blank"
        rel="noopener noreferrer"
      >
        {interproId}
      </a>
      {` ${description}`}
      </>
    )
  }

  return (
    <g transform={transform}>
      <foreignObject width={xMax} height="25" x="0" y="-22">
        <p style={{
          fontSize: '.7rem',
          fontFamily: 'monospace',
          overflow: 'hidden',
          whitespace: 'nowrap',
          height: 25,
          textOverflow: 'ellipsis',
          wordBreak: 'break-all',
        }}
        >
          { content }
        </p>
      </foreignObject>
      {
        Object.entries(sourceGroups).map((sourceGroup, sourceIndex) => {
          const [source, domains] = sourceGroup;
          return (
            <SourceGroup
              key={source}
              source={source}
              domains={domains}
              transform={`translate(0,${sourceIndex * 10})`}
              index={sourceIndex}
              scale={scale}
            />
          );
        })
      }
    </g>
  );
}

function sortGroups(groupA, groupB) {
  const [nameA, intervalsA] = groupA;
  const [nameB, intervalsB] = groupB;
  if (nameA === 'Unintegrated signature') {
    return 1;
  }
  if (nameB === 'Unintegrated signature') {
    return -1;
  }
  const startA = Math.min(...intervalsA.map((interval) => interval.start));
  const startB = Math.min(...intervalsB.map((interval) => interval.start));

  return startA - startB;
}

function hasNoProteinDomains({ proteinDomains, gene }) {
  return typeof proteinDomains === 'undefined' || proteinDomains.length == 0 || proteinDomains.filter(domain => domain.gene_id === gene.ID).length == 0;
}

function Header() {
  return (
    <>
      <hr />
      <h4 className="subtitle is-4">Protein domains</h4>
    </>
  );
}

function NoProteinDomains({ showHeader }) {
  return (
    <>
      { showHeader && <Header /> }
      <article className="message no-protein-domains" role="alert">
        <div className="message-body">
          <p className="has-text-grey">No protein domains found</p>
        </div>
      </article>
    </>
  );
}

function InterproDataTracker({ gene }) {
  const interproSub = Meteor.subscribe('interpro', gene);
  const loading = !interproSub.ready();

  const proteinDomains = interproscanCollection.find({}).fetch()

  return {
    loading,
    gene,
    proteinDomains,
  };
}

function ProteinDomains({
  proteinDomains,
  gene,
  showHeader = false,
  resizable = false,
  initialWidth = 250,
}) {
  const [width, setWidth] = useState(initialWidth);

  // get sequence to determine length
  const sequences = getGeneSequences(gene);

  let totalGroups = 0;
  let totalProteins = 0;
  let currentTranslate = 0
  let maxTranscriptSize = 0

  const margin = {
    top: 10,
    bottom: 10,
    left: 20,
    right: 20,
  };

  const style = {
    marginLeft: margin.left,
    marginTop: margin.top,
  };

  const svgWidth = width - margin.left - margin.right;

  let content = proteinDomains.filter(domain => domain.gene_id === gene.ID).map(domain => {

    totalProteins += 1
    let domainCount = 0

    let seq = sequences.filter((seq) => (seq.ID === domain.protein_id || seq.protein_id === domain.protein_id))[0]
    let size = seq.prot.length;
    const scale = scaleLinear()
      .domain([0, size])
      .range([0, svgWidth]);

    let interproGroups = Object.entries(groupBy(domain.protein_domains,
      'interproId')).sort(sortGroups);
    totalGroups += interproGroups.length;

    let proteinContent = interproGroups.map((interproGroup, index) => {
      const [interproId, domains] = interproGroup;
      const sourceGroups = groupBy(domains, 'name');
      const yTransform = ((index + 1) * 30) + (domainCount * 10);
      const transform = `translate(0,${yTransform})`;

      domainCount += Object.entries(sourceGroups).length;

      return (
        <InterproGroup
          key={interproId}
          interproId={interproId}
          sourceGroups={sourceGroups}
          transform={transform}
          scale={scale}
        />
      );
    })

    let axisTransform = `translate(0,${15 + currentTranslate})`
    let gTransform = `translate(0,${40 + currentTranslate})`

    let data = (
      <>
      <XAxis scale={scale} numTicks={5} transform={axisTransform} seqid={domain.protein_id}/>
      <g className="domains" transform={gTransform}>
      {proteinContent}
      </g>
      </>
    )

    currentTranslate += ((interproGroups.length + 1 ) * 30) + (domainCount * 10);
    return data
  })

  const svgHeight = currentTranslate + margin.top + margin.bottom;

  return (
    <>
      { showHeader && <Header /> }
      <div className="card protein-domains">
        <svg width={svgWidth} height={svgHeight} style={style}>
          {content}
        </svg>
        {resizable && (
          <ReactResizeDetector
            handleWidth
            onResize={(w) => setWidth(w)}
          />
        )}
      </div>
    </>
  );
}

export default compose(
  withTracker(InterproDataTracker),
  branch(isLoading, Loading),
  branch(hasNoProteinDomains, NoProteinDomains),
)(ProteinDomains);
