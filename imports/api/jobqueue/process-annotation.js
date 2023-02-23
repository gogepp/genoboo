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
      suffix,
      re_protein,
      re_protein_capture,
      keep,
      overwrite,
      type,
      verbose,
    } = job.data;
    logger.log(`Adding annotation file "${fileName}" to genome "${genomeName}"`);

    if(verbose){
      logger.log('file :', fileName);
      logger.log('name :', genomeName);
      logger.log('suffix :', suffix);
      logger.log('re_protein :', re_protein);
      logger.log('re_protein_capture', re_protein_capture);
      logger.log('type :', type);
      logger.log('keep :', keep);
      logger.log('overwrite :', overwrite);
      logger.log('verbose :', verbose);
    }

    const lineProcessor = new AnnotationProcessor(
      fileName,
      genomeId,
      re_protein,
      re_protein_capture,
      overwrite,
      verbose,
    );

    if (suffix !== undefined && type !== '') {
      try {
        lineProcessor.createMotif(suffix, type);
      } catch (err) {
        logger.error(err);
        job.fail({ err });
        callback();
        return;
      }
    }

    if (!fs.existsSync(fileName)) {
      logger.error('The file cannot be found');
      job.fail({ err: 'The file cannot be found !!' });
      callback();
      return;
    }

    const fileHandle = fs.readFileSync(fileName, { encoding: 'binary' });

    Papa.parse(fileHandle, {
      delimiter: '\t',
      dynamicTyping: true,
      skipEmptyLines: true,
      comments: '#',
      fastMode: true,
      step(line, parser) {
        try {
          lineProcessor.parse(line.data);
        } catch (err) {
          logger.error(err);
          // stop streaming.
          parser.abort();
        }
      },
      complete(result) {
        if (result.meta.aborted === true) {
          job.fail();
        } else {
          try {
            lineProcessor.lastAnnotation();
            const nAnnotation = lineProcessor.getNumberAnnotation();
            job.done({ nInserted: nAnnotation });
          } catch (err) {
            logger.error(err);
            job.fail({ err });
          }
        }
        callback();
      },
    });
  },
);
