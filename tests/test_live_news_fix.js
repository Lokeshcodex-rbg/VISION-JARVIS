/**
 * JARVIS Live Latest News — End-to-End Verification Suite
 * Tests The Register + BBC + TechCrunch + Ars Technica + Categories + Malformed/Encoded Defense
 * + Dual Provider Summarization (VISION & Gemini) + Refresh + Live Playwright UI Rendering & Screenshot.
 */

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');

const SCREENSHOT_PATH = path.resolve(__dirname, '../scratch/live_news_ui_verified.png');
const REPORT_PATH = path.resolve(__dirname, '../data/neural_models/live_news_verification_report.json');

function assertCleanArticle(art, ctx) {
  assert.ok(art.source && art.source.length >= 2, `[${ctx}] Missing source`);
  assert.ok(art.headline && art.headline.length >= 8, `[${ctx}] Missing readable headline`);
  assert.ok(art.summary && art.summary.length >= 20, `[${ctx}] Missing readable summary`);
  assert.ok(/^https?:\/\/[^\s]+$/i.test(art.url), `[${ctx}] Invalid article URL: ${art.url}`);
  assert.ok(art.publishedAt || art.publishedDisplay, `[${ctx}] Missing publication date`);
  assert.ok(!/\b(?:CBMi|AU_yqL|CAAq)[A-Za-z0-9_-]{24,}\b/.test(art.headline), `[${ctx}] Encoded token leaked into headline`);
  assert.ok(!/\b(?:CBMi|AU_yqL|CAAq)[A-Za-z0-9_-]{24,}\b/.test(art.summary), `[${ctx}] Encoded token leaked into summary`);
  assert.ok(!/[A-Za-z0-9+/_=-]{48,}/.test(art.summary), `[${ctx}] Unbroken encoded payload leaked into summary`);
}

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(Buffer.concat(chunks).toString('utf8')) }));
    }).on('error', reject);
  });
}

