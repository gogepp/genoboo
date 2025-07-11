import { Meteor } from 'meteor/meteor';
import { withTracker } from 'meteor/react-meteor-data';

import React, { useState } from 'react';

import { dbxrefCollection } from '/imports/api/genes/dbxrefCollection.js';
import { DBXREF_REGEX } from '/imports/api/util/util.js';

import { compose, branch } from '/imports/ui/util/uiUtil.jsx';


// Unsure of the length check here?
function isArray(x) {
  return Array.isArray(x) && x.length >= 1;
//  return Array.isArray(x) && x.length > 1;
}

function notDbxref({ value }) {
  if (typeof value === "object" && !Array.isArray(value)){
    return true
  }

  let val = String(value)
  return !(
    DBXREF_REGEX.go.test(val)
    || DBXREF_REGEX.interpro.test(val)
  );
}

function SimpleAttribute({ value }) {
  // Manage custom dbxref
  if (typeof value === "object" && !Array.isArray(value)){
    return(
    <><a href={value.url}>{value.label}</a></>
    )
  }
  return String(value);
}

function dbxrefTracker({ value: dbxrefId }) {
  dbxrefId = String(dbxrefId)
  const sub = Meteor.subscribe('dbxref', { dbxrefId });
  const loading = !sub.ready();
  const dbxref = dbxrefCollection.findOne({ dbxrefId });
  return {
    dbxrefId,
    dbxref,
    loading,
  };
}

function DbxrefAttribute({ loading, dbxrefId, dbxref = {} }) {
  const { url = '#', description = '' } = dbxref;
  return (
    url === '#'
      ? <SimpleAttribute value={dbxrefId} />
      : (
        <>
          <a href={url}>{dbxrefId}</a>
          {' '}
          { description }
        </>
      )
  );
}

const DetailedSingleAttribute = compose(
  branch(notDbxref, SimpleAttribute),
  withTracker(dbxrefTracker),
)(DbxrefAttribute);


function AttributeValueArray({
  attrArray, showAll, toggleShowAll, maxLength = 2,
}) {
  const values = showAll
    ? attrArray
    : attrArray.slice(0, maxLength);
  return (
    <ul>
      {
        values.map((value) => (
          <li key={value} className="list-group-item py-0 px-0">
            <DetailedSingleAttribute
              value={value}
            />
          </li>
        ))
      }
      {
        attrArray.length > maxLength
        && (
          <li>
            <button
              type="button"
              className="is-link"
              onClick={toggleShowAll}
            >
              <small>
                {
                  showAll
                    ? 'Show less'
                    : `Show ${attrArray.length - maxLength} more ...`
                }
              </small>
            </button>
          </li>
        )
      }
    </ul>
  );
}


export default function AttributeValue({ attributeValue }) {
  const [showAll, setShowAll] = useState(false);
  function toggleShowAll() {
    setShowAll(!showAll);
  }

  if (typeof attributeValue === 'undefined') {
    return <p />;
  }

  const attrArray = isArray(attributeValue)
    ? attributeValue
    : [attributeValue];

  return (
    <AttributeValueArray
      attrArray={attrArray}
      showAll={showAll}
      toggleShowAll={toggleShowAll}
    />
  );
}
