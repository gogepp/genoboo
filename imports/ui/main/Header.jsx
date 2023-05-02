import { withTracker } from 'meteor/react-meteor-data';
import { Meteor } from 'meteor/meteor';
import { Roles } from 'meteor/alanning:roles';

import React, { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';

import SearchBar from './SearchBar.jsx';
import PageloadPopup from './PageloadPopup.jsx';

import './header.scss';

function adminTracker() {
  const userId = Meteor.userId();
  const isAdmin = Roles.userIsInRole(userId, 'admin');
  return {
    isAdmin,
  };
}

function LoggedInButton({ isAdmin }) {
  return (
    <div className="navbar-item has-dropdown is-hoverable">
      <button type="button" className="button is-small navbar-link user-button">
        <span className="icon-user" />
      </button>
      <div className="navbar-dropdown is-right">
        <Link to="/profile" className="navbar-item">
          <span className="icon-pencil" />
            &nbsp;User profile
        </Link>
        <Link to="/#" className="navbar-item" disabled>
          <span className="icon-clipboard" />
            &nbsp;Favourites
        </Link>
        <hr className="navbar-divider" />
        { isAdmin && (
          <>
            <Link to="/admin" className="navbar-item">
              <span className="icon-cog" />
                &nbsp;Admin settings
            </Link>
            <div className="dropdown-divider" />
          </>
        )}
        <button
          type="button"
          className="button is-fullwidth is-danger is-light"
          id="signout"
          onClick={Meteor.logout}
        >
          <span className="icon-logout" />
            &nbsp;Sign out
        </button>
      </div>
    </div>
  );
}

const LoggedInButtonWithTracker = withTracker(adminTracker)(LoggedInButton);

function LoggedOutButton() {
  return (
    <div className="navbar-item">
      {! Meteor.settings.public.disable_user_login === true && (
      <Link to="/login" className="button is-small is-link" id="signin">
        <span className="icon-login" aria-hidden="true" />
      &nbsp;Sign in
      </Link>
     )}
    </div> 
  );
}

const UserButtons = withTracker(() => {
  const isLoggedIn = !!Meteor.userId() && !Meteor.loggingIn();
  return {
    isLoggedIn,
  };
})(({ isLoggedIn }) => (isLoggedIn ? <LoggedInButtonWithTracker /> : <LoggedOutButton />));

function NavBar() {
  const [show, setShow] = useState(false);
  const activeText = show ? 'is-active' : '';
  const urlPrefix = Meteor.absoluteUrl();

  let blastLink = (
    <NavLink to="/blast" className="navbar-item" activeClassName="active">
      Blast
    </NavLink>
  )
 
  if (Meteor.settings.public.blast_link){
    blastLink = (<a target="_blank" href={Meteor.settings.public.blast_link} className="navbar-item" activeClassName="active">Blast</a>)
  }

  return (
    <nav className="navbar is-white" role="navigation">
      <div className="navbar-brand">
        <NavLink to="/" activeClassName="active">
          <figure className="image is-32x32">
            <img
              id="navbar-brand-image"
              src={`${urlPrefix}logo.svg`}
              alt="GeneNoteBook"
              className="is-rounded"
            />
          </figure>
        </NavLink>
        <button
          className={`navbar-burger is-small burger button ${activeText}`}
          type="button"
          onClick={() => {
            setShow(!show);
          }}
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>
      </div>
      <div className={`navbar-menu ${activeText}`}>
        <div className="navbar-start">
          <NavLink id="gene-link" to="/genes" className="navbar-item" activeClassName="active">
            Genes
          </NavLink>
          {! Meteor.settings.public.disable_blast && (
            blastLink
          )}
          <SearchBar />
        </div>
        <div className="navbar-end">
          <UserButtons />
        </div>
      </div>
    </nav>
  );
}

export default function Header() {
  const [showPageloadPopup, togglePageloadPopup] = useState(false);
  return (
    <>
      <header role="banner">
        <NavBar />
      </header>
      {showPageloadPopup && (
        <PageloadPopup
          togglePopup={() => {
            togglePageloadPopup(false);
          }}
        />
      )}
    </>
  );
}
