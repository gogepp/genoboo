/* eslint-disable react/prop-types */
import { Meteor } from 'meteor/meteor';
import { withTracker } from 'meteor/react-meteor-data';

import React from 'react';

import makeBlastDb from '/imports/api/blast/makeblastdb.js';
import removeBlastDb from '/imports/api/blast/removeblastdb.js';
import jobQueue from '/imports/api/jobqueue/jobqueue.js';
import logger from '/imports/api/util/logger.js';

import { JobProgressBar }
  from '/imports/ui/admin/jobqueue/AdminJobqueue.jsx';
import {
  branch, compose, isLoading, Loading,
} from '/imports/ui/util/uiUtil.jsx';

function HasBlastDb({ isEditing, genomeId }) {
  return isEditing ? (
    <button
      type="button"
      className="button is-danger is-small is-outlined is-light is-fullwidth"
      id={genomeId}
      onClick={() => {
        removeBlastDb.call({ genomeId }, (err) => {
          if (err) {
            logger.warn(err);
            alert(err);
          }
        });
      }}
    >
      <span className="icon-exclamation" />
      Remove Blast DBs
      <span className="icon-exclamation" />
    </button>
  ) : (
    <button
      type="button"
      className="button is-small is-success is-static is-fullwidth is-outlined"
      id={genomeId}
      disabled
    >
      <span className="icon-check" />
      Blast DBs present
    </button>
  );
}

function HasNoJob({ isEditing, genomeId }) {
  return isEditing ? (
    <button
      type="button"
      className="button is-small is-fullwidth"
      id={genomeId}
      onClick={() => {
        makeBlastDb.call({ genomeId }, (err) => {
          if (err) {
            logger.warn(err);
            alert(err);
          }
        });
      }}
    >
      Make Blast DB
    </button>
  ) : (
    <button
      type="button"
      className="button is-small is-fullwidth is-static"
      id={genomeId}
    >
      <i className="icon-block" />
      No Blast DB
    </button>
  );
}

const makeBlastDbJobTracker = ({ genomeId, isEditing }) => {
  const jobQueueSub = Meteor.subscribe('jobQueue');
  const loading = !jobQueueSub.ready();
  const job = jobQueue.findOne({
    'data.genomeId': genomeId,
    status: { $ne: 'completed' },
  });
  // logger.log(job);
  const hasJob = typeof job !== 'undefined' && job.status !== 'completed' && job.status !== 'failed';
  return {
    job,
    hasJob,
    loading,
    genomeId,
    isEditing,
  };
};

function HasNoBlastDb({ hasJob, job, ...props }) {
  // eslint-disable-next-line react/jsx-props-no-spreading
  return hasJob ? <JobProgressBar {...job} /> : <HasNoJob {...props} />;
}

const HasNoBlastDbWithJobTracker = compose(
  withTracker(makeBlastDbJobTracker),
  branch(isLoading, Loading),
)(HasNoBlastDb);

export default function BlastDB({ isEditing, genomeId, blastDb }) {
  const hasBlastDb = typeof blastDb !== 'undefined';
  return hasBlastDb ? (
    <HasBlastDb genomeId={genomeId} isEditing={isEditing} />
  ) : (
    <HasNoBlastDbWithJobTracker genomeId={genomeId} isEditing={isEditing} />
  );
}
