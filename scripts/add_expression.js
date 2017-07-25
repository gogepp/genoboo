#!/usr/bin/env node

"use strict";


if (!module.parent){
	const assert = require('assert');
	const commander = require('commander');
	const Baby = require('babyparse');
	const fs = require('fs');
	const asteroid = require('asteroid');
	const path = require('path');

	let fileName, reference;

	commander
		.arguments('<kallisto_abundance.tsv>')
		.option('-u, --username <username>','The user to authenticate as [REQUIRED]')
		.option('-p, --password <password>','The user\'s password [REQUIRED]')
		.option('-t, --trackname <annotation trackname>','Name of the annotation track to which the genes belong [REQUIRED]')
		.option('-s, --samplename <sample name>','Name of the sample [REQUIRED]')
		.option('-e, --experimentgroup <experiment group name>','Name of the experiment to which the sample belongs')
		.option('-r, --replicagroup <replica group name>','Name of the replica group to which the sample belongs')
		.option('-d, --description <sample description>','Description of the sample')
		.action(function(file){
			fileName = path.resolve(file);
		})
		.parse(process.argv)

	if ( commander.username === undefined ||
		commander.password === undefined ||
		commander.trackname === undefined ||
		commander.samplename === undefined ||
		fileName === undefined ){
		commander.help()
	}

	console.log(commander.username,commander.password,fileName,commander.trackname)
	
	const config = {
		fileName: fileName,
		trackName: commander.trackname,
		sampleName: commander.samplename,
		experimentGroup: commander.experimentgroup ? commander.experimentgroup : commander.samplename,
		replicaGroup: commander.replicagroup ? commander.replicagroup : commander.samplename,
		description: commander.description ? commander.description : commander.samplename,
	}


	const Connection = asteroid.createClass()

	const portal = new Connection({
		endpoint: 'ws://localhost:3001/websocket'
	})

	portal.loginWithPassword({
		username: commander.username,
		password: commander.password
	})

	portal.call('addExpression', config)
		.then(result => {
			console.log(result)
			portal.disconnect()
			//process.exit(0)
		})
		.catch(error => {
			console.log(error)
			portal.disconnect()
			//process.exit(1)
		})	
}

