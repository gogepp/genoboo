import { Meteor } from 'meteor/meteor';
import { ValidatedMethod } from 'meteor/mdg:validated-method';

import SimpleSchema from 'simpl-schema';
import assert from 'assert';
import Baby from 'babyparse';
import fs from 'fs';
import findIndex from 'lodash/findIndex';
import isEqual from 'lodash/isEqual';
import mapValues from 'lodash/mapValues';
import querystring from 'querystring';

import { Genes, GeneSchema, SubfeatureSchema } from '/imports/api/genes/gene_collection.js';
import { References, ReferenceInfo } from '/imports/api/genomes/reference_collection.js';
import { Tracks } from '/imports/api/genomes/track_collection.js';

import { scanGeneAttributes } from '/imports/api/genes/scan_attributes.js';

/**
 * Override the default querystring unescape function to be able to parse commas correctly in gff attributes
 * @param  {[type]}
 * @return {[type]}
 */
querystring.unescape = uri => uri;

export const adGff = new ValidatedMethod({
	name: 'addGff',
	validate: new SimpleSchema({
		fileName: { type: String },
		referenceName: { type: String },
		trackName: { type: String }
	}).validator(),
	applyOptions: {
		noRetry: true
	},
	run({ fileName, referenceName, trackName }){
		if (! this.userId) {
			throw new Meteor.Error('not-authorized');
		}
		if (! Roles.userIsInRole(this.userId,'curator')){
			throw new Meteor.Error('not-authorized');
		}

		const existingTrack = Tracks.find({ trackName: trackName }).fetch().length
		if (existingTrack){
			throw new Meteor.Error('Track exists: ' + trackName);
		}

		const existingReference = References.find({ referenceName: referenceName }).fetch().length
		if (!existingReference){
			throw new Meteor.Error('Invalid reference: ' + referenceName)
		}

		const fileHandle = fs.readFileSync(fileName,{encoding:'binary'});

		console.log('start reading')
		Baby.parse(fileHandle, {
			delimiter: '\t',
			dynamicTyping: true,
			skipEmptyLines: true,
			comments: '#',
			error(error,file) {
				console.log(error)
			},
			complete(results,file) {
				console.log('reading done')
				console.log('start formatting')
				genes = formatGff(results.data, referenceName, trackName)
				console.log('formatting done')
				console.log('start validating')
				let geneCount = 0
				genes.forEach( (gene) => {
					GeneSchema.validate(gene)
					let existingGene = Genes.find({ID:gene.ID}).fetch().length
					if (existingGene){
						throw new Meteor.Error('Duplicate gene ID: ' + gene.ID)
					}
					geneCount += 1
				})
				console.log('validating done');
				
				Tracks.insert({
					trackName: trackName,
					reference: referenceName,
					geneCount: geneCount,
					permissions: ['admin']
				});

				genes.forEach( (gene) => {
					Genes.insert(gene)
					console.log('inserted',gene.ID)
				});
				
				scanGeneAttributes.call({ trackName: trackName });
			}
		})
		return true
	}
})


const formatGff = (parsedResults, referenceName, trackName) => {
	const temp = {}
	parsedResults.forEach( (line) => {
		assert.equal(line.length,9)
		let [
			seqid,
			source,
			type,
			start,
			end,
			score,
			strand,
			phase,
			attributes
		] = line
		let sub = {
			type: type,//line[2],
			start: start,//line[3],
			end: end,//line[4],
			score: score,//line[5],
			attributes: formatAttributes(attributes)//formatAttributes(line[8])
		}

		sub.ID = sub.attributes.ID;
		delete sub.attributes.ID;

		if (sub.attributes.Parent !== undefined){
			sub.parents = sub.attributes.Parent;
			delete sub.attributes.Parent;
		}

		if (sub.type === 'gene'){
			Object.assign(sub, {
				seqid: seqid,
				source: source,
				strand: strand,
				reference: referenceName,
				track: trackName,
				permissions: ['admin']
			})
			/*
			sub.seqid = line[0]
			sub.source = line[1]
			sub.strand = line[6]
			sub.reference = referenceName
			sub.track = trackName
			sub.permissions = ['admin']
			*/
			GeneSchema.validate(sub)
		} else {
			sub.phase = phase
			SubfeatureSchema.validate(sub)
		}
		temp[sub.ID] = sub
	})

	Object.keys(temp).forEach( (subId) => {
		let sub = temp[subId]
		if (sub.parents !== undefined){
			for (parentId of sub.parents){
				let parent = temp[parentId]
				if (parent.children === undefined){
					temp[parentId].children = []
				}
				temp[parentId].children.push(sub.ID)
			}
		}
	})

	const gff = []
	Object.keys(temp).forEach( (subId) => {
		let sub = temp[subId];
		if (sub.type === 'gene'){
			sub.subfeatures = []
			let children = getChildren(subId,temp);
			let child = children.next()
			while (!child.done){
				let notSelf = child.value !== sub;

				let notPresent = findIndex(sub.subfeatures, (existingSub) => { 
						return isEqual(sub,existingSub) 
					}) < 0;

				if (notSelf && notPresent){
					sub.subfeatures.push(child.value)
				}
				child = children.next()
			}
			gff.push(sub)
		}
	})

	return gff
}

function *getChildren(Id,Gff){
	let sub = Gff[Id];
	yield sub;
	if (sub.children !== undefined){
		for (childId of sub.children){
			yield *getChildren(childId,Gff)
		}
	}
}

/**
 * This formats the attribute string into an object
 * Object keys are attribute identifiers
 * Object values are strings, arrays of string or arrays of objects
 * @param  {[type]}
 * @return {[type]}
 */
const formatAttributes = (attributeString) => {
	//split attribute string on semicolons for separate attributes and on equalsign for key/values
	const rawAttributes = querystring.parse(attributeString,';','=')

	//sometimes there is an empty key, remove this
	delete rawAttributes[''];

	const attributes = mapValues(rawAttributes, (rawAttribute, attributeName) => {
		const attributeArray = rawAttribute.split(',').map( (attribute) => {
			attribute = unescape(attribute);
			attribute.replace(/^"(.+(?="$))"$/, '$1');
			if (['Dbxref','Ontology_term'].indexOf(attributeName) >= 0){
				//turn attribute into object, split on colon
				attribute = querystring.parse(attribute,'',':')
			}
			return attribute
		} )

		let attributeField = attributeArray;
		switch(attributeArray.length){
			case 0:
				throw new Meteor.Error(`Incorrect attribute field: ${attributeString}`);
				break;
			case 1:
				if (['Dbxref','Ontology_term','Parent'].indexOf(attributeName) < 0){
					attributeField = attributeArray[0];
				} 
				break;
			default:
				break;
		}
		return attributeField
	})
	return attributes
}