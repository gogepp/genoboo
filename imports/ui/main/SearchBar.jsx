/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable jsx-a11y/control-has-associated-label */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import { Meteor } from 'meteor/meteor';
import { withTracker } from 'meteor/react-meteor-data';

import React, { useState, useEffect, useRef } from 'react';
import { Redirect, withRouter, useHistory } from 'react-router-dom';
import { cloneDeep } from 'lodash';

import { attributeCollection } from '/imports/api/genes/attributeCollection.js';

import {
  branch, compose, isLoading, Loading,
} from '/imports/ui/util/uiUtil.jsx';

const attributeTracker = ({ location }) => {
  const {
    search, state: _state = {},
  } = location;
  const state = _state === null ? {} : _state;
  const { highLightSearch = false, redirected = false } = state;

  const query = new URLSearchParams(search);
  const attributeString = query.get('attributes') || '';
  const searchString = query.get('search') || '';

  const attributeSub = Meteor.subscribe('attributes');
  const loading = !attributeSub.ready();
  const attributes = attributeCollection.find({}).fetch();

  const selAttr = attributeString.split(',')
    .filter((attr) => attr !== '');

  const selectedAttributes = selAttr.length
    ? selAttr
    : attributes.filter((attribute) => attribute.defaultSearch)
      .map((attribute) => attribute.name);

  return {
    loading,
    attributes,
    selectedAttributes,
    searchString,
    highLightSearch,
  };
};

function SearchBar({
  selectedAttributes: initialSelectedAttributes,
  searchString: initialSearchString,
  attributes,
  highLightSearch,
  isBlock
}) {
  const [redirect, setRedirect] = useState(false);
  const [searchString, setSearchString] = useState(initialSearchString);
  const [selectedAttributes, setSelectedAttributes] = useState(
    new Set(['Gene ID', ...initialSelectedAttributes]),
  );
  let history = useHistory()
  const inputRef = useRef();
  useEffect(() => {
    if (highLightSearch) {
      inputRef.current.focus();
    }
  }, [highLightSearch]);

  // Cleanup redirect after rendering Redirect element
  useEffect(() => {
    if (redirect) {
      setRedirect(false);
    }
  }, [redirect]);

  function toggleAttributeSelect(event) {
    const attributeName = event.target.id;
    const newSelAttr = cloneDeep(selectedAttributes);
    if (newSelAttr.has(attributeName)) {
      newSelAttr.delete(attributeName);
    } else {
      newSelAttr.add(attributeName);
    }
    setSelectedAttributes(newSelAttr);
  }

  function clearSearch() {
    setSearchString('');
    setRedirect(true);
  }

  function submit(event) {
    event.preventDefault();
    if (Meteor.settings.public.redirectSearch){
        const query = new URLSearchParams();
        const searchUrl = Meteor.settings.public.redirectSearch
        const searchAttr = Meteor.settings.public.redirectSearchAttribute ? Meteor.settings.public.redirectSearchAttribute : 'query'
        query.set(searchAttr, searchString.trim());
        location.href = searchUrl + `?${query.toString()}`
    }
    setRedirect(true);
  }

  function invalidForm(){
    return !(selectedAttributes.size && searchString);
  }

  if (redirect) {
    const query = new URLSearchParams();
    let searchUrl = "/genes"
    query.set('attributes', [...selectedAttributes]);
    query.set('search', searchString.trim());
    const queryString = `?${query.toString()}`;

    return (
      <Redirect
        push
        to={{
          pathname: searchUrl,
          search: searchString.length ? queryString : '',
          state: {
            redirected: true,
          },
        }}
      />
    );
  }

  let label = Meteor.settings.public.externalSearch ? "Select attributes to display" : "Select attributes to search"
  let display_attr = Meteor.settings.public.redirectSearch ? false : true

  const className = isBlock ? "" : "navbar-item is-pulled-right"
  const size = isBlock ? "" : "is-small"
  const expanded = isBlock ? "is-expanded" : ""

  return (
    <form
      className={className}
      role="search"
      onSubmit={submit}
    >
      <div className="field has-addons">
      {display_attr &&
        <div className="control has-dropdown">
          <div className="dropdown is-hoverable">
            <div className="dropdown-trigger">
              <button type="button" className={"button " + size }>
                <span className="icon">
                  <span className="icon-down" />
                </span>
              </button>
            </div>
            <div className="dropdown-menu" id="dropdown-menu-search" role="menu">
              <div className="dropdown-content">
                <h6 className="is-h6 dropdown-item">{label}</h6>
                {attributes.map(({ name }) => {
                  const checked = selectedAttributes.has(name);
                  return (
                    <div className="dropdown-item" key={`${name} ${checked}`}>
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          defaultChecked={checked}
                          onChange={toggleAttributeSelect}
                          className="dropdown-checkbox is-small"
                          id={name}
                        />
                        { name }
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        }
        <div className={"control " + expanded}>
          <input
            type="text"
            className={"input " + size }
            placeholder="Search genes"
            value={searchString}
            onChange={(event) => setSearchString(event.target.value)}
            onSubmit={submit}
            ref={inputRef}
          />
        </div>
        <div className="control">
          <button type="submit" className={"button " + size } disabled={invalidForm()}>
            <span className="icon-search" />
          </button>
        </div>
      </div>
    </form>
  );
}

export default compose(
  withRouter,
  withTracker(attributeTracker),
  branch(isLoading, Loading),
)(SearchBar);
