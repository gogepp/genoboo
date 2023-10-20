import ParseGff3File from '/imports/api/genes/parseGff3Interproscan.js';
import ParseTsvFile from '/imports/api/genes/parseTsvInterproscan.js';
import logger from '/imports/api/util/logger.js';
import jobQueue from './jobqueue.js';
import readline from 'readline';
import fs from 'fs';

jobQueue.processJobs(
  'addInterproscan',
  {
    concurrency: 4,
    payload: 1,
  },
  async (job, callback) => {
    const { fileName, parser, annot } = job.data;
    logger.log(`Add ${fileName} interproscan file.`);

    const rl = readline.createInterface({
      input: fs.createReadStream(fileName, 'utf8'),
      crlfDelay: Infinity,
    });

    let lineProcessor;
    switch (parser) {
      case 'tsv':
        logger.log('Format : .tsv');
        lineProcessor = new ParseTsvFile(annot);
        break;
      case 'gff3':
        logger.log('Format : .gff3');
        lineProcessor = new ParseGff3File(annot);
        break;
    }

    let lineNbr = 0;

    for await (const line of rl) {
      lineNbr += 1;

      if (lineNbr % 10000 === 0) {
        logger.debug(`Processed ${lineNbr} lines`);
      }

      try {
        await lineProcessor.parse(line);
      } catch (err) {
        logger.error(err);
        job.fail({ err });
        callback();
      }
    };

    try {
      logger.log('File reading finished');
      const { nUpserted } = await lineProcessor.finalize();
      const nInserted = nUpserted;
      logger.log(`Matched to ${nInserted} protein domain(s)`);
      logger.log("Updating related genes")
      await lineProcessor.updateGenes()
      job.done({ nInserted });
    } catch (err) {
      logger.error(err);
      job.fail({ err });
    }
    callback();
  },
);
