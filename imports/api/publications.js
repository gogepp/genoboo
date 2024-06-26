import { Mongo } from 'meteor/mongo';
import { Meteor } from 'meteor/meteor';
import { Roles } from 'meteor/alanning:roles';
import { fetch } from 'meteor/fetch';
// jobqueue
import jobQueue from '/imports/api/jobqueue/jobqueue.js';
// genes
import { Genes } from '/imports/api/genes/geneCollection.js';
import { attributeCollection } from '/imports/api/genes/attributeCollection.js';
import { dbxrefCollection } from '/imports/api/genes/dbxrefCollection.js';
import { EditHistory } from '/imports/api/genes/edithistory_collection.js';
import { eggnogCollection } from '/imports/api/genes/eggnog/eggnogCollection.js';
import { hectarCollection } from '/imports/api/genes/hectar/hectarCollection.js';
import { interproscanCollection } from '/imports/api/genes/interproscan/interproscanCollection.js';
import { similarSequencesCollection } from '/imports/api/genes/alignment/similarSequenceCollection.js';
// orthogroups
import { orthogroupCollection } from '/imports/api/genes/orthogroup/orthogroupCollection.js';
// genomes
import { genomeCollection } from '/imports/api/genomes/genomeCollection.js';
// transcriptomes
import {
  ExperimentInfo,
  Transcriptomes,
} from '/imports/api/transcriptomes/transcriptome_collection.js';
// files
import { fileCollection } from '/imports/api/files/fileCollection.js';
// methods
import fetchDbxref from '/imports/api/methods/fetchDbxref.js';
// utilities
import { DBXREF_REGEX } from '/imports/api/util/util.js';
import logger from '/imports/api/util/logger.js'

function availableGenomes({ userId }) {
  const roles = Roles.getRolesForUser(userId);
  const genomeIds = genomeCollection
    .find({
      $or: [{ permission: { $in: roles } }, { isPublic: true }],
    })
    .map((genome) => genome._id);
  return genomeIds;
}

function hasOwnProperty(obj, property) {
  return Object.prototype.hasOwnProperty.call(obj, property);
}

// publish user role assignment https://github.com/Meteor-Community-Packages/meteor-roles
Meteor.publish(null, function() {
  const publication = this;
  if (!publication.userId) {
    publication.stop();
  }
  if (Roles.userIsInRole(publication.userId, 'admin')) {
    return Meteor.roleAssignment.find();
  }

  return Meteor.roleAssignment.find({ 'user._id': this.userId });
});

