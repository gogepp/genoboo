import readline from 'readline';
import fs from 'fs';
//import AnnotationProcessor from '../genomes/annotation/parser/annotationParser';
import AnnotationProcessorBis from '../genomes/annotation/parser/annotationParserBis';
import logger from '../util/logger';
import jobQueue from './jobqueue';

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

    const lineProcessor = new AnnotationProcessorBis(genomeId);

    lineReader.on('line', async (line) => {
      try {
        lineProcessor.parse(line);
      } catch (error) {
        logger.error(error);
        job.fail({ error });
        callback();
      }
    });

    lineReader.on('close', async () => {
      try {
        logger.log('File reading finished, start bulk insert');
        lineProcessor.lastAnnotation();
        job.done();
      } catch (error) {
        logger.error(error);
        job.fail({ error });
      }
      callback();
    });
  },
);
