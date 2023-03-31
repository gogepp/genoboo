import XmlProcessor from '/imports/api/genes/alignment/parser/xmlParser.js';
import PairwiseProcessor from '/imports/api/genes/alignment/parser/pairwiseParser.js';
import logger from '/imports/api/util/logger.js';
import jobQueue from './jobqueue.js';
import readline from 'readline';
import XmlFlow from 'xml-flow';
import fs from 'fs';

jobQueue.processJobs(
  'addDiamond',
  {
    concurrency: 4,
    payload: 1,
  },
  async (job, callback) => {
    const { fileName, parser, program, algorithm, matrix, database } = job.data;
    logger.log(`Add ${fileName} diamond file.`);

    // Different parser for the xml file.
    if (parser === 'xml') {
      const stream = fs.createReadStream(fileName);
      const xml = new XmlFlow(stream, { normalize: false });
      const lineProcessor = new XmlProcessor(program, algorithm, matrix, database);
      const tag = 'blastoutput';

      xml.on(`tag:${tag}`, async (obj) => {
        try {
          const { ok, writeErrors, nInserted, nUpserted } = await lineProcessor.parse(obj);
          job.done({ ok, writeErrors, nInserted: nInserted + nUpserted });
          logger.log('Xml file reading finished !');
          callback();
        } catch (err) {
          logger.error(err);
          job.fail({ err });
          callback();
        }
      });

      xml.on('error', async (error) => {
        logger.error(error);
        job.fail({ error });
        callback();
      });
    } else if (parser === 'txt') {
      logger.log('Blast pairwise parse on Diamond.');

      const lineReader = readline.createInterface({
        input: fs.createReadStream(fileName, 'utf8'),
      });

      const lineProcessor = new PairwiseProcessor(program, algorithm, matrix, database);

      for await (const line of lineReader) {
          try {
            await lineProcessor.parse(line);
          } catch (error) {
            logger.error(error);
            job.fail({ error });
            callback();
          }
      };

      try {
          logger.log('File reading finished, start bulk insert');
          const { ok, writeErrors, nInserted, nUpserted } = await lineProcessor.lastPairwise();
          job.done({ ok, writeErrors, nInserted: nInserted + nUpserted });
      } catch (error) {
          logger.error(error);
          job.fail({ error });
      }
      callback();
    }
  },
);
