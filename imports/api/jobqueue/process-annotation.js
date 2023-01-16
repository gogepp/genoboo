import logger from '/imports/api/util/logger.js';
import jobQueue from './jobqueue.js';
import readline from 'readline';
import fs from 'fs';

jobQueue.processJobs(
  'addAnnotation',
  {
    concurrency: 4,
    payload: 1,
  },
  async (job, callback) => {
    const {
      fileName,
      genomeName,
      genomeId,
      motif,
      keep,
      overwrite,
      type,
      verbose,
    } = job.data;
    logger.log(`Adding annotation file "${fileName}" to genome "${genomeName}"`);

    // Keed ID field or overwrite it.
    const keepIdField = (keep === true ? keep : overwrite);

    logger.log('file :', fileName);
    logger.log('name :', genomeName);
    logger.log('motif :', motif);
    logger.log('type :', type);
    logger.log('keep :', keep);
    logger.log('overwrite :', overwrite);
    logger.log('verbose :', verbose);

    const lineReader = readline.createInterface({
      input: fs.createReadStream(fileName, 'utf8'),
    });

    // test.
    job.done();
    callback();

    const lineProcessor = new AnnotationProcessor(program, algorithm, matrix, database);

    // lineReader.on('line', async (line) => {
    //   try {
    //     lineProcessor.parse(line);
    //   } catch (error) {
    //     logger.error(error);
    //     job.fail({ error });
    //     callback();
    //   }
    // });

    // lineReader.on('close', async () => {
    //   try {
    //     logger.log('File reading finished, start bulk insert');
    //     lineProcessor.lastPairwise();
    //     job.done();
    //   } catch (error) {
    //     logger.error(error);
    //     job.fail({ error });
    //   }
    //   callback();
    // });
  },
);
