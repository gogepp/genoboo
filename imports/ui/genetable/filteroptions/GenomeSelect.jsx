import { Meteor } from 'meteor/meteor';
import { withTracker } from 'meteor/react-meteor-data';

import React, { useState } from 'react';
import { cloneDeep } from 'lodash';

import { genomeCollection } from '/imports/api/genomes/genomeCollection.js';

import {
  branch, compose, isLoading, Loading,
} from '/imports/ui/util/uiUtil.jsx';

import './genomeselect.scss';

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

function genomeDataTracker({ ...props }) {
  const genomeSub = Meteor.subscribe('genomes');
  const loading = !genomeSub.ready();
  const genomes = genomeCollection
    .find({
      annotationTrack: { $exists: true },
    })
    .fetch();

  return {
    loading,
    genomes,
    ...props,
  };
}

function GenomeSelect({
  genomes, query = {}, updateQuery, ...props
}) {
  const [selectedGenomes, setSelectedGenomes] = useState(
    new Set(genomes.map((genome) => genome._id)),
  );

  const [selectedAnnotations, setSelectedAnnotations] = useState(
    new Set(genomes.flatMap((genome) => {
      return genome.annotationTrack.map((annotation) => annotation.name);
    })),
  );

  let annotations = genomes.flatMap((genome) => {
    return genome.annotationTrack.map((annotation) => annotation.name)
  })

  function toggleGenomeSelect(genomeId) {
    const newSelection = cloneDeep(selectedGenomes);
    const newQuery = cloneDeep(query);

    if (newSelection.has(genomeId)) {
      newSelection.delete(genomeId);
    } else {
      newSelection.add(genomeId);
    }
    setSelectedGenomes(newSelection);

    if (newSelection.size < genomes.length) {
      newQuery.genomeId = { $in: [...newSelection] };
    } else if (hasOwnProperty(query, 'genomeId')) {
      delete newQuery.genomeId;
    }
    updateQuery(newQuery);
  }

  function toggleAnnotationSelect(annotationName) {
    const newSelection = cloneDeep(selectedAnnotations);
    const newQuery = cloneDeep(query);

    if (newSelection.has(annotationName)) {
      newSelection.delete(annotationName);
    } else {
      newSelection.add(annotationName);
    }
    setSelectedAnnotations(newSelection);

    if (newSelection.size < annotations.length) {
      newQuery.annotationName = { $in: [...newSelection] };
    } else if (hasOwnProperty(query, 'annotationName')) {
      delete newQuery.annotationName;
    }
    updateQuery(newQuery);
  }

  function selectAllGenomes() {
    const newSelection = new Set(genomes.map((genome) => genome._id));
    setSelectedGenomes(newSelection);

    const newQuery = cloneDeep(query);
    newQuery.genomeId = { $in: [...newSelection] };
    updateQuery(newQuery);
  }

  function unselectAllGenomes() {
    const newSelection = new Set();
    setSelectedGenomes(newSelection);

    const newQuery = cloneDeep(query);
    newQuery.genomeId = { $in: [...newSelection] };
    updateQuery(newQuery);
  }

  function selectAllAnnotations() {
    const newSelection = new Set(genomes.flatMap((genome) => {
      genome.annotationTrack.map((annotation) => annotation.name)
    }));
    setSelectedAnnotations(newSelection);

    const newQuery = cloneDeep(query);
    newQuery.annotationName = { $in: [...newSelection] };
    updateQuery(newQuery);
  }

  function unselectAllAnnotations() {
    const newSelection = new Set();
    setSelectedAnnotations(newSelection);

    const newQuery = cloneDeep(query);
    newQuery.annotationName = { $in: [...newSelection] };
    updateQuery(newQuery);
  }

  return (
    <>
    <div className="dropdown is-hoverable genomeselect">
      <div className="dropdown-trigger">
        <button type="button" className="button is-small">
          Genomes
          <span className="icon-down" />
        </button>
      </div>
      <div className="dropdown-menu" role="menu">
        <div className="dropdown-content">
          <h6 className="is-h6 dropdown-item dropdown-header">
            Select genomes
          </h6>
          {genomes.map(({ _id, name }) => {
            const checked = selectedGenomes.has(_id);
            return (
              <div key={`${_id}-${checked}`} className="dropdown-item">
                <label className="checkbox">
                  <input
                    type="checkbox"
                    className="dropdown-checkbox is-small"
                    id={_id}
                    checked={checked}
                    onChange={() => {
                      toggleGenomeSelect(_id);
                    }}
                  />
                  { name }
                </label>
              </div>
            );
          })}
          <div className="buttons has-addons is-centered multiple-select" role="group">
            <button type="button" className="button is-small" onClick={selectAllGenomes}>
              Select all
            </button>
            <button type="button" className="button is-small" onClick={unselectAllGenomes}>
              Unselect all
            </button>
          </div>
        </div>
      </div>
    </div>
    <div className="dropdown is-hoverable genomeselect">
      <div className="dropdown-trigger">
        <button type="button" className="button is-small">
          Annotations
          <span className="icon-down" />
        </button>
      </div>
      <div className="dropdown-menu" role="menu">
        <div className="dropdown-content">
          <h6 className="is-h6 dropdown-item dropdown-header">
            Select annotations
          </h6>
          {annotations.map((name) => {
            const checked = selectedAnnotations.has(name);
            return (
              <div key={`${name}-${checked}`} className="dropdown-item">
                <label className="checkbox">
                  <input
                    type="checkbox"
                    className="dropdown-checkbox is-small"
                    id={name}
                    checked={checked}
                    onChange={() => {
                      toggleAnnotationSelect(name);
                    }}
                  />
                  { name }
                </label>
              </div>
            );
          })}
          <div className="buttons has-addons is-centered multiple-select" role="group">
            <button type="button" className="button is-small" onClick={selectAllAnnotations}>
              Select all
            </button>
            <button type="button" className="button is-small" onClick={unselectAllAnnotations}>
              Unselect all
            </button>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

export default compose(
  withTracker(genomeDataTracker),
  branch(isLoading, Loading),
)(GenomeSelect);
