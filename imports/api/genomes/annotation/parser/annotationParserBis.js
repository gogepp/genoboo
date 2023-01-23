import logger from '../../../util/logger';
import { parseAttributeString } from '../../../util/util';
import { genomeSequenceCollection } from '../../genomeCollection';
import { Genes } from '../../../genes/geneCollection';

/**
 * Read the annotation file in gff3 format. Add to the gene collection of
 * mongoDB all the information about the genes. Each gene is structured with a
 * top level which is the general information of the gene and
 * sub-features which includes mRNA, exons, cds ...
 * @class
 * @constructor
 * @public
 * @param {String} genomeID - The mongDB ID of a genome collection.
 */
class AnnotationProcessorBis {
  constructor(genomeID) {
    logger.log('test Annotation procesor bis');
    this.genomeID = genomeID;
    this.verbose = true;

    // Initialize gene bulk operation (mongoDB).
    this.geneBulkOperation = Genes.rawCollection().initializeUnorderedBulkOp();

    // Object of a gene with the following hierarchy: gene → transcript → exon
    // ...
    this.geneLevelHierarchy = {};

    // Store the index (value) and the ID of the parents (key) of the gene and
    // the subfeatures in order to find the children of each one with an
    // algorithm between O(1) and O(log(n)) with dict[key] e.g
    // (this.IDtree[parents[0]] in addChildren function).
    this.IDtree = {};
    this.indexIDtree = 0;
  }

  /**
   * From the attribute of a gff(3) (last field) return the identifier.
   * In the rare case where the identifier is not present, assign the parent
   * identifier.
   * @function
   * @param {Object} attributesGff - The attributes of a gff (last field) in a
   * key:value object. (e.g: attributes : {ID: [ 'BniB01g000050.2N.1.exon12' ],
   * Parent: [ 'BniB01g000050.2N.1' ]}
   * @returns {String} The identifier (ID).
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
   * From the attributes of a gff(3) (last field), return the parent(s).
   * @function
   * @static
   * @param {Object} attributesGff - The attributes of a gff (last field) in a
   * key:value object. (e.g: attributes : {ID: [ 'BniB01g000050.2N.1.exon12' ],
   * Parent: [ 'BniB01g000050.2N.1' ]}
   * @returns {Array} The list of parent(s).
   */
  static getParents = (attributesGff) => {
    const attributesKeys = Object.keys(attributesGff);
    let parents = [];
    attributesKeys.forEach((key) => {
      if (key === 'Parent') {
        parents = attributesGff[key];
      }
    });
    return parents;
  };

  /**
   * Find the raw sequence from the genome collection of mongodb.
   * @function
   * @param {String} seqid - The name of the sequence where the feature is
   * located (first field of the gff).
   * @param {Number} start - Genomic start of the feature.
   * @param {Number} end - Genomic end of the feature.
   * @returns {String} Return the complete sequence.
   */
  findSequenceGenome = (seqid, start, end) => {
    let shiftCoordinates = 10e99;

    // Request the genome collection in mongoDB.
    const genomicRegion = genomeSequenceCollection.find(
      {
        genomeId: this.genomeID,
        header: seqid,
        start: { $lte: end },
        end: { $gte: start },
      },
    ).fetch().sort((a, b) => a.start - b.start).map((seqPart) => {
      shiftCoordinates = Math.min(shiftCoordinates, seqPart.start);
      return seqPart.seq;
    })
      .join('');

    return [genomicRegion, shiftCoordinates];
  };

  /**
   * Splits the sequence (e.g: for mRNA, exons, cds... ).
   * @function
   * @param {String} seq - The complete sequence.
   * @param {Number} shiftCoordiantes - .
   * @param {Number} start - Genomic start of the feature.
   * @param {Number} end - Genomic end of the feature.
   * @returns {String} Return the split sequence.
   */
  splitRawSequence = (seq, shiftCoordinates, start, end) => {
    let sequence;

    if (seq.length > 0) {
      sequence = seq.slice(start - shiftCoordinates - 1, end - shiftCoordinates);
    } else if (this.verbose) {
      logger.warn(`Could not find sequence for gene ${this.ID} with seqid ${this.seqid}.`
                  + ' Make sure the sequence IDs between the genome fasta and annotation gff3 are the same.');
    }
    return sequence;
  };

