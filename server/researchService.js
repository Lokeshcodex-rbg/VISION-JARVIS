/**
 * VISION AI — Live Research & Documentation Engine
 * Delegates to the multi-provider LiveWebResearchService so all knowledge search
 * benefits from failover providers, webpage inspection, PDF reading, citations,
 * and strict untrusted-content sanitization.
 */

const { liveWebResearchService } = require('./research/liveWebResearchService.js');

class ResearchService {
  /**
   * Researches a topic using the multi-provider live web intelligence pipeline
   */
  async researchTopic(query, options = {}) {
    return await liveWebResearchService.autonomousResearch(query, options);
  }
}

module.exports = {
  ResearchService,
  researchServiceInstance: new ResearchService()
};
