/* eslint-env mocha */
import chai from 'chai';
import { resetDatabase } from 'meteor/xolvio:cleaner';
import { addTestUsers, addTestGenome } from '../../../startup/server/fixtures/addTestData';
import { Genes } from '../../genes/geneCollection';
import addAnnotation from './addAnnotation';
import '../../jobqueue/process-annotation';
import logger from '/imports/api/util/logger.js';

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

  afterEach(() => {
    resetDatabase();
  });

  it('Should add an annotation with gff3 file', function addAnnotationGff3() {
    // Increase timeout
    this.timeout(10000);

    const { genomeId, genomeSeqId } = addTestGenome();
    let toAnnot = {
      fileName: 'assets/app/data/Bnigra.gff3',
      genomeName: 'Test Genome',
      annotationName: 'Test annotation',
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

    const genes = Genes.find({ genomeId: genomeId }).fetch();

    chai.assert.lengthOf(genes, 5, 'Number of created genes is not 5');

    const gene = genes[0];

    chai.assert.equal(gene.ID, 'Bni|B01g000010.2N');
    chai.assert.equal(gene.annotationName, 'Test annotation');
    chai.assert.equal(gene.seqid, 'B1');
    chai.assert.equal(gene.source, 'AAFC_GIFS');
    chai.assert.equal(gene.strand, '-');
    chai.assert.equal(gene.type, 'gene');
    chai.assert.equal(gene.start, 13640);
    chai.assert.equal(gene.end, 15401);

    chai.assert.lengthOf(gene.subfeatures, 14, 'Number of subfeatures is not 14');

    // Check CDS with the same ID
    has_default_cds = gene.subfeatures.some((sub) => sub.type == "CDS" && sub.ID == "Bni|B01g000010.2N.1.cds1")
    has_new_cds = gene.subfeatures.some((sub) => sub.type == "CDS" && sub.ID == "Bni|B01g000010.2N.1.cds1.1")

    chai.assert.isTrue(has_default_cds, "Bni|B01g000010.2N.1.cds1 was not found")
    chai.assert.isTrue(has_default_cds, "Bni|B01g000010.2N.1.cds1.1 was not found")

  });

  it('Should add multiple copies of genes with different annotation names', function addAnnotationGff3() {
    // Increase timeout
    this.timeout(10000);

    const { genomeId, genomeSeqId } = addTestGenome();
    let toAnnot = {
      fileName: 'assets/app/data/Bnigra.gff3',
      genomeName: 'Test Genome',
      annotationName: 'Test annotation',
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


    toAnnot = {
      fileName: 'assets/app/data/Bnigra.gff3',
      genomeName: 'Test Genome',
      annotationName: 'Test annotation2',
      verbose: false,
    };

    addAnnotation._execute(adminContext, toAnnot);

    const genes = Genes.find({ genomeId: genomeId }).fetch();

    chai.assert.lengthOf(genes, 10, 'Number of created genes is not 10');
  });

  it('Should add a default -protein label to the mRNA protein_id', function addAnnotationGff3() {
    // Increase timeout
    this.timeout(10000);

    const { genomeId, genomeSeqId } = addTestGenome();
    const toAnnot = {
      fileName: 'assets/app/data/Bnigra_min.gff3',
      genomeName: 'Test Genome',
      annotationName: 'Test annotation',
      verbose: false,
    };

    // Add annotation.
    addAnnotation._execute(adminContext, toAnnot);

    const genes = Genes.find({ genomeId: genomeId }).fetch();
    const mRNA = genes[0].subfeatures[0]
    chai.assert.equal(mRNA.ID + "-protein", mRNA.protein_id)

  });


  it('Should generate a protein ID from a regex', function addAnnotationGff3() {
    // Increase timeout
    this.timeout(10000);

    const { genomeId, genomeSeqId } = addTestGenome();
    const toAnnot = {
      fileName: 'assets/app/data/Bnigra_min.gff3',
      genomeName: 'Test Genome',
      annotationName: 'Test annotation',
      verbose: false,
      re_protein_capture: '^Bni(.*?)$',
      re_protein: 'testprot-$1'
    };

    // Add annotation.
    addAnnotation._execute(adminContext, toAnnot);

    const genes = Genes.find({ genomeId: genomeId }).fetch();
    const mRNA = genes[0].subfeatures[0]
    chai.assert.equal("testprot-|B01g000010.2N.1", mRNA.protein_id)

  });


  it('Should get the protein ID from the mRNA attribute', function addAnnotationGff3() {
    // Increase timeout
    this.timeout(10000);

    const { genomeId, genomeSeqId } = addTestGenome();
    const toAnnot = {
      fileName: 'assets/app/data/Bnigra_min.gff3',
      genomeName: 'Test Genome',
      annotationName: 'Test annotation',
      verbose: false,
      attr_protein: 'protid'
    };

    // Add annotation.
    addAnnotation._execute(adminContext, toAnnot);

    const genes = Genes.find({ genomeId: genomeId }).fetch();
    const mRNA = genes[0].subfeatures[0]
    chai.assert.equal("Bni|B01g000010.2N.1-protattr", mRNA.protein_id)

  });

    it('Should get the protein ID from the CDS attribute', function addAnnotationGff3() {
    // Increase timeout
    this.timeout(10000);

    const { genomeId, genomeSeqId } = addTestGenome();
    const toAnnot = {
      fileName: 'assets/app/data/Bnigra_min.gff3',
      genomeName: 'Test Genome',
      annotationName: 'Test annotation',
      verbose: false,
      attr_protein: 'protid2'
    };

    // Add annotation.
    addAnnotation._execute(adminContext, toAnnot);

    const genes = Genes.find({ genomeId: genomeId }).fetch();
    const mRNA = genes[0].subfeatures[0]
    chai.assert.equal("Bni|B01g000010.2N.1-protattr", mRNA.protein_id)
  });

});
