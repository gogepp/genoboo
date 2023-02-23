/* eslint-env mocha */
import chai from 'chai';
import { Meteor } from 'meteor/meteor';
import logger from '/imports/api/util/logger.js';
import { addTestUsers, addTestGenome } from '/imports/startup/server/fixtures/addTestData.js';
import { genomeCollection, genomeSequenceCollection } from '/imports/api/genomes/genomeCollection.js';
import { Genes } from '/imports/api/genes/geneCollection.js';
import { resetDatabase } from 'meteor/xolvio:cleaner';
import addGenome from './addGenome.js';
import updateGenome from './updateGenome';
import removeGenome from './removeGenome';
import removeAnnotationTrack from './annotation/removeAnnotationTrack';

// Required for sending jobs
import '/imports/api/jobqueue/process-addGenome';

describe('genomes', function testGenomes() {
  let adminId;
  let newUserId;
  let adminContext;
  let userContext;

  logger.log('Testing genomes and alignement related methods');

  beforeEach(() => {
    ({ adminId, newUserId } = addTestUsers());
    adminContext = { userId: adminId };
    userContext = { userId: newUserId };
  });

  afterEach(() => {
    resetDatabase();
  });

  it('Should create a new genome', function createGenome() {
    // Increase timeout
    this.timeout(20000);

    // Might be a better way to get the path..
    const newGenome = {
      fileName: 'assets/app/data/Bnigra.fasta',
      genomeName: 'Brassica nigra',
      async: false,
    };

    // Should fail for non-logged in
    chai.expect(() => {
      addGenome._execute({}, newGenome);
    }).to.throw('[not-authorized]');

    // Should fail for non admin user
    chai.expect(() => {
      addGenome._execute(userContext, newGenome);
    }).to.throw('[not-authorized]');

    const result = addGenome._execute(adminContext, newGenome);

    chai.assert.equal(result.result.ok, 1);
    chai.assert.equal(result.result.nInserted, 58);

    const genomes = genomeCollection.find({ name: 'Brassica nigra' }).fetch();
    chai.assert.lengthOf(genomes, 1, 'Genome does not exists');

    const genome = genomes[0];

    const genomeSequences = genomeSequenceCollection.find({
      genomeId: genome._id,
    }).fetch();

    chai.assert.lengthOf(genomeSequences, 58, 'Not 58 genome sequences');

    const genomeSequence = genomeSequences[0];

    chai.assert.equal(genomeSequence.header, 'B1');
    chai.assert.equal(genomeSequence.start, 0);
    chai.assert.equal(genomeSequence.end, 23320);
  });

  it('Should delete a genome', function deleteGenome() {
    const {genomeId, genomeSeqId} = addTestGenome(annot=true)
    const toDelete = {genomeId: genomeId}

    // Should fail for non-logged in
    chai.expect(() => {
      removeGenome._execute({}, toDelete);
    }).to.throw('[not-authorized]');

    // Should fail for non admin user
    chai.expect(() => {
      removeGenome._execute(userContext, toDelete);
    }).to.throw('[not-authorized]');

    removeGenome._execute(adminContext, toDelete);

    const genomes = genomeCollection.find({_id: genomeId}).fetch();
    chai.assert.lengthOf(genomes, 0, "Genome still exists")

    const genomeSequences = genomeSequenceCollection.find({genomeId: genomeId}).fetch();

    chai.assert.lengthOf(genomeSequences, 0, "Sequences still exists")

    const genes = Genes.find({genomeId: genomeId}).fetch();

    chai.assert.lengthOf(genes, 0, "Genes still exists")

  })


  it('Should update a genome', function editGenome() {

    const {genomeId, genomeSeqId} = addTestGenome()
    const toUpdate = {_id: genomeId, name: "new Name", description: "mydescription", organism: "organism", permission: "admin", isPublic: false}

    // Should fail for non-logged in
    chai.expect(() => {
      updateGenome._execute({}, toUpdate);
    }).to.throw('[not-authorized]');

    // Should fail for non admin user
    chai.expect(() => {
      updateGenome._execute(userContext, toUpdate);
    }).to.throw('[not-authorized]');

    updateGenome._execute(adminContext, toUpdate);

    const genomes = genomeCollection.find({_id: genomeId}).fetch();
    chai.assert.lengthOf(genomes, 1, "Genome does not exists")

    const genome = genomes[0]

    chai.assert.equal(genome.name, "new Name")
    chai.assert.equal(genome.description, "mydescription")
    chai.assert.equal(genome.organism, "organism")
  });

  it('Should remove an annotation track', function deleteAnnotation() {
    // Increase timeout
    this.timeout(20000);

    const {genomeId, genomeSeqId} = addTestGenome(annot=true)
    const toRemove =  {genomeId: genomeId}

    // Should fail for non-logged in
    chai.expect(() => {
      removeAnnotationTrack._execute({}, toRemove);
    }).to.throw('[not-authorized]');

    //Should fail for non admin user
    chai.expect(() => {
      removeAnnotationTrack._execute(userContext, toRemove);
    }).to.throw('[not-authorized]');

    removeAnnotationTrack._execute(adminContext, toRemove);

    const genes = Genes.find({genomeId: genomeId}).fetch();
    chai.assert.lengthOf(genes, 0, "There are still genes remaining")
  });
});
