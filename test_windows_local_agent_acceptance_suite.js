/**
 * STARK AI — Windows Local Agent Comprehensive Acceptance Suite
 * Verifies real on-device capabilities, process execution, window automation,
 * document generation, browser interaction, error recovery, truthful attribution,
 * and Emergency Stop process termination on the live Windows OS.
 * 
 * Acceptance Tests:
 * 1. Open Notepad, write text, save file, reopen and verify content & hash on disk.
 * 2. Create and verify a genuine Word-compatible (.docx) OpenXML document.
 * 3. Launch a browser and perform an authorized navigation/task.
 * 4. Execute a harmless controlled shell command with PID tracking and output hashing.
 * 5. Recover gracefully from simulated execution failures without false claims.
 * 6. Immediately terminate running background work (<100ms) using Emergency Stop.
 * 7. System prompt and truthful attribution guardrails verification.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const { windowsLocalAgentInstance } = require('./server/desktop/windowsLocalAgent.js');
const { emergencyStopControllerInstance } = require('./server/emergencyStopController.js');
const { permissionGateInstance } = require('./server/desktop/permissionGate.js');
const { desktopControllerInstance } = require('./server/desktop/desktopController.js');
const { commandInterpreterInstance } = require('./server/commandInterpreter.js');
const { unifiedIntelligenceLayerInstance } = require('./server/unifiedIntelligenceLayer.js');
const { executeTool } = require('./server/toolsRegistry.js');
const { documentIntelligenceEngineInstance } = require('./server/documentIntelligenceEngine.js');
const { BASE_JARVIS_PROMPT, BASE_ULTRON_PROMPT } = require('./server/personalityPrompts.js');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${testName}${details ? ' — ' + details : ''}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${testName}${details ? ' — ' + details : ''}`);
  }
}

async function runSuite() {
  console.log('================================================================');
  console.log('STARK AI — WINDOWS LOCAL AGENT REAL ACCEPTANCE TEST SUITE');
  console.log('Running on Windows OS with live process & filesystem verification');
  console.log('================================================================\n');

  // Ensure fresh scratch directory
  const scratchDir = path.resolve(__dirname, 'scratch');
  if (!fs.existsSync(scratchDir)) fs.mkdirSync(scratchDir, { recursive: true });

  // Reset Emergency Stop to clean standby state before starting
  emergencyStopControllerInstance.reset('Acceptance test setup');

  // ---------------------------------------------------------------------------
  // ACCEPTANCE TEST 1: Open Notepad, Write Text, Save, Reopen & Verify
  // ---------------------------------------------------------------------------
  console.log('--- TEST GROUP 1: Real Notepad Automation, Disk & Process Verification ---');
  {
    const noteTitle = 'stark_acceptance_notepad';
    const noteContent = `STARK AI Local Agent Acceptance Verification\nGenerated: ${new Date().toISOString()}\nStatus: Verified operational on Windows host.`;
    const targetFile = path.join(scratchDir, `${noteTitle}.txt`);

    // Clean prior file if exists
    if (fs.existsSync(targetFile)) fs.unlinkSync(targetFile);

    const workflowResult = await windowsLocalAgentInstance.executeDesktopWorkflow({
      workflowType: 'notepad_document_workflow',
      options: {
        title: noteTitle,
        content: noteContent,
        targetDir: scratchDir,
        openInNotepad: true
      },
      personality: 'JARVIS'
    });

    assert(workflowResult.success === true, 'Workflow returns success: true');
    assert(workflowResult.verified === true, 'Workflow returns verified: true');
    assert(fs.existsSync(workflowResult.filePath), 'Target file genuinely exists on disk', workflowResult.filePath);

    // Verify content on disk
    const onDiskContent = fs.readFileSync(workflowResult.filePath, 'utf8');
    const onDiskHash = crypto.createHash('sha256').update(onDiskContent, 'utf8').digest('hex');

    assert(onDiskContent.trim() === noteContent.trim(), 'On-disk file content matches payload identically');
    assert(workflowResult.reopenedAndVerified === true, 'Workflow reopens and independently verifies file from disk');
    assert(workflowResult.fileHash === onDiskHash, 'File SHA-256 hash verified identically', onDiskHash.slice(0, 16));

    // Verify Notepad process was launched and captured
    assert(workflowResult.notepadLaunched === true, 'Notepad process was triggered');
    assert(typeof workflowResult.processPid === 'number' && workflowResult.processPid > 0, 'Authentic Notepad PID captured', `PID: ${workflowResult.processPid}`);

    // Clean up launched Notepad gracefully
    try {
      if (workflowResult.processPid) {
        execSync(`taskkill /PID ${workflowResult.processPid} /F`, { stdio: 'ignore' });
      }
    } catch (_) {}
  }

  // ---------------------------------------------------------------------------
  // ACCEPTANCE TEST 2: Create & Verify Genuine Word-Compatible Document (.docx)
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: Microsoft Word (.docx) OpenXML Document Creation & Verification ---');
  {
    const docxTitle = 'STARK_Local_Agent_Acceptance_Report';
    const docxFile = path.join(scratchDir, `${docxTitle.toLowerCase()}.docx`);
    if (fs.existsSync(docxFile)) fs.unlinkSync(docxFile);

    const docxWorkflowRes = await windowsLocalAgentInstance.executeDesktopWorkflow({
      workflowType: 'word_document_workflow',
      options: {
        title: docxTitle,
        subtitle: 'Empirical Desktop Integration Telemetry',
        author: 'STARK AI Local Agent Acceptance Core',
        targetDir: scratchDir,
        sections: [
          {
            heading: '1. Executive Summary',
            level: 1,
            paragraphs: [
              'The STARK Windows Local Agent provides bidirectional OS agency.',
              'All actions are verified via process handles and on-disk cryptographic hashes.'
            ]
          },
          {
            heading: '2. Security Architecture',
            level: 2,
            paragraphs: [
              'Controlled shell execution allowlisting protects host integrity.',
              'Sub-100ms Emergency Stop terminates in-flight child processes immediately.'
            ]
          }
        ]
      },
      personality: 'JARVIS'
    });

    assert(docxWorkflowRes.success === true, 'Word document workflow returned success: true');
    assert(docxWorkflowRes.verified === true, 'Word document workflow returned verified: true');
    assert(fs.existsSync(docxWorkflowRes.filePath), 'Document file genuinely exists on disk', docxWorkflowRes.filePath);
    assert(docxWorkflowRes.fileSize > 1000, 'Document size is substantial and non-empty', `${docxWorkflowRes.fileSize} bytes`);

    // Verify it is a valid OpenXML ZIP archive with word/document.xml inside
    const verification = documentIntelligenceEngineInstance.verifyDocument(docxWorkflowRes.filePath, {
      expectedHeadings: ['1. Executive Summary']
    });

    assert(verification.verified === true, 'Document independently parsed as a valid OpenXML container');
    assert(verification.headingsCount > 0, 'Heading structure verified in Word document AST', `${verification.headingsCount} headings`);
  }

  // ---------------------------------------------------------------------------
  // ACCEPTANCE TEST 3: Launch Browser & Perform Authorized Task
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 3: Browser Navigation & Interaction Verification ---');
  {
    const targetUrl = 'http://127.0.0.1:3000';
    const browserRes = await windowsLocalAgentInstance.executeDesktopWorkflow({
      workflowType: 'browser_workflow',
      options: { url: targetUrl },
      personality: 'JARVIS'
    });

    assert(browserRes.success === true, 'Browser workflow returned success: true');
    assert(browserRes.verified === true, 'Browser workflow verified launch');
    assert(browserRes.url === targetUrl, 'Target URL formatted correctly', browserRes.url);
  }

  // ---------------------------------------------------------------------------
  // ACCEPTANCE TEST 4: Execute Harmless Controlled Shell Command
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 4: Harmless Controlled Shell Command Execution ---');
  {
    // Test 4a: node -v
    const cmdResult1 = await windowsLocalAgentInstance.executeControlledCommand({
      command: 'node -v',
      personality: 'JARVIS'
    });

    assert(cmdResult1.success === true, 'node -v executed successfully with exit code 0');
    assert(cmdResult1.verified === true, 'Execution verified with authentic return code');
    assert(cmdResult1.stdout.startsWith('v'), 'Stdout returned authentic Node version', cmdResult1.stdout);
    assert(typeof cmdResult1.processPid === 'number' && cmdResult1.processPid > 0, 'Captured authentic child process PID', `PID: ${cmdResult1.processPid}`);
    assert(cmdResult1.outputHash && cmdResult1.outputHash.length === 64, 'SHA-256 output hash recorded', cmdResult1.outputHash.slice(0, 16));

    // Test 4b: Get-Date in PowerShell
    const cmdResult2 = await windowsLocalAgentInstance.executeControlledCommand({
      command: 'Get-Date -UFormat %Y-%m-%d',
      personality: 'JARVIS'
    });

    assert(cmdResult2.success === true, 'Get-Date executed successfully');
    assert(cmdResult2.verified === true, 'Get-Date verified execution');
    assert(cmdResult2.stdout.length >= 8, 'Get-Date returned valid formatted timestamp', cmdResult2.stdout);
  }

  // ---------------------------------------------------------------------------
  // ACCEPTANCE TEST 5: Graceful Error Recovery Without False Claims
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 5: Error Recovery & Truthful Failure Reporting ---');
  {
    // 5a: Prohibited command (security policy rejection)
    const dangerousCmd = 'rmdir /s /q C:\\Windows\\System32';
    const rejectedRes = await windowsLocalAgentInstance.executeControlledCommand({
      command: dangerousCmd,
      personality: 'JARVIS'
    });

    assert(rejectedRes.success === false, 'Dangerous command rejected safely by security policy');
    assert(rejectedRes.verified === false, 'Truthfully reports verified: false for blocked command');
    assert(rejectedRes.summary.includes('rejected by security policy'), 'Provides truthful rejection summary');

    // 5b: Syntax or execution failure inside PowerShell
    const failingCmd = 'Get-ChildItem -Path "NonExistentDirectory_XYZ_12345" -ErrorAction Stop';
    const failingRes = await windowsLocalAgentInstance.executeControlledCommand({
      command: failingCmd,
      personality: 'JARVIS'
    });

    assert(failingRes.success === false, 'Command with non-existent path reports success: false');
    assert(failingRes.verified === false, 'Truthfully reports verified: false on non-zero exit code');
    assert(failingRes.exitCode !== 0, 'Authentic non-zero exit code captured', `Exit code: ${failingRes.exitCode}`);

    // 5c: Verify audit log recorded the failure truthfully
    const recentLogs = windowsLocalAgentInstance.getAuditLogs(10);
    const failureLog = recentLogs.find(l => l.action === 'COMMAND_DISALLOWED' || (l.action === 'COMMAND_COMPLETED' && l.verified === false));
    assert(Boolean(failureLog), 'Audit log contains immutable record of failure without obfuscation');
  }

  // ---------------------------------------------------------------------------
  // ACCEPTANCE TEST 6: Emergency Stop Real-Time Process Termination (<100ms)
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 6: Emergency Stop Immediate Process Termination ---');
  {
    // 6a: Spawn a long-running background command (PowerShell Start-Sleep 30)
    let commandPromiseCompleted = false;
    let commandOutcome = null;

    const longRunningPromise = windowsLocalAgentInstance.executeControlledCommand({
      command: 'Start-Sleep -Seconds 30',
      timeoutMs: 35000,
      personality: 'JARVIS'
    }).then(res => {
      commandPromiseCompleted = true;
      commandOutcome = res;
      return res;
    });

    // Allow process to spawn and establish PID
    await new Promise(r => setTimeout(r, 600));

    // Verify process is registered in EmergencyStopController
    const activeProcessesBefore = emergencyStopControllerInstance.getStatus().activeChildProcessCount;
    assert(activeProcessesBefore > 0, 'Background process actively registered with Emergency Stop controller', `Count: ${activeProcessesBefore}`);

    // 6b: Engage Emergency Stop
    const tStopStart = Date.now();
    const eStopResult = emergencyStopControllerInstance.engage('Acceptance test Emergency Stop kill-switch');
    const stopLatency = Date.now() - tStopStart;

    assert(eStopResult.engaged === true, 'Emergency Stop successfully engaged');
    assert(stopLatency < 100, 'Emergency Stop engaged and executed in <100ms', `${stopLatency}ms`);
    assert(eStopResult.abortedChildProcessCount > 0, 'Emergency Stop terminated registered child processes', `Killed: ${eStopResult.abortedChildProcessCount}`);

    // 6c: Verify new command execution is strictly blocked while Emergency Stop is active
    let blockedErrorCaught = false;
    try {
      await windowsLocalAgentInstance.executeControlledCommand({
        command: 'node -v',
        personality: 'JARVIS'
      });
    } catch (e) {
      blockedErrorCaught = true;
      assert(e.message.includes('EMERGENCY_STOP_ACTIVE'), 'New command execution immediately blocked with EMERGENCY_STOP_ACTIVE error');
    }
    assert(blockedErrorCaught === true, 'Emergency Stop latch guarantees zero command execution while engaged');

    // 6d: Reset Emergency Stop
    const resetResult = emergencyStopControllerInstance.reset('Acceptance test completed');
    assert(resetResult.emergencyStopActive === false, 'Emergency Stop cleanly reset to STANDBY');
  }

  // ---------------------------------------------------------------------------
  // ACCEPTANCE TEST 7: Truthful Attribution & Prompt Disclaimers Elimination
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 7: Prompt Directives & Truthful Attribution Verification ---');
  {
    // 7a: Verify prompt contains explicit Local Agent and Desktop Control directives
    assert(
      BASE_JARVIS_PROMPT.includes('REAL WINDOWS LOCAL AGENT & COMPUTER CONTROL CAPABILITIES'),
      'JARVIS base prompt contains explicit Windows Local Agent capability directives'
    );
    assert(
      BASE_JARVIS_PROMPT.includes('NEVER say "I cannot directly control your computer"'),
      'JARVIS base prompt explicitly forbids generic LLM "cannot control computer" disclaimers'
    );
    assert(
      BASE_JARVIS_PROMPT.includes('TRUTHFUL ATTRIBUTION MANDATE'),
      'JARVIS base prompt enforces Truthful Attribution Mandate (never claim success without empirical proof)'
    );

    // 7b: Verify ULTRON prompt has Operating System Integration awareness
    assert(
      BASE_ULTRON_PROMPT.includes('WINDOWS LOCAL AGENT & OPERATING SYSTEM INTEGRATION'),
      'ULTRON base prompt acknowledges STARK Windows Local Agent operating system integration'
    );

    // 7c: Command Interpreter natural language resolution
    const interpNotepad = commandInterpreterInstance.interpret('JARVIS open notepad and write down my project plan');
    assert(
      interpNotepad && interpNotepad.toolName === 'execute_desktop_workflow',
      'CommandInterpreter resolves "open notepad and write..." to execute_desktop_workflow',
      `Tool: ${interpNotepad?.toolName}`
    );

    const interpShell = commandInterpreterInstance.interpret('JARVIS execute harmless shell command "node -v"');
    assert(
      interpShell && interpShell.toolName === 'execute_controlled_shell_command',
      'CommandInterpreter resolves shell command intent to execute_controlled_shell_command',
      `Tool: ${interpShell?.toolName}`
    );

    // 7d: Unified Intelligence Layer task classification
    const classifyCmd = unifiedIntelligenceLayerInstance.classifyTask('execute controlled shell command Get-Date');
    assert(
      classifyCmd.category === 'DESKTOP_AUTOMATION',
      'UnifiedIntelligenceLayer classifies command request as DESKTOP_AUTOMATION',
      `Category: ${classifyCmd.category}`
    );
    assert(
      classifyCmd.recommendedTools.includes('execute_controlled_shell_command'),
      'UnifiedIntelligenceLayer recommends execute_controlled_shell_command tool'
    );

    // 7e: Verify Local Agent Status Report
    const statusReport = windowsLocalAgentInstance.getStatus();
    assert(statusReport.agentName === 'STARK_WINDOWS_LOCAL_AGENT', 'Local Agent status confirms STARK_WINDOWS_LOCAL_AGENT');
    assert(statusReport.capabilities.length >= 6, 'All 6+ core desktop capabilities advertised in status report');
  }

  // ---------------------------------------------------------------------------
  // SUMMARY REPORT
  // ---------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`TEST SUITE SUMMARY: ${passedTests} / ${totalTests} PASSED (${Math.round(passedTests / totalTests * 100)}%)`);
  if (failedTests > 0) {
    console.error(`FAILED: ${failedTests} test(s) failed.`);
  } else {
    console.log('ALL ACCEPTANCE TESTS PASSED ON LIVE WINDOWS ENVIRONMENT! 🚀');
  }
  console.log('================================================================');

  if (failedTests > 0) process.exit(1);
}

runSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
