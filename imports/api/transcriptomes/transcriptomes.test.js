/* eslint-env mocha */
import chai from 'chai';
import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import logger from '/imports/api/util/logger.js';
import { addTestUsers, addTestGenome, addTestTranscriptome } from '/imports/startup/server/fixtures/addTestData.js';
import { genomeCollection, genomeSequenceCollection } from '/imports/api/genomes/genomeCollection.js';
import { ExperimentInfo, Transcriptomes } from '/imports/api/transcriptomes/transcriptome_collection.js';

import { Genes } from '/imports/api/genes/geneCollection.js';
import { resetDatabase } from 'meteor/xolvio:cleaner';

import addKallistoTranscriptome from './addKallistoTranscriptome.js';
import addExpression from './addExpression.js';
import updateSampleInfo from './updateSampleInfo.js'
import updateReplicaGroup from './updateReplicaGroup.js'

describe('transcriptomes', function testTranscriptomes() {
  let adminId, newUserId
  let adminContext
  let userContext

  logger.log("Testing transcriptomes methods")

  beforeEach(() => {
    ({ adminId, newUserId } = addTestUsers());
    adminContext = {userId: adminId}
    userContext = {userId: newUserId}
  });

  afterEach(() => {
    resetDatabase()
  });


  it('Should add a Kallisto transcriptome file', async function testAddKallistoTranscriptome() {
    // Increase timeout
    this.timeout(20000);

    const {genomeId, genomeSeqId} = addTestGenome(annot=true)

    const transcriParams = {
      fileName: 'assets/app/data/Bnigra_kallisto_abundance.tsv',
      sampleName: "mySample",
      replicaGroup: "replicaGroup",
      description: "A new description"
    };

    // Should fail for non-logged in
    chai.expect(() => {
      addKallistoTranscriptome._execute({}, transcriParams);
    }).to.throw('[not-authorized]');


    // Should fail for non admin user
    chai.expect(() => {
      addKallistoTranscriptome._execute(userContext, transcriParams);
    }).to.throw('[not-authorized]');

    let result = await addKallistoTranscriptome._execute(adminContext, transcriParams);

    const exps = ExperimentInfo.find({genomeId: genomeId}).fetch()

    chai.assert.lengthOf(exps, 1, "Did not find 1 Experimentation")

    const exp = exps[0]

    chai.assert.equal(exp.sampleName, 'mySample')
    chai.assert.equal(exp.replicaGroup, 'replicaGroup')
    chai.assert.equal(exp.description, 'A new description')

    const transcriptomes = Transcriptomes.find({experimentId: exp._id}).fetch()

    chai.assert.lengthOf(transcriptomes, 1, "Did not find 1 transcriptomes")

    const transcriptome = transcriptomes[0]

    chai.assert.equal(transcriptome.geneId, 'BniB01g000010.2N')
    chai.assert.equal(transcriptome.tpm, '1.80368')
    chai.assert.equal(transcriptome.est_counts, '21')

  })

  it('Should add an expression file', async function testAddExpression() {
    // Increase timeout
    this.timeout(20000);

    const {genomeId, genomeSeqId} = addTestGenome(annot=true)

    const transcriParams = {
      fileName: 'assets/app/data/Bnigra_abundance.tsv',
      description: "A new description"
    };

    // Should fail for non-logged in
    chai.expect(() => {
      addExpression._execute({}, transcriParams);
    }).to.throw('[not-authorized]');


    // Should fail for non admin user
    chai.expect(() => {
      addExpression._execute(userContext, transcriParams);
    }).to.throw('[not-authorized]');

    let result = await addExpression._execute(adminContext, transcriParams);

    const exps = ExperimentInfo.find({genomeId: genomeId}).fetch()

    chai.assert.lengthOf(exps, 2, "Did not find 2 Experimentations")

    const exp = exps[0]

    chai.assert.equal(exp.sampleName, 'sample1')
    chai.assert.equal(exp.replicaGroup, 'sample1')
    chai.assert.equal(exp.description, 'A new description')

    chai.assert.equal(exps[1].sampleName, 'sample2')
    chai.assert.equal(exps[1].replicaGroup, 'sample2')
    chai.assert.equal(exps[1].description, 'A new description')

    const transcriptomes = Transcriptomes.find({experimentId: exp._id}).fetch()

    chai.assert.lengthOf(transcriptomes, 1, "Did not find 1 transcriptomes")

    const transcriptome = transcriptomes[0]

    chai.assert.equal(transcriptome.geneId, 'BniB01g000010.2N')
    chai.assert.equal(transcriptome.tpm, '40')
    chai.assert.isUndefined(transcriptome.est_counts)

  })

  it('Should add an expression file with replica groups', async function testAddExpression() {
    // Increase timeout
    this.timeout(20000);

    const {genomeId, genomeSeqId} = addTestGenome(annot=true)

    const transcriParams = {
      fileName: 'assets/app/data/Bnigra_abundance.tsv',
      description: "A new description",
      replicas: ["1,2"],
      replicaNames: ["My replica group name"]
    };

    // Should fail for non-logged in
    chai.expect(() => {
      addExpression._execute({}, transcriParams);
    }).to.throw('[not-authorized]');


    // Should fail for non admin user
    chai.expect(() => {
      addExpression._execute(userContext, transcriParams);
    }).to.throw('[not-authorized]');

    let result = await addExpression._execute(adminContext, transcriParams);

    const exps = ExperimentInfo.find({genomeId: genomeId}).fetch()

    chai.assert.lengthOf(exps, 2, "Did not find 2 Experimentations")

    const exp = exps[0]

    chai.assert.equal(exp.sampleName, 'sample1')
    chai.assert.equal(exp.replicaGroup, 'sample1')
    chai.assert.equal(exp.description, 'A new description')

    chai.assert.equal(exps[1].sampleName, 'sample1')
    chai.assert.equal(exps[1].replicaGroup, 'sample2')
    chai.assert.equal(exps[1].description, 'A new description')

    const transcriptomes = Transcriptomes.find({experimentId: exp._id}).fetch()

    chai.assert.lengthOf(transcriptomes, 1, "Did not find 1 transcriptomes")

    const transcriptome = transcriptomes[0]

    chai.assert.equal(transcriptome.geneId, 'BniB01g000010.2N')
    chai.assert.equal(transcriptome.tpm, '40')
    chai.assert.isUndefined(transcriptome.est_counts)

  })

  it('Should add an expression file with replica groups and names', async function testAddExpression() {
    // Increase timeout
    this.timeout(20000);

    const {genomeId, genomeSeqId} = addTestGenome(annot=true)

    const transcriParams = {
      fileName: 'assets/app/data/Bnigra_abundance.tsv',
      description: "A new description",
      replicas: ["1,2"],
      replicaNames: ["My replica group name"]
    };

    // Should fail for non-logged in
    chai.expect(() => {
      addExpression._execute({}, transcriParams);
    }).to.throw('[not-authorized]');


    // Should fail for non admin user
    chai.expect(() => {
      addExpression._execute(userContext, transcriParams);
    }).to.throw('[not-authorized]');

    let result = await addExpression._execute(adminContext, transcriParams);

    const exps = ExperimentInfo.find({genomeId: genomeId}).fetch()

    chai.assert.lengthOf(exps, 2, "Did not find 2 Experimentations")

    const exp = exps[0]

    chai.assert.equal(exp.sampleName, 'My replica group name')
    chai.assert.equal(exp.replicaGroup, 'sample1')
    chai.assert.equal(exp.description, 'A new description')

    chai.assert.equal(exps[1].sampleName, 'My replica group name')
    chai.assert.equal(exps[1].replicaGroup, 'sample2')
    chai.assert.equal(exps[1].description, 'A new description')

    const transcriptomes = Transcriptomes.find({experimentId: exp._id}).fetch()

    chai.assert.lengthOf(transcriptomes, 1, "Did not find 1 transcriptomes")

    const transcriptome = transcriptomes[0]

    chai.assert.equal(transcriptome.geneId, 'BniB01g000010.2N')
    chai.assert.equal(transcriptome.tpm, '40')
    chai.assert.isUndefined(transcriptome.est_counts)

  })

  it('Should update a sample', function testUpdateSample() {
    // Increase timeout
    this.timeout(20000);

    const {genomeId, genomeSeqId, geneId} = addTestGenome(annot=true)
    const {expId, transcriptomeId} = addTestTranscriptome(genomeId, geneId)

    const updateParams = {
      _id: expId,
      sampleName: "myNewSample",
      replicaGroup: "newReplicaGroup",
      description: "A new description",
      permission: "admin"
    };

    // Should fail for non-logged in
    chai.expect(() => {
      updateSampleInfo._execute({}, updateParams);
    }).to.throw('[not-authorized]');


    // Should fail for non admin user
    chai.expect(() => {
      updateSampleInfo._execute(userContext, updateParams);
    }).to.throw('[not-authorized]');

    updateSampleInfo._execute(adminContext, updateParams);

    const exp = ExperimentInfo.findOne({_id: expId})

    chai.assert.equal(exp.sampleName, 'myNewSample')
    chai.assert.equal(exp.replicaGroup, 'newReplicaGroup')
    chai.assert.equal(exp.description, 'A new description')

  });

  it('Should update a replica group', function testUpdateReplica() {
    // Increase timeout
    this.timeout(20000);

    const {genomeId, genomeSeqId, geneId} = addTestGenome(annot=true)
    const {expId, transcriptomeId} = addTestTranscriptome(genomeId, geneId)

    const updateParams = {
      sampleIds: [expId],
      replicaGroup: "newReplicaGroup",
      isPublic: true,
      permission: "admin"
    };

    // Should fail for non-logged in
    chai.expect(() => {
      updateReplicaGroup._execute({}, updateParams);
    }).to.throw('[not-authorized]');


    // Should fail for non admin user
    chai.expect(() => {
      updateReplicaGroup._execute(userContext, updateParams);
    }).to.throw('[not-authorized]');

    updateReplicaGroup._execute(adminContext, updateParams);

    const exp = ExperimentInfo.findOne({_id: expId})

    chai.assert.equal(exp.replicaGroup, 'newReplicaGroup')
    chai.assert.equal(exp.isPublic, true)

  });

})
