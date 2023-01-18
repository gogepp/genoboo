import logger from '../../../util/logger';
import { parseAttributeString } from '../../../util/util';

/**
 *
 * @class
 * @constructor
 * @public
 * @param {String} genomeID - The mongdb ID of a genome collection.
 */
class AnnotationProcessorBis {
  constructor(genomeID) {
    logger.log('test Annotation procesor bis');
    this.genomeID = genomeID;
    this.verbose = true;

    // Object of a gene with the following hierarchy: gene → transcript → exon
    // ...
    this.geneLevelHierarchy = {};
  }

  /**
   * From the attribute of a gff(3) (last field) return the identifier.
   * In the rare case where the identifier is not present, assign the parent
   * identifier.
   * @function
   * @param {Object} attributesGff - The last field of a line in gff3 format splitted.
   * @return {String} - The identifier (ID).
   */
  getIdentifier = (attributesGff) => {
    if (!Object.prototype.hasOwnProperty.call(attributesGff, 'ID')) {
      if (this.verbose) {
        logger.warn('The line does not have the gff3 ID attribute:');
      }
      // const derivedId = `${attributes.Parent}_${type}_${start}_${end}`;
    }
    return attributesGff.ID[0];
  };

  /**
   * Checks if the gff(3) format contains 9 fields per line.
   * @function
   * @static
   * @param {Array} arrayLine - One line (of a gff) split by tab. (e.g: ) ['B1',
   * 'AAFC_GIFS', 'mRNA', '21550', '22460', '.', '-', '.',
   * 'ID=BniB01g000040.2N.1;Name=BniB01g000040.2N.1;Parent=BniB01g000040.2N']
   * @returns {Boolean} Return true if the line has 9 fields.
   */
  static isNineFields = (arrayLine) => {
    if (!arrayLine.length === 9) {
      return false;
    }
    return true;
  };

  /**
   * Simple function that checks if the dictionary is empty.
   * @function
   * @static
   * @param {Object} obj - The dictionary.
   * @returns {Boolean} Return true if the dictionary is empty.
   */
  static isEmpty = (obj) => Object.keys(obj).length === 0;

  /**
   * Complete features and subfeatures of gene.
   * @function
   * @param {Boolean} isSubfeature -
   * @param {Array} features -
   */
  completeGeneHierarchy = (isSubfeature, features) => {
    if (!isSubfeature) {
      // Init gene (top level) with all features.
      this.geneLevelHierarchy = features;
    } else {
      // Create an array if not exists for the subfeatures (exons, cds ...) of
      // the gene.
      if (typeof this.geneLevelHierarchy.subfeatures === 'undefined') {
        this.geneLevelHierarchy.subfeatures = [];
      }

      // Add certain subfeatures (exclude seqid and genomeId).
      this.geneLevelHierarchy.subfeatures.push({
        ID: features.ID,
        phase: features.phase,
        type: features.type,
        start: features.start,
        end: features.end,
        score: features.score,
        attributes: features.attributes,
      });
    }
  };

  /**
   * Read line by line.
   * @function
   * @param {String} line - The line to parse.
   */
  parse = (line) => {
    if (line.length !== 0 && line.charAt(0) !== '#') {
      const spitGffLine = line.split('\t');

      if (this.constructor.isNineFields(spitGffLine)) {
        // The 9 fields of gff.
        const [
          seqidGff,
          sourceGff,
          typeGff,
          startGff,
          endGff,
          _scoreGff,
          strandGff,
          phaseGff,
          attributeString,
        ] = spitGffLine;

        // Parse gff3 attribute column into key:value object. e.g:
        // attributes : {
        //   ID: [ 'BniB01g000050.2N.1.exon12' ],
        //   Parent: [ 'BniB01g000050.2N.1' ]
        // }
        const attributesGff = parseAttributeString(attributeString);

        // Get ID (identifier);
        const identifier = this.getIdentifier(attributesGff);

        const features = {
          ID: identifier,
          genomeId: this.genomeID,
          seqid: seqidGff,
          source: sourceGff,
          type: typeGff,
          start: startGff,
          end: endGff,
          score: _scoreGff,
          strand: strandGff,
          phase: phaseGff,
          attributes: attributesGff,
        };

        // Except for the first gene, as long as there is no new gene (3rd
        // field) we store the information.
        // For each new gene the information is stored in a bulk operation
        // mongodb.
        logger.log('type: ', typeGff);
        if (typeGff === 'gene') {
          if (this.constructor.isEmpty(this.geneLevelHierarchy)) {
            logger.log('Init to level of gene data');
            this.completeGeneHierarchy(false, features);
          } else {
            logger.log('bulk mongodb');
            // Reset the gene hierarchy.
            this.geneLevelHierarchy = {};
            logger.log(this.constructor.isEmpty(this.geneLevelHierarchy));
          }
        } else {
          // The other hierarchical levels (e.g: exons, cds, ...) of the gene.
          this.completeGeneHierarchy(true, features);
          logger.log('after :', this.geneLevelHierarchy);
        }
      } else {
        logger.warn(`${line} is not a correct gff line with 9 fields: ${spitGffLine.length}`);
      }
    }
  };
}

export default AnnotationProcessorBis;