  /**
   * To avoid duplicates we remove the keys values of the ID identifier and the
   * parents.
   * @function
   * @static
   * @param {Object} attributesGff - The attributes of a gff (last field) in a
   * key:value object. (e.g: attributes : {ID: [ 'BniB01g000050.2N.1.exon12' ],
   * Parent: [ 'BniB01g000050.2N.1' ]}
   * @returns {Object} Return attributes object without his ID and Parent keys.
   */
  static filterAttributes = (attributesGff) => {
    const filteredAtt = Object.fromEntries(
      Object.entries(attributesGff).filter(([key]) => key !== 'ID' && key !== 'Parent'),
    );
    return filteredAtt;
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
   * Stores the ID of the parents (key) of the gene and subfeatures and
   * increments the index (value - position of the gene or subfeature in the
   * array) in order to find the children of each one with an algorithm between
   * O(1) and O(log(n)) later with the addChildren function.
   * @function
   * @param {Boolean} isInit - True if the identifier initializes a gene (top
   * level), false if it is a sub feature.
   * @param {String} ID - The identifier.
   */
  setIDtree = (isInit, ID) => {
    if (isInit) {
      // Top level.
      this.IDtree[ID] = -1;
    } else {
      // subfeatures.
      this.IDtree[ID] = this.indexIDtree;

      // Increment the index.
      this.indexIDtree += 1;
    }
  };

  /**
   * Find the associated parent and complete the 'children' feature.
   * @function
   * @param {String} IDsubfeature -The identifier.
   * @param {Array} parents - The list of parents.
   */
  addChildren = (IDsubfeature, parents) => {
    // Find the parent with an algorithm between O(1) and O(log(n)).
    const indexFeature = this.IDtree[parents[0]];
    if (indexFeature === -1 && typeof indexFeature !== 'undefined') {
      // top level.
      if (!Object.prototype.hasOwnProperty.call(this.geneLevelHierarchy, 'children')) {
        this.geneLevelHierarchy.children = [];
      }
      this.geneLevelHierarchy.children.push(IDsubfeature);
    } else {
      // subfeatures
      if (!Object.prototype.hasOwnProperty.call(this.geneLevelHierarchy.subfeatures[indexFeature], 'children')) {
        this.geneLevelHierarchy.subfeatures[indexFeature].children = [];
      }
      this.geneLevelHierarchy.subfeatures[indexFeature].children.push(IDsubfeature);
    }
  };

  /**
   * Complete features and subfeatures of gene.
   * @function
   * @param {Boolean} isSubfeature - Define if the sub-features are mRNA,
   * exons, cds ...
   * @param {Object} features - The 9 fields of a line in gff(3) format.
   */
  completeGeneHierarchy = (isSubfeature, features) => {
    if (!isSubfeature) {
      // Initialize the gene with the features but without the attributes that
      // will be filtered and added later.
      const { attributes, ...featuresWithoutAttributes } = features;
      this.geneLevelHierarchy = featuresWithoutAttributes;

      // Init IDtree.
      this.setIDtree(true, features.ID);

      // Get raw sequence.
      const [rawSequence, shiftCoordinates] = this.findSequenceGenome(
        features.seqid,
        features.start,
        features.end,
      );

      // Get sequence.
      const sequence = this.splitRawSequence(
        rawSequence,
        shiftCoordinates,
        features.start,
        features.end,
      );

      // Add sequence to the top level.
      if (typeof sequence !== 'undefined') {
        this.geneLevelHierarchy.seq = sequence;
      }

      // Filter and add attributes to avoid duplication.
      const attributesFiltered = this.constructor.filterAttributes(features.attributes);
      this.geneLevelHierarchy.attributes = attributesFiltered;
    } else {
      // Create an array if not exists for the subfeatures (exons, cds ...) of
      // the gene.
      if (typeof this.geneLevelHierarchy.subfeatures === 'undefined') {
        this.geneLevelHierarchy.subfeatures = [];
      }

      // Get all parents from the attributes field.
      const parentsAttributes = this.constructor.getParents(features.attributes);

      // Get raw sequence. /!\ do the request once only ??
      const [rawSequence, shiftCoordinates] = this.findSequenceGenome(
        features.seqid,
        features.start,
        features.end,
      );

      // Get the sequence (call a mongoDB fetch function, can be reduce)
      const sequence = this.splitRawSequence(
        rawSequence,
        shiftCoordinates,
        features.start,
        features.end,
      );

      // Complete IDtree.
      this.setIDtree(false, features.ID);

      // Filter attributes (exclude ID, parents keys).
      const filteredAttr = this.constructor.filterAttributes(features.attributes);

      // Add subfeatures.
      this.geneLevelHierarchy.subfeatures.push({
        ID: features.ID,
        type: features.type,
        start: features.start,
        end: features.end,
        phase: features.phase,
        score: features.score,
        parents: parentsAttributes,
        attributes: filteredAttr,
        seq: sequence,
      });

      // Add children.
      this.addChildren(features.ID, parentsAttributes);
    }
  };

  /**
   * Initialize a gene (top level).
   * @function
   */
  initGeneHierarchy = (features) => this.completeGeneHierarchy(false, features);

  /**
   * Adds the sub-features of a gene (sub-features level).
   * @function
   */
  addSubfeatures = (features) => this.completeGeneHierarchy(true, features);

  /**
   * Read line by line the annotation file in gff3 format.
   * @function
   * @param {Array} line - The line to parse and tab split by Papa Parse.
   */
  parse = (line) => {
    if (this.constructor.isNineFields(line)) {
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
      ] = line;

      // Parse gff3 attribute column into key:value object. e.g:
      // attributes : {
      //   ID: [ 'BniB01g000050.2N.1.exon12' ],
      //   Parent: [ 'BniB01g000050.2N.1' ]
      // }
      const attributesGff = parseAttributeString(attributeString);

      // Get ID (identifier);
      const identifier = this.getIdentifier(attributesGff);

      //
      const features = {
        ID: identifier,
        genomeId: this.genomeID,
        seqid: seqidGff,
        source: sourceGff,
        type: typeGff,
        start: Number(startGff),
        end: Number(endGff),
        score: _scoreGff,
        strand: strandGff,
        phase: phaseGff,
        attributes: attributesGff,
      };

      // Except for the first gene, as long as there is no new gene (3rd
      // field) we complete and store the information.
      // For each new gene the information is stored in a bulk operation
      // mongodb.
      logger.log('type: ', typeGff);
      if (typeGff === 'gene') {
        // Top level feature of the gene.
        if (this.constructor.isEmpty(this.geneLevelHierarchy)) {
          logger.log('Init to level of gene data');
          this.initGeneHierarchy(features);
        } else {
          logger.log('Cool a new gene !');
          // Add to bulk operation.
          this.geneBulkOperation.find({
            ID: this.geneLevelHierarchy.ID,
          }).upsert().update(
            { $set: this.geneLevelHierarchy },
            { upsert: false, multi: true },
          );
          logger.log('bulk mongodb done ?');

          // Execute bulk operation ???
          this.geneBulkOperation.execute();

          // Reset values.
          this.indexIDtree = 0;
          this.IDtree = {};
          this.geneLevelHierarchy = {};
        }
      } else {
        // The other hierarchical levels (e.g: exons, cds, ...) of the gene.
        this.addSubfeatures(features);
      }
    } else {
      logger.warn(`${line} is not a correct gff line with 9 fields: ${line.length}`);
    }
  };

  /**
   * Save the gene annotation in the collection.
   * @function
   */
  lastAnnotation = () => {
    // logger.log('The last thing to do for annotation :');
    // logger.log(JSON.stringify(this.geneLevelHierarchy, null, 4));
    logger.log('the last bulk operation');
    this.geneBulkOperation.find({
      ID: this.geneLevelHierarchy.ID,
    }).upsert().update(
      { $set: this.geneLevelHierarchy },
      { upsert: false, multi: true },
    );
    this.geneBulkOperation.execute();
  };
}

export default AnnotationProcessorBis;
