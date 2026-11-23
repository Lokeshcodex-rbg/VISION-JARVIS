/**
 * Acceptance Test: Workstream G — Real-Time Internet Research & Live News Grounding
 */

const assert = require('assert');
const { liveWebResearchService } = require('../server/research/liveWebResearchService.js');
const { executeTool } = require('../server/toolsRegistry.js');

async function runTests() {
  console.log('=== TEST SUITE: WORKSTREAM G (Real-Time Internet Research & News) ===');

  // Test 1: Retrieve Live News on Technology
  const newsRes = await liveWebResearchService.getLiveNews('space', 3);
  assert(newsRes.success, 'Live news query must succeed');
  assert(Array.isArray(newsRes.articles) && newsRes.articles.length > 0, 'Must return at least 1 news article');
  console.log(`  [PASS] Live news retrieval verified: ${newsRes.articles.length} headlines retrieved`);
  console.log(`         Sample: "${newsRes.articles[0].title}" (${newsRes.articles[0].publisher})`);

  // Test 2: Search Live Web via Tool Registry
  const searchRes = await executeTool('search_live_web', { query: 'James Webb Space Telescope', maxResults: 3 }, 'JARVIS');
  assert(searchRes.success, 'search_live_web must succeed');
  assert(searchRes.results.length > 0, 'Must return search results');
  console.log(`  [PASS] search_live_web tool verified: found ${searchRes.results.length} results`);
  console.log(`         Top: ${searchRes.results[0].title} - ${searchRes.results[0].source}`);

  // Test 3: Fetch Article Clean Content via Tool Registry
  const testUrl = 'https://en.wikipedia.org/wiki/Artificial_intelligence';
  const articleRes = await executeTool('fetch_web_article', { url: testUrl }, 'JARVIS');
  assert(articleRes.success, 'fetch_web_article must succeed');
  assert(articleRes.totalLength > 100, 'Article content must be non-trivial');
  console.log(`  [PASS] fetch_web_article verified: extracted ${articleRes.totalLength} chars from "${articleRes.title}"`);

  console.log('=== WORKSTREAM G: ALL ACCEPTANCE TESTS PASSED ===\n');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
