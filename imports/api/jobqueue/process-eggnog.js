import { EggnogProcessor } from '/imports/api/genes/eggnog/addEggnog.js';
import logger from '/imports/api/util/logger.js';
import jobQueue from './jobqueue.js';
import readline from 'readline';
import fs from 'fs';

jobQueue.processJobs(
  'addEggnog',
  {
    concurrency: 4,
    payload: 1,
  },
  async (job, callback) => {
    const { fileName, annot, goFile, silent = false } = job.data;
    logger.log(`Add ${fileName} eggnog file.`);

    const lineProcessor = new EggnogProcessor(annot, goFile);

    const rl = readline.createInterface({
      input: fs.createReadStream(fileName, 'utf8'),
      crlfDelay: Infinity,
    });

    const { size: fileSize } = await fs.promises.stat(fileName);
    let processedBytes = 0;
    let processedLines = 0;
    let nEggnog = 0;
    let options = silent ? {} : { echo: true }

    for await (const line of rl) {
      processedBytes += line.length + 1; // also count \n
      processedLines += 1;

      if ((processedLines % 100) === 0) {
        await job.progress(
          processedBytes,
          fileSize,
          options,
          (err) => {
            if (err) logger.error(err);
          },
        );
      }

      try {
        await lineProcessor.parse(line);
        nEggnog = lineProcessor.getNumberEggnog();
      } catch (err) {
        logger.error(err);
        job.fail({ err });
        callback();
      }
    }

    lineProcessor.createGOterms();

    logger.log(`Inserted ${nEggnog} EggNog`);
    job.done({ nInserted: nEggnog });
    callback();
  },
);
