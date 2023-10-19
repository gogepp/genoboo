import { InterproscanProcessor } from '/imports/api/genes/addInterproscan.js';
import { Genes } from '/imports/api/genes/geneCollection.js';
import logger from '/imports/api/util/logger.js';

class ParseTsvFile extends InterproscanProcessor {
  parse = async (line) => {
    const [
      seqId,
      md5,
      length,
      analysis, // source (gff3)
      signatureAccession, // Name (gff3)
      signatureDescription, // signature_desc (gff3)
      start,
      stop, // end (gff3)
      score,
      status,
      date,
      interproAccession, // interproIds (gff3)
      interpro_description, // signature_desc (gff3)
      goAnnotation, // Ontology_term (referring to a GO association) (gff3)
      pathwaysAnnotations, // Dbxref (gff3)
    ] = line.split('\t');

    seqId = decodeURIComponent(seqId)

    // Add to bulk if protein changes
    if (seqId !== this.currentProt){
      if (seqId !== ""){
        this.addToBulk()
      }

      this.currentProt = seqId
      this.currentGene = ""
      let geneQuery = { $or: [{'subfeatures.ID': seqId}, {'subfeatures.protein_id': seqId}] }
      if (typeof this.annot !== "undefined"){
          geneQuery['annotationName'] = this.annot
      }
      let gene = Genes.findOne(geneQuery);
      if (typeof gene !== "undefined"){
        this.currentGene = gene.ID
        this.currentAnnotationName = gene.annotationName
      } else {
        logger.warn(logger.warn(`Warning ! No sub-feature was found for ${seqId}.`))
      }

      this.currentContent = []
      this.currentDB = []
      this.currentOnto = []
    }

    if (this.currentGene == ""){
      return
    }

    const proteinDomain = {
      start, end: stop, source: analysis, score, name: signatureAccession,
    };

    const ontologyTerm = (goAnnotation === undefined ? [] : goAnnotation.split('|'));
    const Dbxref = [];

    if (interproAccession.length && interproAccession.toString() !== '-') {
      const interproscanLabel = ''.concat('InterPro:', interproAccession);
      Dbxref.unshift(interproscanLabel);
      proteinDomain.interproId = interproAccession;
    } else {
      proteinDomain.interproId = 'Unintegrated signature';
    }

    if (signatureDescription.length && signatureDescription !== '-') {
      proteinDomain.signature_desc = signatureDescription;
    }

    if (Dbxref.length && Dbxref !== ['-']) {
      proteinDomain.Dbxref = Dbxref;
      this.currentDB = this.currentDB.concat(Dbxref)
    }

    if (ontologyTerm.length && ontologyTerm.toString() !== '-') {
      proteinDomain.Ontology_term = ontologyTerm;
      this.currentOnto = this.currentOnto.concat(ontologyTerm)
    }
    this.currentContent.push(proteinDomain)
  };
}

export default ParseTsvFile;
