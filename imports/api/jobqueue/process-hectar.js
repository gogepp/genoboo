import { HectarProcessor } from '/imports/api/genes/hectar/addHectar.js';
import logger from '/imports/api/util/logger.js';
import jobQueue from './jobqueue.js';
import readline from 'readline';
import fs from 'fs';

jobQueue.processJobs(
  'addHectar',
  {
    concurrency: 4,
    payload: 1,
  },
  async (job, callback) => {
    const { fileName } = job.data;
    logger.log(`Add ${fileName} hectar file.`);

    const lineProcessor = new HectarProcessor();

    const rl = readline.createInterface({
      input: fs.createReadStream(fileName, 'utf8'),
      crlfDelay: Infinity,
    });

    const { size: fileSize } = await fs.promises.stat(fileName);
    let processedBytes = 0;
    let processedLines = 0;
    let nHectar = 0;

    for await (const line of rl) {
      processedBytes += line.length + 1; // also count \n
      processedLines += 1;

      if ((processedLines % 100) === 0) {
        await job.progress(
          processedBytes,
          fileSize,
          { echo: true },
          (err) => {
            if (err) logger.error(err);
          },
        );
      }

      try {
        await lineProcessor.parse(line);
        nHectar = lineProcessor.getNumberHectar();
      } catch (err) {
        logger.error(err);
        job.fail({ err });
        callback();
      }
    }
    logger.log(`Inserted ${nHectar} Hectar`);
    job.done({ nInserted: nHectar });
    callback();
  },
);
