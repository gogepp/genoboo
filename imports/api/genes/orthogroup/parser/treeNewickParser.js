import { orthogroupCollection } from '/imports/api/genes/orthogroup/orthogroupCollection.js';
import { Genes } from '/imports/api/genes/geneCollection.js';
import { genomeCollection } from '/imports/api/genomes/genomeCollection.js';
import logger from '/imports/api/util/logger.js';
import fs from 'fs';
import path from 'path'

/**
 * Read the newick trees, remove the prefixes from OrthoFinder and add the
 * information to the 'orthologroups' collection (mongodb).
 * @class
 * @constructor
 * @public
 */
class NewickProcessor {
  constructor(annotations) {
    this.genesDb = Genes.rawCollection();
    this.nOrthogroups = 0;
    this.annotations = annotations;
  }

  /**
   * Function that returns the total number of insertions or updates in the
   * orthogroups collection.
   * @function
   * @return {Number} Return the total number of insertions or updates of
   * orthogroups.
   */
  getNumberOrthogroups() {
    return this.nOrthogroups;
  }

  /**
   * Function that reads trees in newick format and returns the tree, all the
   * names of each node and the size.
   * @function
   * @param {String} newickFile - The tree in newick format (e.g
   * (((Citrus_sinensis_PAC-18136225:0.464796,(Ano...).
   * @param {Array} prefixes - Array of prefixes
   * @return {Object} Return the tree.
   * @return {Array} Return the root name and the name of each leaf node.
   * @return {Number} Return the tree size.
   * @return {Object} Return genome id with the gene count.
   * @return {Number} Return number of unidentified genes.
   */
   parseNewick = async (newickFile, prefixes) => {
       // Adapted from Jason Davies https://github.com/jasondavies/newick.js
       const ancestors = [];
       const tokens = newickFile.split(/\s*(;|\(|\)|,|:)\s*/);
       const geneIds = [];
       const genomes = {}
       let tree = {};
       let subtree = {};
       let nNodes = 0;
       let unknown = 0

       for (let tokenIndex=0; tokenIndex<tokens.length; tokenIndex++) {
         let gene
         let geneName
         let token = tokens[tokenIndex];
         switch (token) {
           case '(': // new subtree (children of current tree)
             subtree = {};
             tree.children = [subtree];
             ancestors.push(tree);
             tree = subtree;
             break;
           case ',': // another branch
             subtree = {};
             ancestors[ancestors.length - 1].children.push(subtree);
             tree = subtree;
             break;
           case ')': // optional name next
             tree = ancestors.pop();
             break;
           case ':': // optional length next
             break;
           default:
             const previousToken = tokens[tokenIndex - 1];
             if (previousToken === '(' || previousToken === ')' || previousToken === ',') {
               tree.name = token;
               nNodes += 1;
               if (token.length > 0) {
                 ({gene, geneName} = await this.getGeneId(prefixes, token))
                 if ( gene ){
                   genomes[gene.genomeId] = genomes[gene.genomeId] ? genomes[gene.genomeId] + 1 : 1
                   geneIds.push(gene.ID);
                   tree.genomeId = gene.genomeId
                   tree.geneId = gene.ID
                 } else {
                   unknown += 1
                 }
                 tree.name = geneName;
               }
             } else if (previousToken === ':') {
               tree.branchLength = parseFloat(token);
             }
         }
       };
       return {
         tree,
         geneIds,
         treeSize: 0.5 * (nNodes + 1), // geneIds.length
         genomes,
         unknown
       };
     };

  /**
   * Function that removes the prefixes of orthofinders on the genes of the tree
   * and returns the list of genes.
   * (e.g Citrus_sinensis_orange1.1g040632m.v1.1 -> orange1.1g040632m.v1.1)
   * @function
   * @param {Array} prefixes - The list of prefixes.
   * @param {Array} genesids - The gene list.
   * @return {Array} The list of genes without their prefixes.
   */

   getGeneId = async (prefixes, geneIdEncoded) => {
       let geneid = decodeURIComponent(geneIdEncoded)
     return new Promise((resolve, reject) => {
       let geneName = geneid
       try {
         if (prefixes){
           for (const i in prefixes) {
             if (geneid.includes(prefixes[i])) {
               const underscorePrefix = prefixes[i].concat('_');
               geneName = geneid.replace(underscorePrefix, '');
             }
           }
         }
         let geneQuery = {
           $or: [
             { ID: geneName },
             { 'subfeatures.ID': geneName },
             { 'subfeatures.protein_id': geneName },
           ],
         }

         if (self.annotations.length > 0){
             geneQuery['annotationName'] = { $in: self.annotations }
         }

         const gene = Genes.findOne(geneQuery)
         resolve({gene, geneName})
       } catch (err) {
         reject(err);
       }
     })
   }
  /**
   * Parse the newick file.
   * @function
   * @param {String} newick - The path of the newick tree.
   * @param {Array} prefixes - The list of OrthoFinder prefixes.
   */
  parse = async (newick, prefixes) => {
    try {
    // Read raw file.
    const treeNewick = fs.readFileSync(newick, 'utf8');

    let name = path.parse(newick).name
    if (name.endsWith('_tree')){
      name = name.replace('_tree', '')
    }

    // Parse the tree.
    const { tree, treeSize, geneIds, genomes, unknown } = await this.parseNewick(treeNewick, prefixes);

    // Remove duplicate value.
    const rmDuplicateGeneIDs = geneIds.filter((v, i, a) => a.indexOf(v) === i);

    const genomeArray = Object.keys(genomes)

    const genomeDict = {"unknown": {name: "unknown", count: unknown}}

    if (genomeArray.length !== 0){
      genomeCollection
        .find({ _id: { $in: genomeArray }})
        .forEach((genome) => {
          genomeDict[genome._id] = {name: genome.name, count: genomes[genome._id]}
        });
    }

    let geneQuery = { geneIds: { $in: rmDuplicateGeneIDs } }

    if (self.annotations.length > 0){
        geneQuery['annotations'] = { $in: self.annotations }
    }

    // Add the orthogroups and link them to their genes.
    if (rmDuplicateGeneIDs.length !== 0) {
      const documentOrthogroup = await orthogroupCollection.update(
        geneQuery, // Selector.
        {
          $set: // Modifier.
          {
            name: name,
            geneIds: rmDuplicateGeneIDs,
            annotations: self.annotations,
            tree: tree,
            size: treeSize,
            genomes: genomeDict
          },
        },
        { // Options
          multi: true,
          upsert: true,
        },
      );

      // Increment orthogroups.
      this.nOrthogroups += documentOrthogroup;

      let geneQuery = { ID: { $in: rmDuplicateGeneIDs } }

      if (self.annotations.length > 0){
          geneQuery['annotationName'] = { $in: self.annotations }
      }

      const orthogroupIdentifiant = orthogroupCollection.findOne({ tree: tree })._id;
      await this.genesDb.update(
        geneQuery,
        {
          $set: // Modifier.
          {
            orthogroup: {
              id: orthogroupIdentifiant,
              name: name
            }
          },
        },
        { // Options.
          multi: true,
          upsert: true,
        },
      );
    } else {
      logger.warn(
        'Orthogroup consists exclusively of genes not in the database',
      );
    }
    } catch(err){
      logger.log(err)
    }
  };
}

export default NewickProcessor;
