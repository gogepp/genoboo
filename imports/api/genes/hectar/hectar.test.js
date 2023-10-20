/* eslint-env mocha */
import { resetDatabase } from 'meteor/xolvio:cleaner';
import chai from 'chai';
import logger from '../../util/logger';
import { hectarCollection } from './hectarCollection';
import addHectar from './addHectar';
import { addTestUsers, addTestGenome } from '../../../startup/server/fixtures/addTestData';
import '../../jobqueue/process-hectar';
import { Genes } from '/imports/api/genes/geneCollection.js';

describe('hectar', function testHectar() {
  let adminId;
  let newUserId;
  let adminContext;
  let userContext;

  logger.log('Testing Hectar methods');

  beforeEach(() => {
    ({ adminId, newUserId } = addTestUsers());
    adminContext = { userId: adminId };
    userContext = { userId: newUserId };
  });

  afterEach(() => {
    resetDatabase();
  });

  it('Should add Hectar tab file', function importhectar() {
    // Increase timeout
    this.timeout(20000);

    addTestGenome(annot = true, multiple = true);

    const hectarParams = {
      fileName: 'assets/app/data/Bnigra_hectar.tab',
      annot: "Annotation name"
    };

    // Should fail for non-logged in
    chai.expect(() => {
      addHectar._execute({}, hectarParams);
    }).to.throw('[not-authorized]');

    // Should fail for non admin user
    chai.expect(() => {
      addHectar._execute(userContext, hectarParams);
    }).to.throw('[not-authorized]');

    const { result } = addHectar._execute(adminContext, hectarParams);

    chai.assert.equal(result.nInserted, 1)

    const hecs = hectarCollection.find({ protein_id: 'Bni|B01g000010.2N.1', annotationName: "Annotation name" }).fetch();

    chai.assert.lengthOf(hecs, 1, 'No hectar data found');

    const hec = hecs[0];

    chai.assert.equal(hec.predicted_targeting_category, 'other localisation');
    chai.assert.equal(hec.signal_peptide_score, '0.0583');
    chai.assert.equal(hec.typeII_signal_anchor_score, '0.0228');
    chai.assert.equal(hec.mitochondrion_score, '0.1032');
    chai.assert.equal(hec.other_score, '0.8968');

    const gene1 = Genes.findOne({ID: 'Bni|B01g000010.2N', annotationName: 'Annotation name'})
    const gene2 = Genes.findOne({ID: 'Bni|B01g000010.2N', annotationName: 'Annotation name 2'})

    chai.assert.isDefined(gene1.hectarId, "eggNodeId is not defined for the correct annotation")
    chai.assert.isUndefined(gene2.hectarId, "eggNodeId is defined for the wrong annotation")
  });
});
