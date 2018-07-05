import { Meteor } from 'meteor/meteor';
import { withTracker } from 'meteor/react-meteor-data';

import React from 'react';
import { compose } from 'recompose';

import { removeAnnotationTrack } from '/imports/api/genomes/removeAnnotationTrack.js';

import { withEither } from '/imports/ui/util/uiUtil.jsx';


const hasNoAnnotation = ({ name }) => {
  return typeof name === 'undefined';
}

const NoAnnotation = () => {
  return <button type="button" className="btn btn-outline-secondary btn-sm px-2 py-0" disabled>
    <i className="fa fa-ban" /> No annotation
  </button> 
}

const withConditionalRendering = compose(
  withEither(hasNoAnnotation, NoAnnotation)
)

//const AnnotationInfo = ({ name, blastDbs, disabled }) => {
class AnnotationInfo extends React.Component {
  removeAnnotationTrack = event => {
    const genomeId = event.target.id;
    console.log(`removeAnnotationTrack ${genomeId}`)
    removeAnnotationTrack.call({ genomeId }, (err, res) => {
      if (err) {
        console.log(err)
        alert(err)
      }
    })
  }
  render(){
    const { name, genomeId, disabled } = this.props;
    return <table style={{width:'100%'}}>
      <tbody>
        <tr>
          <td>{ name }</td>
        </tr>
        <tr>
          <td>Blast DBs</td>
        </tr>
        {
          !disabled && <tr>
            <td>
              <button 
                type='button' 
                className='btn btn-danger btn-sm px-2 py-0 btn-block'
                onClick={ this.removeAnnotationTrack }
                id={genomeId}>
                <i className="fa fa-exclamation-circle" /> Delete annotation <i className="fa fa-exclamation-circle" />
              </button>
            </td>
          </tr>
        }
      </tbody>
    </table>
  }
}

export default withConditionalRendering(AnnotationInfo);