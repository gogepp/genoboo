import { InterproscanProcessor } from '/imports/api/genes/addInterproscan.js';
import { Meteor } from 'meteor/meteor';
import logger from '/imports/api/util/logger.js';
import {
  parseAttributeString, debugParseAttributeString, DBXREF_REGEX,
} from '/imports/api/util/util.js';

import { Genes } from '/imports/api/genes/geneCollection.js';

const logAttributeError = ({
  lineNumber, line, attributeString, error,
}) => {
  logger.warn(`Error line ${lineNumber}`);
  logger.warn(line.join('\t'));
  logger.warn(attributeString);
  logger.warn(debugParseAttributeString(attributeString));
  throw new Meteor.Error(error);
};

class ParseGff3File extends InterproscanProcessor {
  isProteinMatch = (type) => {
    if (type === 'protein_match') {
      return true;
    }
    return false;
  };

  parseAllAttributes = (attributes) => {
    if (attributes === undefined) {
      logger.warn('Undefined attributes:');
      return false;
    } else {
      let parseAttributes;
      try {
        parseAttributes = parseAttributeString(attributes);
      } catch (err) {
        throw new Meteor.Error(err);
      }
      return parseAttributes;
    }
  };

  parse = (line) => {
    // Check if the line is different of fasta sequence or others indications.
    if (!(line[0] === '#' || line.split('\t').length <= 1)) {
      const [seqId, source, type, start, end, score, , , attributeString, ] = line.split('\t');

      if (this.isProteinMatch(type)) {
        const attributes = this.parseAllAttributes(attributeString);
        if (attributes) {

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
              logger.warn(`Warning ! No sub-feature was found for ${seqId}.`)
            }

            this.currentContent = []
            this.currentDB = []
            this.currentOnto = []
          }

          if (this.currentGene == ""){
            return
          }

          const {
            Name,
            Dbxref: _dbxref = [],
            OntologyTerm = [],
            signatureDescription = [],
          } = attributes;

          const proteinDomain = {
            start, end, source, score, name: Name[0],
          };

          const Dbxref = _dbxref
            .filter((xref) => DBXREF_REGEX.combined.test(xref));

          const interproIds = Dbxref
            .filter((xref) => /InterPro/.test(xref))
            .map((interproId) => {
              const [, id] = interproId.split(':');
              return id;
            });

          if (interproIds.length) {
            proteinDomain.interproId = interproIds[0];
          } else {
            proteinDomain.interproId = 'Unintegrated signature';
          }

          if (signatureDescription.length) {
            proteinDomain.signature_desc = signatureDescription[0];
          }

          if (Dbxref.length) {
            proteinDomain.Dbxref = Dbxref;
            this.currentDB = this.currentDB.concat(Dbxref)
          }

          if (OntologyTerm.length) {
            proteinDomain.Ontology_term = OntologyTerm;
            this.currentOnto = this.currentOnto.concat(OntologyTerm)
          }

          this.currentContent.push(proteinDomain)
        }
      }
    }
  };
}

export default ParseGff3File;
