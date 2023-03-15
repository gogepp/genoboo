/* eslint-disable react/prop-types */
import { orthogroupCollection } from '/imports/api/genes/orthogroup/orthogroupCollection.js';
import { withTracker } from 'meteor/react-meteor-data';
import { Meteor } from 'meteor/meteor';
import React from 'react';
import { PhyloTree } from 'react-bio-viz';
import { css } from "@emotion/css";
import randomColor from "randomcolor";
import { PieChart } from 'react-minimal-pie-chart';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

import {
  branch,
  compose,
  isLoading,
  Loading,
} from '/imports/ui/util/uiUtil.jsx';

import './orthogroup.scss'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

function hasNoOrthogroup({ orthogroup }) {
  return typeof orthogroup === 'undefined';
}

function NoOrthogroup({ showHeader }) {
  return (
    <>
      {showHeader && <Header />}
      <article className="message no-orthogroup" role="alert">
        <div className="message-body">
          <p className="has-text-grey">No orthogroup found</p>
        </div>
      </article>
    </>
  );
}

function orthogroupDataTracker({ gene, ...props }) {
  const orthogroupId = (typeof gene.orthogroups === 'undefined' ? undefined : gene.orthogroups._str);
  const orthogroupSub = Meteor.subscribe('orthogroups', orthogroupId);
  const loading = !orthogroupSub.ready();
  const orthogroup = (typeof orthogroupId === 'undefined' ? undefined : orthogroupCollection.findOne({}));

  return {
    loading,
    gene,
    orthogroup,
    ...props,
  };
}

function Header() {
  return (
    <>
      <hr />
      <h4 className="subtitle is-4">Orthogroup</h4>
    </>
  );
}

function Orthogroup({ orthogroup, showHeader = false }) {

  function leafTextComponent({ node, fontSize = 11 }){
    const {
      data: { name, geneId },
      x,
    } = node;

    let val = name

    if (geneId) {
      val = <a href={geneId}>{name}</a>
    }

    return (
      <text x={0} y={0} className={css({fontFamily: 'sans-serif', fontSize: `${fontSize}`, color: 'red' })}>
        {val}
      </text>
    )
  }

 function leafColorComponent(node){
   const {
     data: { name, genomeId },
     x,
   } = node;

   let val = "unknown"
   if (genomeId){
     val = orthogroup.genomes[genomeId].name
   }

   return val
 }

  let barData = {
    labels: ["Gene count in tree"],
    datasets: []
  }

  let totalGenes = 0

  Object.values(orthogroup.genomes).map( genome => {
    barData.datasets.push({
      maxBarThickness: 100,
      data:[genome.count],
      label: genome.name == "unknown" ? "Unregistered genome": genome.name,
      backgroundColor: [randomColor({seed: genome.name})]
    })
    totalGenes += genome.count
  })

  let options = {
    plugins: {
      title: {
        display: true,
        text: 'Tree composition (' + totalGenes + ' genes)',
      },
    },
    responsive: true,
    maintainAspectRatio: true
  }

  return (
    <div id="orthogroup">
      {showHeader && <Header />}
      <PhyloTree
        tree={orthogroup.tree}
        height={orthogroup.size * 15}
        cladogram
        shadeBranchBySupport={false}
        leafTextComponent={leafTextComponent}
        colorFunction={leafColorComponent}
      />
      <div class="chart-container">
      <Bar data={barData} options={options}/>
      </div>
    </div>
  );
}

export default compose(
  withTracker(orthogroupDataTracker),
  branch(isLoading, Loading),
  branch(hasNoOrthogroup, NoOrthogroup),
)(Orthogroup);
