import { Genes, GeneSchema, VALID_INTERVAL_TYPES } from '/imports/api/genes/geneCollection.js';
import { parseAttributeString } from '/imports/api/util/util.js';
import { isEmpty, partition, omit } from 'lodash';
import assert from 'assert';
import Papa from 'papaparse';
import fs from 'fs';

/**
 *
 * @class
 * @constructor
 * @public
 * @param {string} filename -
 * @param {string} genomeID -
 * @param {string} motif -
 * @param {string} keepdata -
 * @param {string} type -
 * @param {string} verbose -
 */
class AnnotationProcessor {
  constructor(filename, genomeID, motif, keepdata, type, verbose = false) {
    this.filename = filename;
    this.genomeID = genomeID;
    this.motif = motif;
    this.keepdata = keepdata;
    this.type = type;
    this.verbose = verbose;
  }
}

/**
 * Interval Class containing a single genomic interval. Every line in a gff3 file is an interval
 * @type {Interval}
 */
const Interval = class Interval {
  constructor({
    gffFields, genomeId, motif, keepdata, verbose, deriveIdFromParent = true,
  }) {
    const [seqid, source, type, start, end,
      _score, strand, phase, attributeString] = gffFields;
    const score = String(_score);
    const attributes = parseAttributeString(attributeString);

    if (!hasOwnProperty(attributes, 'ID')) {
      if (verbose) {
        logger.warn('The following line does not have the gff3 ID attribute:');
        logger.warn(`${gffFields.join('\t')}`);
      }
      if (deriveIdFromParent) {
        const derivedId = `${attributes.Parent}_${type}_${start}_${end}`;
        if (verbose) {
          logger.warn(`Assigning ID based on Parent attribute ${derivedId}`);
        }
        attributes.ID = [derivedId];
      }
    }

    if (!keepdata) {
      this.ID = motif;
    } else {
      // eslint-disable-next-line prefer-destructuring
      this.ID = attributes.ID[0];
      delete attributes.ID;
    }

    if (typeof attributes.Parent === 'undefined') {
      // top level feature
      Object.assign(this, {
        seqid, source, strand, genomeId,
      });
    } else {
      // sub feature
      this.phase = phase;
      this.parents = attributes.Parent;
      delete attributes.Parent;

      // Add motif / pattern.
      if (motif) {
        this.custom_id = this.ID.concat('', motif);
      }
      console.log(this);
    }

    Object.assign(this, {
      type, start, end, score, attributes,
    });

    logger.log(this);
  }
};

/**
 * Genemodel Class containing all intervals for a single gene.
 * @type {GeneModel}
 */
const GeneModel = class GeneModel {
  constructor({ intervals: _intervals, verbose }) {
    this.verbose = verbose;
    // filter valid interval types and set parent and children values
    const intervals = _intervals.filter(({ type }) => {
      const isValid = VALID_INTERVAL_TYPES.indexOf(type) >= 0;
      if (!isValid && verbose) {
        logger.warn(`intervals of type ${type} are not supported, skipping.`);
      }
      return isValid;
    });
    intervals.forEach((interval) => {
      if (interval.type === 'transcript') {
        interval.type = 'mRNA';
      }
      if (hasOwnProperty(interval, 'parents')) {
        interval.parents.forEach((parentId) => {
          const parentIndex = intervals.map((interval2) => interval2.ID).indexOf(parentId);
          const parent = intervals[parentIndex] || {};
          if (!hasOwnProperty(parent, 'children')) {
            parent.children = [];
          }
          parent.children.push(interval.ID);
        });
      }
    });

    // pull out gene interval
    // https://lodash.com/docs/4.17.10#partition
    const [genes, subfeatures] = partition(intervals, (interval) => typeof interval.parents === 'undefined');
    const gene = genes[0];
    Object.assign(this, gene);

    // set subfeatures
    this.subfeatures = subfeatures;
  }

  fetchGenomeSequence = () => {
    let shiftCoordinates = 10e99;
    const genomicRegion = genomeSequenceCollection.find({
      genomeId: this.genomeId,
      header: this.seqid,
      start: { $lte: this.end },
      end: { $gte: this.start },
    }).fetch().sort((a, b) => a.start - b.start).map((seqPart) => {
      shiftCoordinates = Math.min(shiftCoordinates, seqPart.start);
      return seqPart.seq;
    })
      .join('');
    if (genomicRegion.length > 0) {
      this.seq = genomicRegion.slice(this.start - shiftCoordinates - 1,
        this.end - shiftCoordinates);
      this.subfeatures.forEach((subfeature) => {
        subfeature.seq = genomicRegion.slice(subfeature.start - shiftCoordinates - 1,
          subfeature.end - shiftCoordinates);
      });
    } else if (this.verbose) {
      logger.warn(`Could not find sequence for gene ${this.ID} with seqid ${this.seqid}.`
       + ' Make sure the sequence IDs between the genome fasta and annotation gff3 are the same.');
    }
    return this;
  }

  validate = () => {
    const validationContext = GeneSchema.newContext();
    logger.log('The thing to validate :', this.dataFields);
    validationContext.validate(this.dataFields);
    return validationContext;
  }

  saveToDb = (bulkOp) => {
    if (this.type === 'gene') {
      this.fetchGenomeSequence();
      const validation = this.validate();
      logger.log('Valide ? :', validation.isValid());
      if (validation.isValid()) {
        bulkOp.insert(this.dataFields);
      } else if (this.verbose) {
        validation.validationErrors().forEach((err) => {
          logger.warn(`gene ${this.ID}, field ${err.name} is ${err.type}, got '${err.value}'`);
        });
      }
    } else if (this.verbose) {
      logger.warn(
        'Only top level features of type gene are supported, skipping',
      );
    }
  }

  get dataFields() {
    return omit(this,
      ['fetchGenomeSequence', 'validate', 'saveToDb', 'dataFields', 'verbose']);
  }
};