function httpPostJson(url, body) {
  return new Promise((resolve, reject) => {
    const payload = Buffer.from(JSON.stringify(body), 'utf8');
    const req = http.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': payload.length }
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(Buffer.concat(chunks).toString('utf8')) }));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function runTests() {
  const { liveWebResearchService } = require('../server/research/liveWebResearchService.js');
  const { browserAutomationEngineInstance } = require('../server/browser/browserAutomationEngine.js');
  const reportCases = [];

  const check = async (name, fn) => {
    const t0 = Date.now();
    const details = await fn();
    reportCases.push({ name, passed: true, durationMs: Date.now() - t0, details });
    console.log(`[PASS] ${name} (${Date.now() - t0}ms)`);
  };

  // 1. Test The Register specifically
  let registerArticle = null;
  await check('The Register live feed normalized cleanly (no CBMi encoded string)', async () => {
    const res = await httpGetJson('http://127.0.0.1:3000/api/news/live?topic=technology&source=The%20Register&maxResults=5&fresh=1');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.count >= 3, `Expected >= 3 The Register articles, got ${res.data.count}`);
    for (const a of res.data.articles) {
      assertCleanArticle(a, 'The Register');
      assert.ok(a.url.includes('theregister.com'), `Expected direct theregister.com URL, got: ${a.url}`);
    }
    registerArticle = res.data.articles[0];
    return { count: res.data.count, sampleHeadline: registerArticle.headline, sampleUrl: registerArticle.url, published: registerArticle.publishedDisplay };
  });

  // 2. Test 3+ other live sources (BBC, TechCrunch, Ars Technica)
  for (const src of ['BBC', 'TechCrunch', 'Ars Technica']) {
    await check(`Source-specific live feed: ${src}`, async () => {
      const res = await httpGetJson(`http://127.0.0.1:3000/api/news/live?topic=technology&source=${encodeURIComponent(src)}&maxResults=4&fresh=1`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.ok(res.data.count >= 2, `Expected >= 2 articles from ${src}, got ${res.data.count}`);
      res.data.articles.forEach(a => assertCleanArticle(a, src));
      return { count: res.data.count, firstHeadline: res.data.articles[0].headline, firstUrl: res.data.articles[0].url };
    });
  }

  // 3. Test categories (technology, ai, world, business) + refresh behavior
  await check('Categories (technology, ai, world, business) & fresh cache-bypass refresh', async () => {
    const summary = {};
    for (const cat of ['technology', 'ai', 'world', 'business']) {
      const res = await httpGetJson(`http://127.0.0.1:3000/api/news/live?topic=${encodeURIComponent(cat)}&maxResults=4&fresh=1`);
      assert.strictEqual(res.data.success, true, `Category ${cat} failed`);
      assert.ok(res.data.count >= 2, `Category ${cat} too few articles`);
      res.data.articles.forEach(a => assertCleanArticle(a, cat));
      assert.notStrictEqual(res.data.cached, true, 'fresh=1 must bypass cache');
      summary[cat] = { count: res.data.count, providerUsed: res.data.providerUsed };
    }
    return summary;
  });

  // 4. Test malformed RSS / encoded payload rejection
  await check('Malformed XML & opaque base64/CBMi token inputs rejected or cleaned safely', async () => {
    const badXml = `
      <rss><channel>
        <item>
          <title>CBMi8AFBVV95cUxOcFlzMmdDVmtmdjJqTHdHY1MtQTUwdVBnaGYxU3NnZ1pfS25nY01SNm5oX2ZVZVFw</title>
          <link>javascript:alert(1)</link>
        </item>
        <item>
          <title>Legit Tech Headline - The Register</title>
          <source url="https://www.theregister.com">The Register</source>
          <link>https://news.google.com/rss/articles/CBMi8AFBVV95cUxOcFlzMmdDVmtmdjJqTHdHY1MtQTUwdVBnaGYxU3NnZ1pf?oc=5</link>
          <description>&lt;a href="https://news.google.com/rss/articles/CBMi8AFBVV95cUxOcFlzMmdDVmtmdjJq"&gt;Readable story on cloud outage.&lt;/a&gt; CBMi8AFBVV95cUxOcFlzMmdDVmtmdjJqTHdHY1MtQTUwdVBnaGY</description>
          <pubDate>Mon, 16 Nov 2026 09:00:00 GMT</pubDate>
        </item>
      </channel></rss>
    `;
    const parsed = liveWebResearchService._parseNewsFeedXml(badXml, 'Fallback', 5);
    assert.strictEqual(parsed.length, 1, 'First malformed encoded-headline + javascript link item must be rejected');
    assertCleanArticle(parsed[0], 'malformed-sanitize');
    assert.strictEqual(parsed[0].headline, 'Legit Tech Headline');
    assert.ok(!parsed[0].summary.includes('CBMi'), 'Encoded CBMi payload must be scrubbed from summary');
    return { keptCount: parsed.length, sanitizedHeadline: parsed[0].headline, sanitizedSummary: parsed[0].summary };
  });

  // 5. Test Both VISION & Gemini summarizing real retrieved article
  await check('Both VISION & Gemini summarize retrieved The Register article cleanly', async () => {
    assert.ok(registerArticle, 'Need live The Register article');
    const vis = await httpPostJson('http://127.0.0.1:3000/api/news/summarize', {
      articleUrl: registerArticle.url,
      headline: registerArticle.headline,
      source: registerArticle.source,
      publishedAt: registerArticle.publishedDisplay,
      summary: registerArticle.summary,
      providerMode: 'vision'
    });
    assert.strictEqual(vis.status, 200);
    assert.strictEqual(vis.data.providerUsed, 'vision');
    assert.ok(vis.data.summaryText && !/\bCBMi[A-Za-z0-9_-]{24,}/.test(vis.data.summaryText));

    const gem = await httpPostJson('http://127.0.0.1:3000/api/news/summarize', {
      articleUrl: registerArticle.url,
      headline: registerArticle.headline,
      source: registerArticle.source,
      publishedAt: registerArticle.publishedDisplay,
      summary: registerArticle.summary,
      providerMode: 'gemini'
    });
    assert.strictEqual(gem.status, 200);
    assert.ok(['gemini', 'openrouter', 'unified_local_intelligence'].includes(gem.data.providerUsed));
    assert.ok(gem.data.summaryText && !/\bCBMi[A-Za-z0-9_-]{24,}/.test(gem.data.summaryText));
    return { visionProvider: vis.data.provider, geminiProvider: gem.data.provider, fetchedFullText: gem.data.fetchedFullText };
  });

  // 6. Test Live Browser UI Rendering + Capture Screenshot of The Register cards
  await check('Live browser UI renders readable News Cards without raw encoded tokens', async () => {
    const sess = await browserAutomationEngineInstance.openSession({ channel: 'chrome', headless: true });
    try {
      await browserAutomationEngineInstance.navigate(sess.sessionId, 'http://127.0.0.1:3000', { allowLocalhost: true });
      const page = browserAutomationEngineInstance._getSession(sess.sessionId).page;
      await page.waitForSelector('#header-live-news-badge', { timeout: 10000 });
      await page.click('#header-live-news-badge');
      await page.waitForSelector('.live-news-card', { timeout: 15000 });
      // Click "The Register" source pill
      await page.click('#news-category-pills button[data-source="The Register"]');
      await page.waitForFunction(() => {
        const badges = Array.from(document.querySelectorAll('.news-source-badge')).map(b => b.textContent);
        return badges.some(t => t.includes('The Register'));
      }, { timeout: 12000 });
      await new Promise(r => setTimeout(r, 600));

      const uiCheck = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('.live-news-card')).map(c => ({
          source: c.querySelector('.news-source-badge')?.textContent?.trim(),
          headline: c.querySelector('.live-news-headline')?.textContent?.trim(),
          summary: c.querySelector('.live-news-summary')?.textContent?.trim(),
          href: c.querySelector('.news-action-link')?.getAttribute('href')
        }));
        const allText = document.getElementById('live-news-cards-grid')?.innerText || '';
        return {
          cardsCount: cards.length,
          firstCard: cards[0] || null,
          hasEncodedCBMiLeak: /\b(?:CBMi|AU_yqL|CAAq)[A-Za-z0-9_-]{24,}\b/.test(allText)
        };
      });

      assert.ok(uiCheck.cardsCount >= 3, `Expected >= 3 cards rendered, got ${uiCheck.cardsCount}`);
      assert.strictEqual(uiCheck.hasEncodedCBMiLeak, false, 'UI must NOT contain any raw CBMi encoded string');
      assert.ok(uiCheck.firstCard?.href?.includes('theregister.com'), 'Read link must point directly to theregister.com');

      await page.screenshot({ path: SCREENSHOT_PATH, fullPage: false });
      assert.ok(fs.existsSync(SCREENSHOT_PATH) && fs.statSync(SCREENSHOT_PATH).size > 10000);
      return { ...uiCheck, screenshotPath: SCREENSHOT_PATH };
    } finally {
      await browserAutomationEngineInstance.emergencyShutdown();
    }
  });

  const report = {
    suite: 'JARVIS Live Latest News Fix & Verification Suite',
    executedAt: new Date().toISOString(),
    total: reportCases.length,
    passed: reportCases.length,
    failed: 0,
    cases: reportCases
  };
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\nLive News Suite Complete: ${report.passed}/${report.total} PASSED (0 failed). Screenshot: ${SCREENSHOT_PATH}`);
}

runTests().catch(err => {
  console.error('LIVE NEWS SUITE FAILED:', err);
  process.exit(1);
});
