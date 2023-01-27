import fs from 'fs';
import Papa from 'papaparse';
import AnnotationProcessor from '../genomes/annotation/parser/annotationParserGff3';
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

    logger.log('file :', fileName);
    logger.log('name :', genomeName);
    logger.log('motif :', motif);
    logger.log('type :', type);
    logger.log('keep :', keep);
    logger.log('overwrite :', overwrite);
    logger.log('verbose :', verbose);

    const lineProcessor = new AnnotationProcessor(
      fileName,
      genomeId,
      overwrite,
      verbose,
    );

    if (motif !== '' && type !== '') {
      try {
        logger.log('coucou 1');
        lineProcessor.createMotif(motif, type);
      } catch (err) {
        job.fail();
      }
    }

    logger.log('Le motif :', lineProcessor.motif);

    const fileHandle = fs.readFileSync(fileName, { encoding: 'binary' });

    Papa.parse(fileHandle, {
      delimiter: '\t',
      dynamicTyping: true,
      skipEmptyLines: true,
      comments: '#',
      fastMode: true,
      error(err) {
        logger.error(err);
        job.fail({ err });
        callback();
      },
      step(line) {
        try {
          lineProcessor.parse(line.data);
        } catch (err) {
          logger.log(err);
          job.fail({ err });
          callback();
        }
      },
      complete() {
        try {
          lineProcessor.lastAnnotation();
          const nAnnotation = lineProcessor.getNumberAnnotation();
          job.done({ nInserted: nAnnotation });
        } catch (err) {
          logger.log(err);
          job.fail({ err });
          callback();
        }
        callback();
      },
    });
  },
);
