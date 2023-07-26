/* eslint-disable react/prop-types */
import { hectarCollection } from '/imports/api/genes/hectar/hectarCollection.js';
import { branch, compose } from '/imports/ui/util/uiUtil.jsx';
import { Genes } from '/imports/api/genes/geneCollection.js';
import { withTracker } from 'meteor/react-meteor-data';
import React, { useEffect, useState } from 'react';
import { Meteor } from 'meteor/meteor';
import './hectar.scss';

function Header() {
  return (
    <>
      <hr />
      <h4 className="subtitle is-4">Hectar annotations</h4>
    </>
  );
}

function hasNoHectar({ hectar }) {
  return typeof hectar === 'undefined';
}

function NoHectar({ showHeader }) {
  return (
    <>
      {showHeader && <Header />}
      <article className="message no-orthogroup" role="alert">
        <div className="message-body">
          <p className="has-text-grey">No Hectar annotations found</p>
        </div>
      </article>
    </>
  );
}

function hectarDataTracker({ gene }) {
  const hectarSub = Meteor.subscribe('hectar', gene.hectarId);
  const loading = !hectarSub.ready();
  const hectar = hectarCollection.findOne({});

  return {
    loading,
    gene,
    hectar,
  };
}

function Localisation({ annot }) {
  return (
    <a>
      { annot }
    </a>
  );
}

function SigPepScore({ sigPep }) {
  return (
    <a>
      { sigPep }
    </a>
  );
}

function SigPepClivScore({ sigPepCli }) {
  return (
    <a>
      { sigPepCli }
    </a>
  );
}

function TIISigAncScore({ sigAnchor }) {
  return (
    <a>
      { sigAnchor }
    </a>
  );
}

function ChloroScore({ chloro }) {
  return (
    <a>
      { chloro }
    </a>
  );
}

function MitoScore({ mito }) {
  return (
    <a>
      { mito }
    </a>
  );
}


function OtherScore({ other }) {
  return (
    <a>
      { other }
    </a>
  );
}

function HectarGeneralInformations({ informations, maxArray = 5 }) {
  const maxChar = 70;
  const maxArrayLines = maxArray;
  const infoIsArray = Array.isArray(informations);
  const isMaxArray = informations.length > maxArrayLines;
  const isMaxChar = informations.length > maxChar;

  const [openInfo, setOpenInfo] = useState(false);
  const [descArray, setDescArray] = useState([]);
  const [descChar, setDescChar] = useState('');

  useEffect(() => {
    if (infoIsArray) {
      if (openInfo) {
        setDescArray(informations);
      } else {
        setDescArray(informations.slice(0, maxArrayLines));
      }
    } else {
      if (informations.length > maxChar) {
        if (openInfo === false) {
          const descNoArray = informations
            ? `${informations.slice(0, maxChar)} ... `
            : informations;
          setDescChar(descNoArray);
        } else {
          setDescChar(informations);
        }
      } else {
        setDescChar(informations);
      }
    }
  }, [openInfo]);

  const buttonText = (() => {
    if (infoIsArray) {
      if (openInfo) {
        return 'Show less';
      }
      return `Show ${informations.length - maxArrayLines} more ...`;
    } else {
      if (openInfo) {
        return 'Show less';
      }
      return 'Show more ...';
    }
  })();

  return (
    <>
      {
        infoIsArray
          (
            <div>{ descChar }</div>
          )
      }
    </>
  );
}

function ArrayHectarAnnotations({ hectar }) {
  return (
    <div>
      <table className="table-hectar table">
        <tbody>
          <tr>
            <th colSpan="2" className="is-light">
              General informations
            </th>
          </tr>
          <tr>
            <td>
              Sub-cellular localisation prediction
            </td>
            <td>
              { hectar.predicted_targeting_category && <Localisation annot={hectar.predicted_targeting_category} /> }
            </td>
          </tr>
          <tr>
            <td>
              Signal peptide score
            </td>
            <td>
              { hectar.signal_peptide_score && <SigPepScore sigPep={hectar.signal_peptide_score} /> }
            </td>
          </tr>
          <tr>
            <td>
              Signal peptide cleavage site score
            </td>
            <td>
              { hectar.signal_peptide_cleavage_site && <SigPepClivScore sigPepCli={hectar.signal_peptide_cleavage_site} /> }
            </td>
          </tr>
          <tr>
            <td>
              TypeII signal anchor score
            </td>
            <td>
              {
                hectar.typeII_signal_anchor_score
                  && (
                    <TIISigAncScore sigAnchor={hectar.typeII_signal_anchor_score} />
                  )
              }
            </td>
          </tr>
          <tr>
            <td>
              Chloroplastic protein score
            </td>
            <td>
              {
                hectar.chloroplast_score
                  && (
                    <ChloroScore chloro={hectar.chloroplast_score} />
                  )
              }
            </td>
          </tr>
          <tr>
            <td>
              Mitochondrial protein score
            </td>
            <td>
              {
                hectar.mitochondrion_score
                  && (
                    <MitoScore mito={hectar.mitochondrion_score} />
                  )
              }
            </td>
          </tr>
          <tr>
            <td>
              Other localisation score
            </td>
            <td>
              {
                hectar.other_score
                  && (
                    <OtherScore other={hectar.other_score} />
                  )
              }
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function HectarAnnotation({ showHeader = false, hectar }) {
  return (
    <>
      { showHeader && <Header />}
      <div>
        <ArrayHectarAnnotations hectar={hectar} />
      </div>
    </>
  );
}

export default compose(
  withTracker(hectarDataTracker),
  branch(hasNoHectar, NoHectar),
)(HectarAnnotation);
