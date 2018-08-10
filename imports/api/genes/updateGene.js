import { Meteor } from 'meteor/meteor';
import { ValidatedMethod } from 'meteor/mdg:validated-method';

import SimpleSchema from 'simpl-schema';
import { diff, apply } from 'rus-diff'; 
import { omit } from 'lodash';

import { attributeCollection } from './attributeCollection.js';
import { Genes, GeneSchema } from './gene_collection.js';
import { EditHistory } from './edithistory_collection.js';


export const updateGene = new ValidatedMethod({
  name: 'updateGene',
  validate: new SimpleSchema({
    geneId: String,
    update: {
      type: Object,
      blackbox: true
    }
  }).validator(),
  applyOptions: {
    noRetry: true
  },
  run({ geneId, update }){
    const userId = this.userId;
    if (! userId) {
      throw new Meteor.Error('not-authorized');
    }
    if (! Roles.userIsInRole(userId,'curator')){
      throw new Meteor.Error('not-authorized');
    }
    console.log(`Updating gene ${geneId}`)

    const gene = Genes.findOne({ ID: geneId });

    if ( typeof gene === 'undefined'){
      throw new Meteor.Error(`Gene ${geneId} not found!`)
    }
    console.log('Update:',update)

    const newGene = apply(gene, update);

    GeneSchema.validate(omit(newGene, '_id'));

    const revert = diff(newGene, gene);

    console.log('Revert:',revert)

    let newAttributes = [];

    if (update.hasOwnProperty('$set')){
      newAttributes = Object.keys(update['$set']).filter( key => {
        return key.startsWith('attributes.')
      }).map( key => {
        return {
          query: key,
          name: key.replace('attributes.','')
        }
      })
    }
      
    console.log('New attributes:', newAttributes)

    const revertString = JSON.stringify(revert);

    Genes.update({ ID: geneId }, update, (err,res) => {
      if (!err){
        EditHistory.insert({ 
          ID: geneId, 
          date: new Date(), 
          user: userId, 
          revert: revertString
        })
        newAttributes.forEach( ({ name, query }) => {
          attributeCollection.update({
            name
          },{
            $setOnInsert: {
              name,
              query,
              defaultShow: false,
              defaultSearch: false,
              genomes: [ gene.genomeId ]
            },
            $addToSet: {
              genomes: gene.genomeId
            }
          })
        })
      }
    })
  }
})
