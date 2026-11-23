/**
 * Implementation for scientific_paper_bibtex plugin
 */

module.exports = {
  format_bibtex_entry: async (params) => {
    const title = params.title || 'Untitled Research Article';
    const authors = Array.isArray(params.authors) ? params.authors.join(' and ') : (params.authors || 'Unknown');
    const year = params.year || new Date().getFullYear();
    const venue = params.journalOrVenue || 'arXiv preprint';
    const doi = params.doi || '';

    const citeKey = (authors.split(' ')[0] || 'paper').toLowerCase().replace(/[^a-z0-9]/g, '') + year;

    const bibtex = [
      `@article{${citeKey},`,
      `  title     = {${title}},`,
      `  author    = {${authors}},`,
      `  journal   = {${venue}},`,
      `  year      = {${year}},`,
      doi ? `  doi       = {${doi}},` : null,
      `  note      = {Indexed by VISION Autonomous Research Engine}`,
      `}`
    ].filter(Boolean).join('\n');

    return {
      citationKey: citeKey,
      bibtex,
      valid: true
    };
  },

  validate_doi: async (params) => {
    const doi = String(params.doi || '').trim();
    // Standard DOI regex: 10.xxxx/...
    const doiRegex = /^10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+$/;
    const isValid = doiRegex.test(doi);

    return {
      doi,
      validFormat: isValid,
      resolverUrl: isValid ? `https://doi.org/${doi}` : null,
      evidence: isValid ? 'DOI matches standard International DOI Foundation schema.' : 'Invalid DOI format.'
    };
  }
};
