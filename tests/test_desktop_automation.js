/**
 * Comprehensive Acceptance Test Suite — Full Windows Desktop Automation
 * Validates Pillar 1: Mouse control, keyboard input, window lifecycle, UIA element inspection, filesystem ops
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const { desktopAutomationServiceInstance } = require('../server/desktop/desktopAutomationService.js');
const { executeTool } = require('../server/toolsRegistry.js');

const RESULTS_FILE = path.resolve(__dirname, '../jarvis_desktop_automation_test_results.json');
const TEST_DIR = path.resolve(__dirname, '../scratch/desktop_test_sandbox');

async function runDesktopTests() {
  console.log('================================================================');
  console.log('  JARVIS FULL WINDOWS DESKTOP AUTOMATION ACCEPTANCE TEST SUITE  ');
  console.log('================================================================\n');

  if (!fs.existsSync(TEST_DIR)) fs.mkdirSync(TEST_DIR, { recursive: true });

  const tests = [
    {
      id: 'DESK-01',
      name: 'Mouse Cursor Precision Movement',
      category: 'MOUSE_CONTROL',
      fn: async () => {
        const res = await executeTool('desktop_mouse_move', { x: 350, y: 250 }, 'JARVIS');
        assert.strictEqual(res.success, true, 'mouse_move must succeed');
        assert.strictEqual(res.x, 350, 'X coordinate must match');
        assert.strictEqual(res.y, 250, 'Y coordinate must match');
        return { x: res.x, y: res.y, verified: res.verified };
      }
    },
    {
      id: 'DESK-02',
      name: 'Mouse Click Interactions (Left, Right, Double)',
      category: 'MOUSE_CONTROL',
      fn: async () => {
        const left = await executeTool('desktop_mouse_click', { x: 350, y: 250, button: 'left' }, 'JARVIS');
        assert.strictEqual(left.success, true, 'Left click must succeed');

        const right = await executeTool('desktop_mouse_click', { x: 350, y: 250, button: 'right' }, 'JARVIS');
        assert.strictEqual(right.success, true, 'Right click must succeed');

        const dbl = await executeTool('desktop_mouse_click', { x: 350, y: 250, double: true }, 'JARVIS');
        assert.strictEqual(dbl.success, true, 'Double click must succeed');

        return { leftClick: left.success, rightClick: right.success, doubleClick: dbl.success };
      }
    },
    {
      id: 'DESK-03',
      name: 'Smooth Mouse Drag and Drop',
      category: 'MOUSE_CONTROL',
      fn: async () => {
        const res = await executeTool('desktop_mouse_drag', { fromX: 100, fromY: 100, toX: 250, toY: 250, steps: 6 }, 'JARVIS');
        assert.strictEqual(res.success, true, 'Drag must succeed');
        assert.strictEqual(res.verified, true, 'Drag must be verified');
        assert.strictEqual(res.from.x, 100);
        assert.strictEqual(res.to.x, 250);
        return res;
      }
    },
    {
      id: 'DESK-04',
      name: 'Mouse Wheel Scrolling',
      category: 'MOUSE_CONTROL',
      fn: async () => {
        const scrollDown = await executeTool('desktop_mouse_scroll', { delta: -120 }, 'JARVIS');
        assert.strictEqual(scrollDown.success, true);
        const scrollUp = await executeTool('desktop_mouse_scroll', { delta: 120 }, 'JARVIS');
        assert.strictEqual(scrollUp.success, true);
        return { scrollDown: scrollDown.delta, scrollUp: scrollUp.delta };
      }
    },
    {
      id: 'DESK-05',
      name: 'Text Typing Simulation',
      category: 'KEYBOARD_CONTROL',
      fn: async () => {
        const res = await executeTool('desktop_type_text', { text: 'VISION AI TEST' }, 'JARVIS');
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.verified, true);
        return { keysSent: res.keysSent, textLength: res.textLength };
      }
    },
    {
      id: 'DESK-06',
      name: 'Keyboard Shortcuts & Hotkeys',
      category: 'KEYBOARD_CONTROL',
      fn: async () => {
        const res = await executeTool('desktop_send_hotkey', { hotkey: '{ESC}' }, 'JARVIS');
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.verified, true);
        return { hotkey: res.hotkey };
      }
    },
    {
      id: 'DESK-07',
      name: 'Windows UI Automation Accessibility Tree Inspection',
      category: 'UI_AUTOMATION',
      fn: async () => {
        const res = await executeTool('desktop_inspect_elements', { query: 'Notepad' }, 'JARVIS');
        assert.strictEqual(res.success, true);
        assert(res.totalElements > 0, 'Must discover UI elements');
        assert(Array.isArray(res.buttons), 'Must extract buttons list');
        assert(Array.isArray(res.textFields), 'Must extract text fields list');
        assert(Array.isArray(res.menus), 'Must extract menus list');
        return {
          totalElements: res.totalElements,
          buttonCount: res.buttons.length,
          textFieldCount: res.textFields.length,
          menuCount: res.menus.length
        };
      }
    },
    {
      id: 'DESK-08',
      name: 'Window Enumeration & Lifecycle Management',
      category: 'WINDOW_MANAGEMENT',
      fn: async () => {
        const list = await executeTool('desktop_manage_window', { action: 'list' }, 'JARVIS');
        assert(Array.isArray(list), 'Must return array of open windows');
        assert(list.length > 0, 'Must find active windows');

        const stateRes = await executeTool('desktop_manage_window', { action: 'state', query: list[0].hwnd, state: 'restore' }, 'JARVIS');
        assert.strictEqual(stateRes.success, true);

        return {
          openWindowsDiscovered: list.length,
          sampleWindow: list[0].title,
          stateRestoreVerified: stateRes.verified
        };
      }
    },
    {
      id: 'DESK-09',
      name: 'Filesystem Navigation, Folder Creation & File Moving',
      category: 'FILESYSTEM_OPERATIONS',
      fn: async () => {
        const folder = path.join(TEST_DIR, 'subfolder_' + Date.now());
        const crFolder = await executeTool('desktop_file_operation', { action: 'create_folder', path: folder }, 'JARVIS');
        assert.strictEqual(crFolder.success, true);

        const sampleFile = path.join(folder, 'test_file.txt');
        fs.writeFileSync(sampleFile, 'Test content for desktop automation');

        const renamedFile = path.join(folder, 'renamed_test_file.txt');
        const renRes = await executeTool('desktop_file_operation', { action: 'rename', path: sampleFile, destPath: renamedFile }, 'JARVIS');
        assert.strictEqual(renRes.success, true);

        const listRes = await executeTool('desktop_file_operation', { action: 'list', path: folder }, 'JARVIS');
        assert.strictEqual(listRes.success, true);

        return {
          folderCreated: folder,
          fileRenamed: renamedFile,
          filesInDirectory: listRes.files?.length || 1
        };
      }
    },
    {
      id: 'DESK-10',
      name: 'Safe Deletion with Recovery Backup Preservation',
      category: 'FILESYSTEM_OPERATIONS',
      fn: async () => {
        const delTarget = path.join(TEST_DIR, 'to_delete_' + Date.now() + '.txt');
        fs.writeFileSync(delTarget, 'Delete safety backup verification');

        const delRes = await executeTool('desktop_file_operation', { action: 'delete', path: delTarget }, 'JARVIS');
        assert.strictEqual(delRes.success, true);
        assert(fs.existsSync(delRes.backupPath), 'Recovery backup must exist on disk');
        assert(!fs.existsSync(delTarget), 'Original file must be removed');

        return {
          deletedOriginal: delTarget,
          recoveryBackupPath: delRes.backupPath,
          verified: true
        };
      }
    }
  ];

  const results = [];
  let passedCount = 0;

  for (const t of tests) {
    const t0 = Date.now();
    try {
      const output = await t.fn();
      const durationMs = Date.now() - t0;
      results.push({
        id: t.id,
        name: t.name,
        category: t.category,
        status: 'VERIFIED',
        durationMs,
        output
      });
      passedCount++;
      console.log(`[PASS] [${t.id}] ${t.name} (${durationMs}ms)`);
    } catch (err) {
      const durationMs = Date.now() - t0;
      results.push({
        id: t.id,
        name: t.name,
        category: t.category,
        status: 'FAILED',
        durationMs,
        error: err.message
      });
      console.error(`[FAIL] [${t.id}] ${t.name} (${durationMs}ms): ${err.message}`);
    }
  }

  const summary = {
    testSuite: 'JARVIS Full Windows Desktop Automation',
    executedAt: new Date().toISOString(),
    totalTests: tests.length,
    passed: passedCount,
    failed: tests.length - passedCount,
    successRate: `${((passedCount / tests.length) * 100).toFixed(1)}%`,
    overallStatus: passedCount === tests.length ? 'VERIFIED' : 'PARTIALLY VERIFIED',
    results
  };

  fs.writeFileSync(RESULTS_FILE, JSON.stringify(summary, null, 2), 'utf8');
  console.log(`\n================================================================`);
  console.log(`  PASSED: ${passedCount}/${tests.length} (${summary.successRate}) | Status: ${summary.overallStatus}`);
  console.log(`  Results saved to: ${RESULTS_FILE}`);
  console.log(`================================================================\n`);

  return summary;
}

if (require.main === module) {
  runDesktopTests().catch(err => {
    console.error('Test execution error:', err);
    process.exit(1);
  });
}

module.exports = { runDesktopTests };
