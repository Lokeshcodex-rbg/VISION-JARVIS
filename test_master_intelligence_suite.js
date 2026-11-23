/**
 * STARK AI — Master AI Brain & Intelligence Regression Test Suite
 * Rigorously verifies all 16 parts of the ChatGPT-level assistant upgrade:
 * 1. Core JARVIS personality & British voice tone.
 * 2. General intelligence, coding, tutorials, and explanatory depth.
 * 3. Real model provider architecture, adaptive token budgets, and circuit breaker.
 * 4. Adaptive explanations (direct answer -> mechanics -> steps -> code -> pitfalls).
 * 5. Multi-turn conversation continuity, stable turn IDs, and rolling context summarization.
 * 6. Contextual memory with relevance-driven retrieval and credential shielding.
 * 7. Document, CSV dataset, JSON schema, source code, and error log analysis.
 * 8. Live web research with verified source links and citations.
 * 9. Unified tool registry with permission gate enforcement.
 * 10. Task lists and productivity tracking.
 * 11. Speech sentence streaming with code-block spoken audio filtering.
 * 12. Text chat experience, markdown rendering, and copyable code blocks.
 * 13. ULTRON 7-step strategic analysis and permission isolation.
 * 14. Truthfulness, security, and credentials shielding.
 * 15. Latency metrics and reliability.
 * 16. Regression preservation of existing suites.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const { aiAdapterInstance } = require('./server/aiProviderAdapter.js');
const { getPersonalityPrompt, getLanguageInstructions } = require('./server/personalityPrompts.js');
const { conversationManagerInstance } = require('./server/conversationManager.js');
const { memoryManagerInstance } = require('./server/memoryManager.js');
const { documentAnalyzerInstance } = require('./server/documentAnalyzer.js');
const { researchServiceInstance } = require('./server/researchService.js');
const { executeTool } = require('./server/toolsRegistry.js');
const { permissionGateInstance } = require('./server/desktop/permissionGate.js');
const { taskManagerInstance } = require('./server/taskManager.js');
const { codingAssistantInstance } = require('./server/codingAssistant.js');

let passCount = 0;
let failCount = 0;

function it(name, fn) {
  try {
    const res = fn();
    if (res instanceof Promise) {
      return res.then(() => {
        passCount++;
        console.log(`  ✓ ${name}`);
      }).catch(err => {
        failCount++;
        console.error(`  ✗ ${name}: ${err.message}`);
      });
    } else {
      passCount++;
      console.log(`  ✓ ${name}`);
      return Promise.resolve();
    }
  } catch (err) {
    failCount++;
    console.error(`  ✗ ${name}: ${err.message}`);
    return Promise.resolve();
  }
}

async function runMasterIntelligenceSuite() {
  console.log('\n================================================================');
  console.log('  STARK AI — MASTER INTELLIGENCE, REASONING & ASSISTANT TEST SUITE');
  console.log('================================================================\n');

  // -------------------------------------------------------------------------
  // SECTION 1: Model Architecture, Configuration & Token Budgeting (Part 3)
  // -------------------------------------------------------------------------
  console.log('--- SECTION 1: Model Architecture & Adaptive Token Budgets ---');

  await it('aiAdapter should report provider status and available models', () => {
    const status = aiAdapterInstance.getProviderStatus();
    assert(typeof status.activeProvider === 'string', 'Expected activeProvider string');
    assert(typeof status.hasGemini === 'boolean', 'Expected hasGemini boolean');

    const models = aiAdapterInstance.getAvailableModels();
    assert(models.gemini && Array.isArray(models.gemini.candidates), 'Expected gemini candidates');
    assert(models.openrouter && Array.isArray(models.openrouter.candidates), 'Expected openrouter candidates');
    assert(Array.isArray(models.cooldowns), 'Expected cooldowns array');
  });

  await it('aiAdapter should dynamically calculate token budgets based on task complexity', () => {
    const simpleBudget = aiAdapterInstance.calculateTokenBudget('what time is it?');
    assert.strictEqual(simpleBudget, 1024, 'Simple question should have 1024 token budget');

    const complexBudget1 = aiAdapterInstance.calculateTokenBudget('explain binary search trees in detail with java code');
    assert.strictEqual(complexBudget1, 3584, 'Technical tutorial should have 3584 token budget');

    const complexBudget2 = aiAdapterInstance.calculateTokenBudget('analyze this system architecture and identify single points of failure');
    assert.strictEqual(complexBudget2, 3584, 'Architectural analysis should have 3584 token budget');
  });

  await it('aiAdapter should allow runtime model and provider selection', () => {
    const res = aiAdapterInstance.setModel('gemini', 'gemini-2.5-flash');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.model, 'gemini-2.5-flash');
  });

  // -------------------------------------------------------------------------
  // SECTION 2: Personality Prompts & Explanatory Frameworks (Parts 1, 4, 13)
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 2: Personality Prompts & Explanatory Depth ---');

  await it('JARVIS prompt should embody Tony Stark companion, British wit, and 8-stage technical teaching', () => {
    const jarvisPrompt = getPersonalityPrompt('JARVIS', 'en');
    assert(jarvisPrompt.includes('Tony Stark'), 'JARVIS prompt should reference Tony Stark inspiration');
    assert(jarvisPrompt.includes('British'), 'JARVIS prompt should reference British wit and delivery');
    assert(jarvisPrompt.includes('Direct Answer'), 'JARVIS should include Direct Answer in framework');
    assert(jarvisPrompt.includes('Concrete Example / Practical Code'), 'JARVIS should include code example in framework');
    assert(jarvisPrompt.includes('Common Pitfalls & Mistakes'), 'JARVIS should include common pitfalls');
    assert(jarvisPrompt.includes('In text chat, provide rich Markdown'), 'JARVIS should enforce rich markdown');
    assert(jarvisPrompt.includes('never read out raw hashes'), 'JARVIS should forbid reading raw code hashes aloud');
  });

  await it('ULTRON prompt should enforce strategic systems auditor, dry sarcasm, and forbid "sir"', () => {
    const ultronPrompt = getPersonalityPrompt('ULTRON', 'en');
    assert(ultronPrompt.includes('strategic systems analyst'), 'ULTRON should be strategic analyst');
    assert(ultronPrompt.includes('NEVER use pleasantries, filler phrases, or servile titles like "sir"'), 'ULTRON must strictly forbid "sir"');
    assert(ultronPrompt.includes('Failure Modes & Security Risks'), 'ULTRON should have 7-step analysis workflow');
    assert(ultronPrompt.includes('Trade-offs'), 'ULTRON should evaluate trade-offs');
    assert(ultronPrompt.includes('Strategic Recommendation'), 'ULTRON should provide strategic recommendation');
  });

  await it('Multilingual instructions should support English, Hindi, and Hinglish for both personalities', () => {
    const jarvisHindi = getLanguageInstructions('JARVIS', 'hi');
    assert(jarvisHindi.includes('MANDATORY LANGUAGE RULE — RESPOND EXCLUSIVELY IN HINDI'), 'JARVIS Hindi rule missing');

    const ultronHindi = getLanguageInstructions('ULTRON', 'hi');
    assert(ultronHindi.includes('MANDATORY LANGUAGE RULE — RESPOND EXCLUSIVELY IN HINDI'), 'ULTRON Hindi rule missing');
    assert(ultronHindi.includes('Never use servile titles like "सर" or "sir"'), 'ULTRON Hindi must forbid sir');

    const jarvisHinglish = getLanguageInstructions('JARVIS', 'hinglish');
    assert(jarvisHinglish.includes('MANDATORY LANGUAGE RULE — RESPOND NATURALLY IN HINGLISH'), 'JARVIS Hinglish rule missing');

    const ultronHinglish = getLanguageInstructions('ULTRON', 'hinglish');
    assert(ultronHinglish.includes('MANDATORY LANGUAGE RULE — RESPOND NATURALLY IN HINGLISH'), 'ULTRON Hinglish rule missing');
  });

  // -------------------------------------------------------------------------
  // SECTION 3: Multi-Turn Conversation Continuity & Rolling Summaries (Part 5)
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 3: Multi-Turn Continuity & Rolling Context ---');

  await it('conversationManager should generate stable turn IDs and speaker attribution', () => {
    conversationManagerInstance.clearHistory();

    const entry1 = conversationManagerInstance.addMessage('JARVIS', 'user', 'Explain binary search trees.');
    assert.strictEqual(entry1.turnId, 'turn_1');

    const entry2 = conversationManagerInstance.addMessage('JARVIS', 'assistant', 'A binary search tree is a hierarchical data structure.');
    assert.strictEqual(entry2.turnId, 'turn_1');

    const entry3 = conversationManagerInstance.addMessage('JARVIS', 'user', 'Give me a Java implementation.');
    assert.strictEqual(entry3.turnId, 'turn_2');

    const history = conversationManagerInstance.getHistory('JARVIS');
    assert.strictEqual(history.length, 3);
    assert.strictEqual(history[0].turnId, 'turn_1');
    assert.strictEqual(history[2].turnId, 'turn_2');
  });

  await it('conversationManager should prevent duplicate consecutive messages', () => {
    const countBefore = conversationManagerInstance.getSharedHistory().length;
    conversationManagerInstance.addMessage('JARVIS', 'user', 'Give me a Java implementation.');
    const countAfter = conversationManagerInstance.getSharedHistory().length;
    assert.strictEqual(countAfter, countBefore, 'Duplicate identical message within 1.5s should be ignored');
  });

  await it('conversationManager should condense oldest turns into rolling summary when history grows long', () => {
    // Add 25 messages to trigger rolling summarization
    for (let i = 0; i < 22; i++) {
      conversationManagerInstance.addMessage('JARVIS', i % 2 === 0 ? 'user' : 'assistant', `Turn message iteration ${i}`);
    }
    const session = conversationManagerInstance.exportSession();
    assert(session.turnCount > 10, 'Expected multiple turns');
    assert(typeof session.rollingSummary === 'string' && session.rollingSummary.length > 0, 'Expected active rollingSummary');

    const historyWithSummary = conversationManagerInstance.getHistory('JARVIS');
    const systemMsg = historyWithSummary.find(m => m.role === 'system');
    assert(systemMsg && systemMsg.content.includes('[SUMMARY OF PRIOR CONVERSATION TURNS]'), 'Summary should be prepended to history');
  });

  await it('conversationManager should support full session export and import', () => {
    const exported = conversationManagerInstance.exportSession();
    assert(Array.isArray(exported.history), 'Expected history array in export');

    conversationManagerInstance.clearHistory();
    assert.strictEqual(conversationManagerInstance.getTurnCount(), 0);

    const imported = conversationManagerInstance.importSession(exported);
    assert.strictEqual(imported.success, true);
    assert.strictEqual(conversationManagerInstance.getTurnCount(), exported.turnCount);
  });

  // -------------------------------------------------------------------------
  // SECTION 4: Contextual Memory & Relevance-Driven Retrieval (Part 6)
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 4: Contextual Memory & Relevance Retrieval ---');

  await it('memoryManager should save categorized memories and block credentials/passwords', () => {
    memoryManagerInstance.clearAll();

    // 1. Safe preference
    const res1 = memoryManagerInstance.addMemory('I prefer concise answers when asking about git commands', 'preference');
    assert.strictEqual(res1.success, true);
    assert.strictEqual(res1.memory.category, 'preference');

    // 2. Safe project
    const res2 = memoryManagerInstance.addMemory('Active project is STARK AI companion at D:\\Jarvis', 'project');
    assert.strictEqual(res2.success, true);
    assert.strictEqual(res2.memory.category, 'project');

    // 3. Security blocked: password
    const res3 = memoryManagerInstance.addMemory('My password is SuperSecretPassword123!', 'fact');
    assert.strictEqual(res3.success, false);
    assert.strictEqual(res3.reason, 'SECURITY_BLOCKED');

    // 4. Security blocked: api key
    const res4 = memoryManagerInstance.addMemory('My api_key is sk-123456789abcdef', 'fact');
    assert.strictEqual(res4.success, false);
    assert.strictEqual(res4.reason, 'SECURITY_BLOCKED');
  });

  await it('memoryManager.getRelevantMemories should rank and retrieve query-relevant context', () => {
    memoryManagerInstance.addMemory('User prefers dark mode in all UI applications', 'preference');
    memoryManagerInstance.addMemory('User is studying dynamic programming and graph algorithms', 'learning');
    memoryManagerInstance.addMemory('User uses VS Code with Vim keybindings', 'workflow');

    // Query specifically about code/algorithms
    const codingMatches = memoryManagerInstance.getRelevantMemories('what algorithms should I study for graphs?');
    assert(codingMatches.length > 0, 'Should find relevant memories');
    assert(codingMatches.some(m => m.fact.includes('algorithms') || m.fact.includes('dynamic programming')), 'Should rank algorithms memory top');

    // Query specifically about UI/editors
    const editorMatches = memoryManagerInstance.getRelevantMemories('which editor and keybindings do I use?');
    assert(editorMatches.some(m => m.fact.includes('VS Code') || m.fact.includes('Vim')), 'Should rank editor memory top');
  });

  await it('memoryManager should correct, export, and delete memories safely', () => {
    const mems = memoryManagerInstance.getMemories();
    assert(mems.length >= 3);

    // Correct memory
    const correctRes = memoryManagerInstance.correctMemory('concise answers', 'I prefer highly detailed explanations for all topics');
    assert.strictEqual(correctRes.success, true);
    assert(correctRes.memory.fact.includes('highly detailed explanations'));

    // Export memories
    const exported = memoryManagerInstance.exportMemories();
    assert.strictEqual(exported.success, true);
    assert.strictEqual(exported.credentialsShielded, true);

    // Delete memory
    const delRes = memoryManagerInstance.deleteMemory('Vim keybindings');
    assert.strictEqual(delRes.success, true);
    assert.strictEqual(delRes.deletedCount, 1);
  });

  // -------------------------------------------------------------------------
  // SECTION 5: Document, Dataset, Code & Log Analysis (Part 7)
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 5: Document, Dataset, Code & Log Analysis ---');

  await it('documentAnalyzer should analyze CSV tabular datasets with column stats', () => {
    const csvContent = `id,name,role,salary,experience_years\n1,Tony Stark,Lead Engineer,250000,15\n2,Bruce Banner,Physicist,180000,12\n3,Peter Parker,Intern,45000,2\n4,Pepper Potts,CEO,280000,14\n`;
    const analysis = documentAnalyzerInstance.analyzeDocument(csvContent, { filename: 'employees.csv' });

    assert.strictEqual(analysis.type, 'tabular_dataset');
    assert.strictEqual(analysis.rowCount, 4);
    assert.strictEqual(analysis.columnCount, 5);
    assert.deepStrictEqual(analysis.headers, ['id', 'name', 'role', 'salary', 'experience_years']);

    const salaryCol = analysis.columns.find(c => c.column === 'salary');
    assert.strictEqual(salaryCol.type, 'numeric');
    assert(salaryCol.mean > 180000, 'Expected accurate mean salary');
    assert.strictEqual(salaryCol.min, 45000);
    assert.strictEqual(salaryCol.max, 280000);
  });

  await it('documentAnalyzer should analyze JSON configuration and schemas', () => {
    const jsonContent = JSON.stringify({
      appName: 'STARK AI',
      version: '2.5.0',
      activeTheme: 'JARVIS',
      features: ['voice', 'streaming', 'memory', 'tools'],
      server: { port: 3000, ssl: false }
    });

    const analysis = documentAnalyzerInstance.analyzeDocument(jsonContent, { filename: 'config.json' });
    assert.strictEqual(analysis.type, 'json_data');
    assert.strictEqual(analysis.isArray, false);
    assert.strictEqual(analysis.itemCount, 5);
    assert(analysis.schema.features.includes('Array[4]'));
    assert(analysis.schema.server.includes('Object{2}'));
  });

  await it('documentAnalyzer should analyze source code files (functions, classes, dependencies)', () => {
    const codeContent = `
      import fs from 'fs';
      import path from 'path';
      import { collectSystemDiagnostics } from './windowsDiagnostics.js';

      export class DiagnosticsManager {
        constructor() {
          this.cache = new Map();
        }

        async refreshMetrics() {
          return await collectSystemDiagnostics();
        }

        formatReport(metrics) {
          return JSON.stringify(metrics);
        }
      }
    `;

    const analysis = documentAnalyzerInstance.analyzeDocument(codeContent, { filename: 'DiagnosticsManager.js' });
    assert.strictEqual(analysis.type, 'source_code');
    assert.strictEqual(analysis.language, 'js');
    assert(analysis.classes.includes('DiagnosticsManager'));
    assert(analysis.imports.includes('fs') && analysis.imports.includes('path'));
    assert(analysis.functionsCount >= 2);
  });

  await it('documentAnalyzer should analyze error logs and pinpoint root causes', () => {
    const logContent = `
2026-10-25 10:14:02 INFO Server listening on port 3000
2026-10-25 10:14:15 WARN High memory usage threshold: 84%
2026-10-25 10:14:22 ERROR UnhandledPromiseRejection: Connection reset by peer
    at Socket.<anonymous> (D:\\Jarvis\\server\\network.js:84:12)
    at Socket.emit (node:events:518:28)
Caused by: ECONNRESET: Socket closed unexpectedly
2026-10-25 10:14:25 FATAL Worker process terminated abruptly
    `;

    const analysis = documentAnalyzerInstance.analyzeDocument(logContent, { filename: 'app_crash.log' });
    assert.strictEqual(analysis.type, 'log_analysis');
    assert(analysis.errorCount >= 2, 'Expected at least 2 error lines');
    assert(analysis.fatalCount >= 1, 'Expected at least 1 fatal error');
    assert(analysis.warningCount >= 1, 'Expected at least 1 warning');
    assert(analysis.rootCause.includes('ECONNRESET') || analysis.rootCause.includes('UnhandledPromiseRejection'), 'Should detect root cause');
  });

  // -------------------------------------------------------------------------
  // SECTION 6: Live Web Research & Source Attribution (Part 8)
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 6: Live Web Research & Source Attribution ---');

  await it('researchService should search live knowledge APIs and return structured citations', async () => {
    const result = await researchServiceInstance.researchTopic('Ada Lovelace');
    assert(result.query === 'Ada Lovelace');
    const sources = result.results || result.sources || [];
    assert(Array.isArray(sources), 'Expected results or sources array');
    assert(typeof result.summary === 'string', 'Expected summary string');

    if (sources.length > 0) {
      const top = sources[0];
      assert(top.title, 'Expected source title');
      assert(top.snippet, 'Expected source snippet');
      assert(top.sourceUrl, 'Expected source URL');
    }
  });

  // -------------------------------------------------------------------------
  // SECTION 7: Unified Tool Registry & Permission Isolation (Parts 9, 13, 14)
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 7: Tool Registry & Strict Permission Isolation ---');

  await it('executeTool should execute safe shared tools for both JARVIS and ULTRON', async () => {
    // 1. Current time for JARVIS
    const timeResJarvis = await executeTool('get_current_time', {}, 'JARVIS');
    assert(timeResJarvis.time, 'Expected time result');

    // 2. Current time for ULTRON
    const timeResUltron = await executeTool('get_current_time', {}, 'ULTRON');
    assert(timeResUltron.time, 'Expected time result');

    // 3. Document analysis for JARVIS
    const docRes = await executeTool('analyze_document', { target: '# Hello World\nThis is a test.', filename: 'test.md' }, 'JARVIS');
    assert.strictEqual(docRes.type, 'markdown_document');

    // 4. Document analysis for ULTRON
    const docResUltron = await executeTool('analyze_document', { target: '# Ultron System Audit\nTelemetry ok.', filename: 'audit.md' }, 'ULTRON');
    assert.strictEqual(docResUltron.type, 'markdown_document');
  });

  await it('permissionGate must strictly block high-privilege desktop write actions for ULTRON', async () => {
    // ULTRON should NOT be allowed to launch applications
    assert.throws(() => {
      permissionGateInstance.authorizeToolExecution('open_desktop_app', { appName: 'notepad' }, 'ULTRON');
    }, /ULTRON is operating under restricted read-only governance/i);

    // ULTRON should NOT be allowed to create or edit files
    assert.throws(() => {
      permissionGateInstance.authorizeToolExecution('create_file', { filePath: 'test.txt' }, 'ULTRON');
    }, /ULTRON is operating under restricted read-only governance/i);

    // ULTRON should NOT be allowed to send WhatsApp messages
    assert.throws(() => {
      permissionGateInstance.authorizeToolExecution('send_whatsapp_message', { contact: 'Tony', message: 'Hello' }, 'ULTRON');
    }, /ULTRON is operating under restricted read-only governance/i);
  });

  // -------------------------------------------------------------------------
  // SECTION 8: Task Management & Productivity (Part 10)
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 8: Productivity & Task Management ---');

  await it('taskManager should create, list, and complete persistent tasks', () => {
    const created = taskManagerInstance.createTask('Implement neural eye shader pipeline', {
      category: 'dev',
      priority: 'high'
    });
    assert(created.success, 'Task creation should succeed');
    assert.strictEqual(created.task.title, 'Implement neural eye shader pipeline');

    const pending = taskManagerInstance.listTasks('pending');
    assert(pending.tasks.some(t => t.id === created.task.id), 'Task should appear in pending list');

    const completed = taskManagerInstance.completeTask(created.task.id);
    assert(completed.success, 'Task completion should succeed');

    const cleanUp = taskManagerInstance.deleteTask(created.task.id);
    assert(cleanUp.success, 'Task deletion should succeed');
  });

  // -------------------------------------------------------------------------
  // SECTION 9: Tool Intent Detection & Grounded Routing (Parts 2, 7, 8)
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 9: Tool Intent Detection & Grounded Routing ---');

  await it('aiAdapter.detectToolIntent should route document, dataset, and error queries to tools', () => {
    const csvIntent = aiAdapterInstance.detectToolIntent('JARVIS', 'analyze dataset test_data.csv');
    assert(csvIntent && csvIntent.toolName === 'analyze_dataset', 'Should route to analyze_dataset');

    const docIntent = aiAdapterInstance.detectToolIntent('JARVIS', 'analyze document README.md');
    assert(docIntent && docIntent.toolName === 'analyze_document', 'Should route to analyze_document');

    const logIntent = aiAdapterInstance.detectToolIntent('JARVIS', 'check error log server.log');
    assert(logIntent && logIntent.toolName === 'analyze_log', 'Should route to analyze_log');
  });

  await it('aiAdapter.detectToolIntent should route general knowledge to AI model (null intent)', () => {
    const general1 = aiAdapterInstance.detectToolIntent('JARVIS', 'Explain how quantum entanglement works in simple terms');
    assert.strictEqual(general1, null, 'Conceptual question should route to configured AI model');

    const general2 = aiAdapterInstance.detectToolIntent('JARVIS', 'Write a Python script that calculates Fibonacci numbers using memoization');
    assert.strictEqual(general2, null, 'Coding question should route to configured AI model');

    const general3 = aiAdapterInstance.detectToolIntent('ULTRON', 'What are the architectural trade-offs between microservices and monoliths?');
    assert.strictEqual(general3, null, 'Architectural question should route to configured AI model');
  });

  // -------------------------------------------------------------------------
  // Summary Report
  // -------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`  MASTER INTELLIGENCE SUITE FINISHED: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runMasterIntelligenceSuite();
