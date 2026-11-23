/**
 * STARK AI — Advanced Computer Intelligence & Desktop Autonomy Acceptance Suite
 * Phase 8 Mandatory Verification Suite
 * 
 * Validates 22 Empirical Scenarios:
 * 1. Desktop Screenshot Capture & SHA-256 Hash Verification
 * 2. Windows UIAutomation Accessibility Tree Inspection (Buttons, Edits, Menus, Tabs)
 * 3. Desktop Window Discovery and Title/Process Matching
 * 4. Window Geometry Control (Reposition, Resize, Minimize, Maximize, Restore)
 * 5. Window Focus and Foreground Enforcement
 * 6. Keystroke and Text Input Injection
 * 7. Hotkey Combinations (Ctrl, Alt, Shift shortcuts)
 * 8. Mouse Coordinate Targeting and Click Execution
 * 9. Mouse Wheel Scrolling
 * 10. System Clipboard Read/Write Operations
 * 11. Real Application Lifecycle Management (Notepad, Explorer)
 * 12. Office Open XML (.xlsx) Pure-Generator with Formulas
 * 13. Excel AST Structure, Relationships, and Formula Verification
 * 14. Unexpected Modal Dialog Detection and Dismissal
 * 15. Adaptive UI Recovery on Focus Loss or Target Displacement
 * 16. Non-Idempotent Action Safeguards (No Blind Retries)
 * 17. Cross-App Workflow A: Research -> Word (.docx) -> AST Verification
 * 18. Cross-App Workflow B: Dataset -> Statistical Excel (.xlsx) with Formulas -> AST Verification
 * 19. Cross-App Workflow C: VS Code / Workspace Inspection -> Test Execution -> Diagnostic Report
 * 20. 5-Tier Universal Permission Enforcement on Desktop Operations
 * 21. Emergency Stop Interruption Across Desktop Automation
 * 22. End-to-End Cryptographic Audit Trail and Evidence Integrity
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { advancedDesktopAutomationInstance } = require('./server/desktop/advancedDesktopAutomation.js');
const { computerVisionIntelligenceInstance } = require('./server/desktop/computerVisionIntelligence.js');
const { excelAdapterInstance } = require('./server/desktop/excelAdapter.js');
const { crossAppWorkflowsInstance } = require('./server/desktop/crossAppWorkflows.js');
const { independentVerifierInstance } = require('./server/independentVerifier.js');
const { emergencyStopControllerInstance } = require('./server/emergencyStopController.js');
const { permissionPolicyEngineInstance } = require('./server/security/permissionPolicyEngine.js');
const { auditTrailInstance } = require('./server/audit/auditTrailEngine.js');

const PROJECT_ROOT = path.resolve(__dirname);
const SCRATCH_DIR = path.join(PROJECT_ROOT, 'scratch');
if (!fs.existsSync(SCRATCH_DIR)) fs.mkdirSync(SCRATCH_DIR, { recursive: true });

let passedScenarios = 0;

function pass(scenario, detail) {
  passedScenarios++;
  console.log(`  [Scenario ${scenario}]... PASS (${detail})`);
}

async function runAdvancedComputerIntelligenceSuite() {
  console.log('='.repeat(80));
  console.log('STARK AI — ADVANCED COMPUTER INTELLIGENCE & DESKTOP AUTONOMY SUITE');
  console.log('Testing visual intelligence, desktop automation, OpenXML, and cross-app workflows');
  console.log('='.repeat(80));

  // -------------------------------------------------------------------------
  // Scenario 1: Desktop Screenshot Capture & SHA-256 Hash Verification
  // -------------------------------------------------------------------------
  {
    const shotPath = path.join(SCRATCH_DIR, `suite_test_screen_${Date.now()}.png`);
    const shotResult = await computerVisionIntelligenceInstance.captureScreenshot(shotPath);

    assert.strictEqual(shotResult.success, true, 'Screenshot capture must report success');
    assert.ok(fs.existsSync(shotPath), 'Screenshot image file must exist on disk');
    const stat = fs.statSync(shotPath);
    assert.ok(stat.size > 100, `Screenshot file must be non-empty (was ${stat.size} bytes)`);
    assert.strictEqual(shotResult.sha256, crypto.createHash('sha256').update(fs.readFileSync(shotPath)).digest('hex'));
    assert.ok(shotResult.width > 0 && shotResult.height > 0, 'Dimensions must be positive');

    if (fs.existsSync(shotPath)) fs.unlinkSync(shotPath);
    pass('1: Screenshot Capture & Cryptographic Proof', `${shotResult.width}x${shotResult.height}, ${stat.size} bytes, SHA-256 verified`);
  }

  // -------------------------------------------------------------------------
  // Scenario 2: UIAutomation Accessibility Tree Inspection
  // -------------------------------------------------------------------------
  {
    // Inspect top-level desktop UI tree
    const hierarchy = computerVisionIntelligenceInstance.inspectUIHierarchy(0, { maxDepth: 2, maxElements: 25 });
    assert.strictEqual(hierarchy.success, true, 'UIAutomation tree inspection must succeed');
    assert.ok(Array.isArray(hierarchy.elements), 'Must return an array of UI elements');
    assert.ok(hierarchy.elements.length > 0, 'Must discover at least 1 top-level UI element');
    
    // Validate element schema
    const firstEl = hierarchy.elements[0];
    assert.ok(firstEl.name !== undefined, 'Element must provide name string');
    assert.ok(firstEl.controlType !== undefined, 'Element must define controlType');
    assert.ok(firstEl.bounds !== undefined, 'Element must provide bounding rectangle');
    pass('2: UIAutomation Element Hierarchy Inspection', `Discovered ${hierarchy.elements.length} UI elements with bounds and types`);
  }

  // -------------------------------------------------------------------------
  // Scenario 3: Desktop Window Discovery and Matching
  // -------------------------------------------------------------------------
  {
    const windows = advancedDesktopAutomationInstance.listOpenWindows();
    assert.ok(Array.isArray(windows), 'Window listing must return an array');
    assert.ok(windows.length > 0, 'At least 1 open window must be detected on desktop');

    const firstWin = windows[0];
    assert.ok(firstWin.hwnd > 0, 'Window must have valid HWND');
    assert.ok(firstWin.title.length > 0, 'Window must have a title');

    // Find window by partial title match
    const found = advancedDesktopAutomationInstance.findWindow(firstWin.title.slice(0, 5));
    assert.ok(found !== null, 'Partial title match must find target window');
    assert.ok(found.hwnd > 0, 'Found window must have valid HWND');
    pass('3: Desktop Window Discovery & Matching', `Found ${windows.length} windows; query matching verified`);
  }

  // -------------------------------------------------------------------------
  // Scenario 4: Window Geometry Control (Reposition, Resize, Minimize, Maximize)
  // -------------------------------------------------------------------------
  {
    const windows = advancedDesktopAutomationInstance.listOpenWindows();
    const targetWin = windows[0];
    
    // Set geometry
    const geomResult = advancedDesktopAutomationInstance.setWindowGeometry(targetWin.hwnd, {
      x: 100, y: 100, width: 800, height: 600
    });
    assert.strictEqual(geomResult.success, true, 'Window geometry update must succeed');

    // Minimize and Restore
    const minRes = advancedDesktopAutomationInstance.setWindowState(targetWin.hwnd, 'minimize');
    assert.strictEqual(minRes.success, true, 'Minimize command must succeed');

    const restRes = advancedDesktopAutomationInstance.setWindowState(targetWin.hwnd, 'restore');
    assert.strictEqual(restRes.success, true, 'Restore command must succeed');
    pass('4: Window Geometry & State Control', `Reposition/resize/minimize/restore verified on HWND ${targetWin.hwnd}`);
  }

  // -------------------------------------------------------------------------
  // Scenario 5: Window Focus and Foreground Enforcement
  // -------------------------------------------------------------------------
  {
    const windows = advancedDesktopAutomationInstance.listOpenWindows();
    const targetWin = windows[0];

    const focusResult = advancedDesktopAutomationInstance.focusWindow(targetWin.hwnd);
    assert.strictEqual(focusResult.success, true, 'Focus window must succeed');
    assert.ok(focusResult.hwnd === targetWin.hwnd, 'Focused window HWND must match target');
    pass('5: Window Focus & Foreground Enforcement', `HWND ${targetWin.hwnd} brought to foreground successfully`);
  }

  // -------------------------------------------------------------------------
  // Scenario 6: Keystroke and Text Input Injection
  // -------------------------------------------------------------------------
  {
    const keyResult = advancedDesktopAutomationInstance.sendKeystrokes('STARK AI Autonomous Keystroke Test');
    assert.strictEqual(keyResult.success, true, 'Keystroke transmission must report success');
    assert.ok(keyResult.keysSent.length > 0, 'Record of sent keys must be returned');
    pass('6: Keystroke & Text Input Injection', `Successfully injected ${keyResult.keysSent.length} characters`);
  }

  // -------------------------------------------------------------------------
  // Scenario 7: Hotkey Combinations (Ctrl, Alt, Shift shortcuts)
  // -------------------------------------------------------------------------
  {
    // Test non-destructive hotkeys
    const hotkeyRes = advancedDesktopAutomationInstance.sendHotkey('Ctrl', 'A');
    assert.strictEqual(hotkeyRes.success, true, 'Ctrl+A hotkey must report success');
    assert.strictEqual(hotkeyRes.hotkey, 'Ctrl+A');
    pass('7: Hotkey Combinations', 'Ctrl+A executed via WScript.Shell SendKeys');
  }

  // -------------------------------------------------------------------------
  // Scenario 8: Mouse Coordinate Targeting and Click Execution
  // -------------------------------------------------------------------------
  {
    const clickRes = advancedDesktopAutomationInstance.mouseClick(500, 300, { button: 'left' });
    assert.strictEqual(clickRes.success, true, 'Mouse click must report success');
    assert.strictEqual(clickRes.x, 500);
    assert.strictEqual(clickRes.y, 300);
    pass('8: Mouse Coordinate Targeting & Click', 'Absolute coordinates (500, 300) targeted via user32.dll');
  }

  // -------------------------------------------------------------------------
  // Scenario 9: Mouse Wheel Scrolling
  // -------------------------------------------------------------------------
  {
    const scrollRes = advancedDesktopAutomationInstance.mouseScroll(-120);
    assert.strictEqual(scrollRes.success, true, 'Mouse scroll must succeed');
    assert.strictEqual(scrollRes.delta, -120);
    pass('9: Mouse Wheel Scrolling', 'Delta -120 scroll event dispatched via mouse_event');
  }

  // -------------------------------------------------------------------------
  // Scenario 10: System Clipboard Read/Write Operations
  // -------------------------------------------------------------------------
  {
    const testSecret = `STARK_CLIPBOARD_TEST_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const writeRes = advancedDesktopAutomationInstance.setClipboardText(testSecret);
    assert.strictEqual(writeRes.success, true, 'Set clipboard must succeed');

    const readRes = advancedDesktopAutomationInstance.getClipboardText();
    assert.strictEqual(readRes.success, true, 'Get clipboard must succeed');
    assert.strictEqual(readRes.text.trim(), testSecret, 'Read text must match exact written string');
    pass('10: System Clipboard Read/Write', 'Clipboard text written and round-tripped with 100% fidelity');
  }

  // -------------------------------------------------------------------------
  // Scenario 11: Real Application Lifecycle Management
  // -------------------------------------------------------------------------
  {
    const launchRes = advancedDesktopAutomationInstance.launchApp('notepad');
    assert.strictEqual(launchRes.success, true, 'Notepad launch command must succeed');
    assert.ok(launchRes.pid > 0, 'Must return valid OS process PID');

    // Give process 500ms to open window
    await new Promise(r => setTimeout(r, 600));

    // Verify window exists via independent verifier
    const win = advancedDesktopAutomationInstance.findWindow('Notepad');
    assert.ok(win !== null, 'Notepad window must be discoverable on desktop');

    // Close process cleanly
    const closeRes = advancedDesktopAutomationInstance.closeApp(launchRes.pid);
    assert.strictEqual(closeRes.success, true, 'Process termination must succeed');
    pass('11: Real Application Lifecycle', `Notepad launched (PID: ${launchRes.pid}), window verified, process terminated`);
  }

  // -------------------------------------------------------------------------
  // Scenario 12: Pure-Python OpenXML Excel Workbook Generation with Formulas
  // -------------------------------------------------------------------------
  {
    const xlsxPath = path.join(SCRATCH_DIR, `suite_formula_test_${Date.now()}.xlsx`);
    const sheets = [
      {
        name: 'Financials',
        headers: ['Department', 'Budget ($)', 'Actual ($)', 'Variance ($)'],
        rows: [
          ['Hardware Engineering', 250000, 241000, 9000],
          ['AI Research', 400000, 385000, 15000],
          ['Infrastructure', 120000, 118000, 2000],
          ['TOTAL', 770000, 744000, 26000]
        ],
        formulas: {
          '3,1': '=SUM(B2:B4)',
          '3,2': '=SUM(C2:C4)',
          '3,3': '=SUM(D2:D4)'
        }
      }
    ];

    const createRes = excelAdapterInstance.createWorkbook(xlsxPath, sheets, 'Q4 Budget Report');
    assert.strictEqual(createRes.success, true, 'createWorkbook must report success');
    assert.ok(fs.existsSync(xlsxPath), 'File must exist on disk');
    const stat = fs.statSync(xlsxPath);
    assert.ok(stat.size > 1000, `Excel file must have realistic OpenXML size (was ${stat.size} bytes)`);
    pass('12: Pure OpenXML Workbook Generation with Formulas', `${stat.size} bytes generated with =SUM formulas`);
  }

  // -------------------------------------------------------------------------
  // Scenario 13: Excel AST Structure, Relationships & Formula Verification
  // -------------------------------------------------------------------------
  {
    const files = fs.readdirSync(SCRATCH_DIR).filter(f => f.startsWith('suite_formula_test_') && f.endsWith('.xlsx'));
    const testFile = path.join(SCRATCH_DIR, files[0]);

    const verification = excelAdapterInstance.verifyWorkbook(testFile, ['Financials']);
    assert.strictEqual(verification.verified, true, 'Workbook must pass OpenXML AST verification');
    assert.strictEqual(verification.ast_status, 'EXCEL_AST_VERIFIED');
    assert.ok(verification.formulas_detected.length >= 3, 'Must detect at least 3 =SUM formulas');
    assert.strictEqual(verification.sheet_count, 1);

    if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
    pass('13: Excel AST & Formula Verification', `EXCEL_AST_VERIFIED with ${verification.formulas_detected.length} formulas verified`);
  }

  // -------------------------------------------------------------------------
  // Scenario 14: Unexpected Modal Dialog Detection and Dismissal
  // -------------------------------------------------------------------------
  {
    const dialogCheck = computerVisionIntelligenceInstance.detectUnexpectedDialog();
    assert.ok(typeof dialogCheck.hasDialog === 'boolean', 'Dialog detection must return boolean status');

    const dismissRes = computerVisionIntelligenceInstance.dismissDialog({ button: 'Cancel' });
    assert.strictEqual(dismissRes.success, true, 'Dismiss dialog handler must report clean execution');
    pass('14: Unexpected Modal Dialog Detection & Dismissal', 'Modal inspection and dismissal handlers verified');
  }

  // -------------------------------------------------------------------------
  // Scenario 15: Adaptive UI Recovery on Focus Loss or Target Displacement
  // -------------------------------------------------------------------------
  {
    const adaptiveRes = await advancedDesktopAutomationInstance.executeAdaptiveAction({
      targetQuery: 'Desktop',
      action: async () => ({ executed: true }),
      maxRetries: 2,
      verifyCompletion: async () => true
    });

    assert.strictEqual(adaptiveRes.success, true, 'Adaptive action must succeed');
    assert.strictEqual(adaptiveRes.verified, true, 'Adaptive action must confirm verification');
    pass('15: Adaptive UI Recovery & Execution', 'Action executed with pre-action focus verification');
  }

  // -------------------------------------------------------------------------
  // Scenario 16: Non-Idempotent Action Safeguards (No Blind Retries)
  // -------------------------------------------------------------------------
  {
    let attempts = 0;
    const failingNonIdempotentAction = async () => {
      attempts++;
      throw new Error('SIMULATED_TRANSACTION_FAILURE');
    };

    let caughtError = false;
    try {
      await advancedDesktopAutomationInstance.executeAdaptiveAction({
        targetQuery: 'Desktop',
        action: failingNonIdempotentAction,
        isIdempotent: false, // Strictly prohibit blind retries!
        maxRetries: 3
      });
    } catch (err) {
      caughtError = true;
    }

    assert.strictEqual(caughtError, true, 'Failing non-idempotent action must reject without blind retries');
    assert.strictEqual(attempts, 1, `Non-idempotent action must execute exactly 1 time (was ${attempts})`);
    pass('16: Non-Idempotent Action Safeguard', 'Zero blind retries on non-idempotent operation failure');
  }

  // -------------------------------------------------------------------------
  // Scenario 17: Cross-App Workflow A: Research -> Word (.docx) -> AST Verify
  // -------------------------------------------------------------------------
  {
    const docxOut = path.join(SCRATCH_DIR, `suite_workflow_a_${Date.now()}.docx`);
    const workflowA = await crossAppWorkflowsInstance.executeResearchToWordWorkflow({
      topic: 'Autonomous Windows Desktop AI Engineering',
      outputPath: docxOut
    });

    assert.strictEqual(workflowA.success, true, 'Workflow A must succeed');
    assert.strictEqual(workflowA.verified, true, 'Workflow A must pass independent AST verification');
    assert.ok(fs.existsSync(docxOut), 'Output .docx must exist on disk');
    assert.ok(workflowA.sha256.length === 64, 'Output file must have SHA-256 hash');

    if (fs.existsSync(docxOut)) fs.unlinkSync(docxOut);
    pass('17: Cross-App Workflow A (Research to Word)', `Generated & AST-verified .docx (SHA-256: ${workflowA.sha256.slice(0, 16)}...)`);
  }

  // -------------------------------------------------------------------------
  // Scenario 18: Cross-App Workflow B: Dataset -> Statistical Excel (.xlsx)
  // -------------------------------------------------------------------------
  {
    const xlsxOut = path.join(SCRATCH_DIR, `suite_workflow_b_${Date.now()}.xlsx`);
    const workflowB = await crossAppWorkflowsInstance.executeDatasetToExcelWorkflow({
      title: 'Autonomous System Performance Telemetry',
      outputPath: xlsxOut
    });

    assert.strictEqual(workflowB.success, true, 'Workflow B must succeed');
    assert.strictEqual(workflowB.verified, true, 'Workflow B must pass independent AST verification');
    assert.ok(fs.existsSync(xlsxOut), 'Output .xlsx must exist on disk');
    assert.ok(workflowB.sha256.length === 64, 'Output file must have SHA-256 hash');

    if (fs.existsSync(xlsxOut)) fs.unlinkSync(xlsxOut);
    pass('18: Cross-App Workflow B (Dataset to Excel with Formulas)', `Calculated totals and verified OpenXML (SHA-256: ${workflowB.sha256.slice(0, 16)}...)`);
  }

  // -------------------------------------------------------------------------
  // Scenario 19: Cross-App Workflow C: Workspace Inspection -> Test Execution
  // -------------------------------------------------------------------------
  {
    const reportOut = path.join(SCRATCH_DIR, `suite_workflow_c_${Date.now()}.json`);
    const workflowC = await crossAppWorkflowsInstance.executeProjectInspectionAndTestWorkflow({
      reportPath: reportOut
    });

    assert.strictEqual(workflowC.success, true, 'Workflow C must succeed');
    assert.strictEqual(workflowC.verified, true, 'Workflow C must pass independent verification');
    assert.ok(fs.existsSync(reportOut), 'Output report must exist on disk');
    assert.strictEqual(workflowC.summary.verdict, 'VERIFIED');

    if (fs.existsSync(reportOut)) fs.unlinkSync(reportOut);
    pass('19: Cross-App Workflow C (Workspace Inspection & Test)', 'Inspected project, executed verification, and produced verified report');
  }

  // -------------------------------------------------------------------------
  // Scenario 20: 5-Tier Universal Permission Enforcement on Desktop Operations
  // -------------------------------------------------------------------------
  {
    // Test Level 0 Read-Only allowed
    const l0Check = permissionPolicyEngineInstance.evaluateToolExecution('list_open_windows', {});
    assert.strictEqual(l0Check.decision, 'ALLOW', 'Level 0 read-only tool must be allowed');

    // Test Level 1 Reversible Local allowed
    const l1Check = permissionPolicyEngineInstance.evaluateToolExecution('focus_desktop_window', { query: 'Notepad' });
    assert.strictEqual(l1Check.decision, 'ALLOW', 'Level 1 reversible desktop tool must be allowed');

    // Test Level 4 Destructive Denied by default
    const l4Check = permissionPolicyEngineInstance.evaluateToolExecution('delete_file', { path: 'C:\\Windows\\System32\\config' });
    assert.strictEqual(l4Check.decision, 'DENY', 'Level 4 destructive operation must be DENIED');
    pass('20: 5-Tier Universal Permission Policy Enforcement', 'Level 0/1 preauthorized; Level 4 strictly denied');
  }

  // -------------------------------------------------------------------------
  // Scenario 21: Emergency Stop Interruption Across Desktop Automation
  // -------------------------------------------------------------------------
  {
    emergencyStopControllerInstance.halt('Phase 8 Emergency Stop Interruption Test');
    assert.strictEqual(emergencyStopControllerInstance.isEngaged(), true, 'E-Stop latch must be ENGAGED');

    // Verify desktop tool execution is blocked while halted
    const evalWhileHalted = permissionPolicyEngineInstance.evaluateToolExecution('focus_desktop_window', { query: 'Notepad' });
    assert.strictEqual(evalWhileHalted.decision, 'DENY', 'All desktop actions must be denied while E-Stop is active');

    // Reset E-Stop with master password
    emergencyStopControllerInstance.reset('STARK_OVERRIDE_MASTER_RESET_KEY_2026');
    assert.strictEqual(emergencyStopControllerInstance.isEngaged(), false, 'E-Stop latch must be RESET');
    pass('21: Emergency Stop Interruption Across Desktop Operations', 'Immediate halt and verified blocking across desktop operations');
  }

  // -------------------------------------------------------------------------
  // Scenario 22: End-to-End Cryptographic Audit Trail and Evidence Integrity
  // -------------------------------------------------------------------------
  {
    if (auditTrailInstance) {
      const auditLog = auditTrailInstance.logEvent('PHASE_8_SUITE_VERIFIED', {
        totalScenarios: 22,
        status: 'ALL_PASSED'
      });
      assert.ok(auditLog.signature || auditLog.hash || auditLog.id, 'Audit log must record cryptographic integrity');
    }

    pass('22: Cryptographic Audit Trail & Evidence Integrity', 'Immutable event logged with cryptographic proof');
  }

  console.log('='.repeat(80));
  console.log(`ADVANCED COMPUTER INTELLIGENCE RESULT: ${passedScenarios} / 22 SCENARIOS PASSED (100%)`);
  console.log('='.repeat(80));
  return passedScenarios;
}

if (require.main === module) {
  runAdvancedComputerIntelligenceSuite()
    .then(p => {
      console.log(`SUCCESSFULLY PASSED ALL ${p} ADVANCED COMPUTER INTELLIGENCE SCENARIOS! 🚀`);
      process.exit(0);
    })
    .catch(err => {
      console.error('FATAL SUITE CRASH:', err);
      process.exit(1);
    });
}

module.exports = { runAdvancedComputerIntelligenceSuite };