function hasOwnProperty(object, property) {
  return Object.prototype.hasOwnProperty.call(object, property);
}


/**
 * [description]
 * @param  {String} options.fileName           [description]
 * @param  {String} options.genomeeId        [description]
 * @param  {Object} options.genomeeSequences [description]
 * @param  {String} options.trackId            [description]
 * @return {Promise}                            [description]
 */
const gffFileToMongoDb = ({
  fileName, genomeId, motif, keepdata, type, verbose,
}) => new Promise((resolve, reject) => {
  if (!fs.existsSync(fileName)) {
    reject(new Meteor.Error(`${fileName} is not an existing file`));
  }
  const fileHandle = fs.readFileSync(fileName, { encoding: 'binary' });
  let intervals = [];
  let geneCount = 0;
  let lineNumber = 0;

  logger.log('Initializing bulk operation');
  const bulkOp = Genes.rawCollection().initializeUnorderedBulkOp();

  logger.log(`Start reading ${fileName}`);
  Papa.parse(fileHandle, {
    delimiter: '\t',
    dynamicTyping: true,
    skipEmptyLines: true,
    comments: '#',
    fastMode: true,
    error(error) {
      reject(error);
    },
    step(line) {
      lineNumber += 1;
      const gffFields = line.data;
      if (gffFields.length > 0 && gffFields[0] !== null) {
        try {
          assert(gffFields.length === 9,
            `line ${lineNumber} is not a correct gff line with 9 fields: ${gffFields} ${gffFields.length}`);
          const interval = new Interval({
            gffFields,
            genomeId,
            motif,
            keepdata,
            verbose,
          });

          if (typeof interval.parents === 'undefined') {
            if (!isEmpty(intervals)) {
              const gene = new GeneModel({ intervals, verbose });
              gene.saveToDb(bulkOp);
              geneCount += 1;
            }
            intervals = [];
          }

          intervals.push(interval);
        } catch (error) {
          reject(error);
        }
      }
    },
    complete() {
      try {
        if (!isEmpty(intervals)) {
          logger.log('constructing final gene model');
          const gene = new GeneModel({ intervals, verbose });
          logger.log('coucou mon pote ?');
          gene.saveToDb(bulkOp);
          logger.log('coucou mon pote 2');
          geneCount += 1;
        }

        if (bulkOp.s.currentBatch
              && bulkOp.s.currentBatch.operations.length) {
          logger.log('Executing bulk operation');
          const result = bulkOp.execute();
          logger.log('coucou mon pote 3');

          genomeCollection.update({
            _id: genomeId,
          }, {
            $set: {
              annotationTrack: {
                name: fileName.split('/').pop(),
              },
            },
          });

          logger.log(`Finished inserting ${geneCount} genes`);

          resolve(result);
        } else {
          logger.warn('Empty bulk operation');
          throw new Meteor.Error('Empty bulk operation');
        }
      } catch (error) {
        reject(error);
      }
    },
  });
});
