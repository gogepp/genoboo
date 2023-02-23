/* eslint-env mocha */
import chai from 'chai';
import { resetDatabase } from 'meteor/xolvio:cleaner';
import { addTestUsers, addTestGenome } from '../../../startup/server/fixtures/addTestData';
import { Genes } from '../../genes/geneCollection';
import addAnnotation from './addAnnotation';
import '../../jobqueue/process-annotation';

describe('AddAnnotation', function testAnnotation() {
  let adminId;
  let newUserId;
  let adminContext;
  let userContext;

  beforeEach(() => {
    ({ adminId, newUserId } = addTestUsers());
    adminContext = { userId: adminId };
    userContext = { userId: newUserId };
  });

  it('Should add an annotation with gff3 file', function addAnnotationGff3() {
    // Increase timeout
    this.timeout(10000);

    const { genomeId, genomeSeqId } = addTestGenome();
    const toAnnot = {
      fileName: 'assets/app/data/Bnigra.gff3',
      genomeName: 'Test Genome',
      verbose: false,
    };

    // Should fail for non-logged in
    chai.expect(() => {
      addAnnotation._execute({}, toAnnot);
    }).to.throw('[not-authorized]');

    // Should fail for non admin user
    chai.expect(() => {
      addAnnotation._execute(userContext, toAnnot);
    }).to.throw('[not-authorized]');

    // Add annotation.
    addAnnotation._execute(adminContext, toAnnot);

    // // addAnnotation can return without being finished (bulk.exec is a promise)
    // // So add a sleep here until it's fixed to avoid issues
    Meteor._sleepForMs(2000);

    const genes = Genes.find({ genomeId: genomeId }).fetch();

    chai.assert.lengthOf(genes, 5, 'Number of created genes is not 4');

    const gene = genes[0];

    chai.assert.equal(gene.ID, 'BniB01g000010.2N');
    chai.assert.equal(gene.seqid, 'B1');
    chai.assert.equal(gene.source, 'AAFC_GIFS');
    chai.assert.equal(gene.strand, '-');
    chai.assert.equal(gene.type, 'gene');
    chai.assert.equal(gene.start, 13640);
    chai.assert.equal(gene.end, 15401);

    chai.assert.lengthOf(gene.subfeatures, 13, 'Number of subfeatures is not 13');
  });

  afterEach(() => {
    resetDatabase();
  });
});