Meteor.publish({
  genomeFiles() {
    return fileCollection.collection.find({ type: 'genome' });
  },
  dbxref({ dbxrefId }) {
    const dbxref = dbxrefCollection.findOne({ dbxrefId });
    if (
      typeof dbxref === 'undefined'
      && !DBXREF_REGEX.go.test(dbxrefId) // temporarily disable GO lookup due to 504 responses
      // || dbxref.updated < new Date(Date.now() - 864e5)
    ) {
      fetchDbxref.call({ dbxrefId });
    }
    return dbxrefCollection.find({ dbxrefId });
  },
  genes({ query = {}, limit, sort = { ID: 1 } }) {
    const publication = this;
    const genomeIds = availableGenomes(publication);
    const queryGenomeIds = hasOwnProperty(query, 'genomeId')
      ? query.genomeId.$in.filter((genomeId) => genomeIds.includes(genomeId))
      : genomeIds;
    let transformedQuery = {};

    let config = Meteor.settings

    if ( query.query !== undefined && config.public.externalSearch && typeof config.externalSearchOptions === "object" && config.externalSearchOptions.url){
      let url = config.externalSearchOptions.url.replace(/,+$/, "") + "/";
      let paramsDict = {}
      let geneField = config.externalSearchOptions.gene_field ? config.externalSearchOptions.gene_field : "geneId"
      let annotationField = config.externalSearchOptions.annotation_field ? config.externalSearchOptions.annotation_field : ""
      if (config.externalSearchOptions.query_param){
        paramsDict[config.externalSearchOptions.query_param] = query.query
      } else {
        url += query.query
      }
      if (config.externalSearchOptions.field_param){
        paramsDict[config.externalSearchOptions.field_param] = geneField
        if (config.externalSearchOptions.annotation_field) {
          paramsDict[config.externalSearchOptions.field_param] += "," + annotationField
        }
      }

      if (config.externalSearchOptions.count_param){
        paramsDict[config.externalSearchOptions.count_param] = limit
      }

      let geneResults = []
      url = url + "?" + new URLSearchParams(paramsDict)
      const response = HTTP.get(url);
      if (response.statusCode === 200){
        geneResults = response.data.data.map(result => {
          if (config.externalSearchOptions.annotation_field){
            return {"ID": result._source[geneField], "annotationName": result._source[annotationField]}
          } else {
            return {"ID": result._source[geneField]}
          }
        })
      }
      delete query.query
      transformedQuery = {...query, genomeId: { $in: queryGenomeIds }, $or: geneResults}
    } else {
      transformedQuery = { ...query, genomeId: { $in: queryGenomeIds } };
    }
    return Genes.find(transformedQuery, { sort, limit });
  },
  singleGene({ geneId, transcriptId }) {
    const publication = this;

    const genomeIds = availableGenomes(publication);

    const query = { genomeId: { $in: genomeIds } };
    if (typeof geneId === 'undefined') {
      Object.assign(query, { 'subfeatures.ID': transcriptId });
    } else {
      Object.assign(query, {
        $or: [
          {'ID': geneId},
          { 'subfeatures.ID': geneId },
          { 'subfeatures.protein_id': geneId },
        ],
      });
    }

    return Genes.find(query);
  },
  users() {
    const publication = this;
    if (!publication.userId) {
      publication.stop();
    }

    if (Roles.userIsInRole(publication.userId, 'admin')) {
      return Meteor.users.find({});
    }
    return Meteor.users.find({ _id: publication.userId });
  },
  roles() {
    const publication = this;

    if (!publication.userId) {
      publication.stop();
    }

    return Meteor.roles.find({});
  },
  attributes() {
    const publication = this;

    const genomeIds = availableGenomes(publication);

    return attributeCollection.find({
      $or: [{ genomes: { $in: genomeIds } }, { allGenomes: true }],
    });
  },
  geneExpression(geneId, annotationName) {
    const publication = this;
    const roles = Roles.getRolesForUser(publication.userId);
    const permission = { $in: roles };
    const isPublic = true;

    const experimentIds = ExperimentInfo.find({
      $or: [{ permission }, { isPublic }],
    })
      .fetch()
      .map((experiment) => experiment._id);

    return Transcriptomes.find({
      geneId,
      annotationName,
      experimentId: {
        $in: experimentIds,
      },
    });
  },
  experimentInfo() {
    const publication = this;
    const roles = Roles.getRolesForUser(publication.userId);
    const permission = { $in: roles };
    const isPublic = true;
    return ExperimentInfo.find({
      $or: [{ permission }, { isPublic }],
    });
  },
  /* downloads (downloadId) {
    const publication = this;
    const roles = publication.userId ? Roles.getRolesForUser(publication.userId) : ['public'];
    return Downloads.findOne({ID: downloadId, permission: { $in: roles } });
  }, */
  jobQueue() {
    /*
    const publication = this;
    if (!publication.userId) {
      publication.stop();
    }
    */
    return jobQueue.find({});
  },
  genomes() {
    const publication = this;
    if (!publication.userId) {
      return genomeCollection.find({ isPublic: true });
    }
    const roles = Roles.getRolesForUser(publication.userId);
    return genomeCollection.find({
      $or: [{ permission: { $in: roles } }, { isPublic: true }],
    });
  },
  eggnog(query) {
    const eggnog = eggnogCollection.find({_id: query});
    return eggnog;
  },
  hectar(query) {
    const hectar = hectarCollection.find({_id: query});
    return hectar;
  },
  alignment(gene) {
    const diamond = similarSequencesCollection.find(
      {
        annotationName: gene.annotationName,
        $or: [
          { iteration_query: gene.ID },
          { iteration_query: { $in: gene.children } },
        ],
      },
    );
    return diamond;
  },
  interpro(gene){
    return interproscanCollection.find({gene_id: gene.ID, annotationName: gene.annotationName})
  },
  orthogroups(ID) {
    return orthogroupCollection.find({ _id: ID });
  },
  editHistory() {
    if (!this.userId) {
      this.stop();
    }
    return EditHistory.find({});
  },
});
