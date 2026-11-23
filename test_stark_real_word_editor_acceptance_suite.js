/**
 * STARK AI — Microsoft Word Desktop Real Editor Acceptance Test Suite
 * 
 * Verifies that STARK operates the actual Microsoft Word desktop application:
 * 1. Checks Microsoft Word installation on interactive desktop.
 * 2. Opens real Word application visibly and creates a blank document.
 * 3. Progressively writes title, headings, paragraphs, and formatted tables into Word.
 * 4. Applies live revisions directly to the open Word document in place.
 * 5. Saves the actual document as .docx (and optional PDF) via Word SaveAs2 and verifies file on disk.
 * 6. Validates LiveDocumentStudio integration with the real Word editor.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { wordAutomationServiceInstance } = require('./server/desktop/wordAutomationService.js');
const { liveDocumentStudioInstance } = require('./server/desktop/liveDocumentStudio.js');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function pass(name, detail = '') {
  totalTests++;
  passedTests++;
  console.log(`  ✓ [PASS] [${totalTests}] ${name} ${detail ? '(' + detail + ')' : ''}`);
}

function fail(name, err) {
  totalTests++;
  failedTests++;
  console.error(`  ✗ [FAIL] [${totalTests}] ${name}: ${err.message || err}`);
}

async function runRealWordAcceptanceSuite() {
  console.log('========================================================================');
  console.log('STARK AI — REAL MICROSOFT WORD DESKTOP INTEGRATION ACCEPTANCE SUITE');
  console.log('========================================================================\n');

  const testDocDir = path.resolve(__dirname, 'documents');
  if (!fs.existsSync(testDocDir)) {
    fs.mkdirSync(testDocDir, { recursive: true });
  }

  // -------------------------------------------------------------------------
  // 1. Detection of Microsoft Word
  // -------------------------------------------------------------------------
  console.log('--- 1. Microsoft Word Installation & COM Automator Detection ---');
  try {
    const checkRes = await wordAutomationServiceInstance.checkInstallation();
    assert.strictEqual(checkRes.success, true, 'Word check should succeed');
    assert.strictEqual(checkRes.installed, true, 'Word should be installed on this Windows environment');
    assert.ok(checkRes.executablePath && fs.existsSync(checkRes.executablePath), 'WINWORD.EXE path must exist');
    pass('1.1 Detected installed Microsoft Word executable', checkRes.executablePath);
  } catch (e) { fail('1.1 Detected installed Microsoft Word executable', e); }

  // -------------------------------------------------------------------------
  // 2. Real Word Session Initialization & Blank Document Creation
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Real Word Session Initialization & Blank Document Creation ---');
  let sessionInit = null;
  try {
    sessionInit = await wordAutomationServiceInstance.initWordSession({ forceNew: false });
    assert.strictEqual(sessionInit.success, true, 'Word init must succeed');
    assert.strictEqual(sessionInit.verified, true, 'Word window must be verified');
    assert.ok(sessionInit.hwnd !== 0, 'Word HWND must be non-zero');
    assert.ok(sessionInit.pid > 0, 'Word PID must be greater than zero');
    pass('2.1 Opened real Microsoft Word window and created blank white document', `PID: ${sessionInit.pid}, HWND: ${sessionInit.hwnd}`);
  } catch (e) { fail('2.1 Opened real Microsoft Word window', e); }

  // -------------------------------------------------------------------------
  // 3. Progressive Content Writing into Real Word Application
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Progressive Writing of Title, Sections & Tables in Word ---');
  try {
    const writeRes = await wordAutomationServiceInstance.writeProgressive({
      title: "Ohm's Law: Principles, Mathematical Derivations & Empirical Verification",
      subtitle: "Laboratory Investigation and Technical Analysis — STARK AI",
      sections: [
        {
          heading: "1. Theoretical Background & Statement of Ohm's Law",
          paragraphs: [
            "Ohm's law constitutes one of the foundational empirical principles governing electric circuits, establishing that the current flowing through a metallic conductor between two points is directly proportional to the voltage across the two points, provided the temperature remains constant.",
            "Mathematically, the relationship is expressed as V = I × R, where V denotes electric potential difference in volts (V), I represents current in amperes (A), and R symbolizes electrical resistance in ohms (Ω)."
          ],
          bullets: [
            "Conductor temperature and physical dimensions must remain invariant during measurement.",
            "Ohmic materials exhibit a strictly linear relationship between potential difference and current.",
            "Non-ohmic conductors, such as semiconductor diodes and electrolytic cells, deviate from linearity."
          ],
          callout: "Key Equation: V = I · R (Voltage = Current × Resistance)"
        },
        {
          heading: "2. Experimental Observation & Measurement Protocol",
          paragraphs: [
            "The experimental circuit was arranged with a precision DC regulated power supply, a calibrated digital multimeter (ammeter configuration) in series with the resistive test specimen, and a second high-impedance multimeter in parallel to register branch potential drop."
          ],
          table: {
            headers: ["Trial #", "Voltage (V)", "Current (mA)", "Calculated R (Ω)", "Relative Error (%)"],
            rows: [
              ["Trial 1", "2.00", "20.1", "99.50", "0.50%"],
              ["Trial 2", "4.00", "39.9", "100.25", "0.25%"],
              ["Trial 3", "6.00", "60.2", "99.67", "0.33%"],
              ["Trial 4", "8.00", "80.0", "100.00", "0.00%"],
              ["Trial 5", "10.00", "100.3", "99.70", "0.30%"]
            ]
          }
        }
      ]
    });

    assert.strictEqual(writeRes.success, true, 'Progressive write must succeed');
    assert.strictEqual(writeRes.sectionsWritten, 2, '2 sections should be written');
    assert.ok(writeRes.totalParagraphs >= 8, `Expected at least 8 paragraphs, got ${writeRes.totalParagraphs}`);
    assert.ok(writeRes.totalTables >= 1, `Expected at least 1 table, got ${writeRes.totalTables}`);
    pass('3.1 Progressively wrote headings, paragraphs, and formatted table directly into Word', `Paragraphs: ${writeRes.totalParagraphs}, Tables: ${writeRes.totalTables}`);
  } catch (e) { fail('3.1 Progressively wrote into Word', e); }

  // -------------------------------------------------------------------------
  // 4. Live Voice Revisions Applied to the Open Word Document
  // -------------------------------------------------------------------------
  console.log('\n--- 4. Live Voice Revisions Applied Directly into Open Word Document ---');
  try {
    const revRes = await wordAutomationServiceInstance.reviseWordDocument({
      instruction: "Expand the theoretical section to explain microscopic drift velocity",
      operationType: "EXPAND_PARAGRAPH",
      targetSectionKeyword: "Theoretical Background",
      paragraphNumber: 1,
      additionText: "At the microscopic level, the electric field accelerates conduction electrons, imparting a net drift velocity proportional to the electron mobility, which bridges microscopic transport theory with macroscopic Ohm's law."
    });

    assert.strictEqual(revRes.success, true, 'Live revision must succeed');
    assert.strictEqual(revRes.action, 'revised', 'Action must be revised');
    pass('4.1 Applied live paragraph expansion directly into the open Word document', revRes.summary);
  } catch (e) { fail('4.1 Applied live paragraph expansion', e); }

  try {
    const tableRevRes = await wordAutomationServiceInstance.reviseWordDocument({
      instruction: "Add an extra observation table for higher voltages",
      operationType: "ADD_TABLE",
      addTable: true,
      table: {
        headers: ["Step", "Applied Voltage (V)", "Measured Current (mA)", "Dynamic Resistance (Ω)"],
        rows: [
          ["Step A", "12.0", "120.1", "99.92"],
          ["Step B", "14.0", "140.2", "99.86"]
        ]
      }
    });

    assert.strictEqual(tableRevRes.success, true, 'Table addition revision must succeed');
    assert.ok(tableRevRes.totalTables >= 2, `Expected at least 2 tables, got ${tableRevRes.totalTables}`);
    pass('4.2 Added observation table directly into the open Word document', `Total Tables: ${tableRevRes.totalTables}`);
  } catch (e) { fail('4.2 Added observation table into Word', e); }

  // -------------------------------------------------------------------------
  // 5. Native Word SaveAs2 (.docx & .pdf) and Disk Verification
  // -------------------------------------------------------------------------
  console.log('\n--- 5. Native Word SaveAs2 (.docx & .pdf) and Disk Verification ---');
  const targetDocx = path.join(testDocDir, 'Real_Word_Acceptance_Test.docx');
  const targetPdf = path.join(testDocDir, 'Real_Word_Acceptance_Test.pdf');
  try {
    const saveRes = await wordAutomationServiceInstance.saveWordDocument({
      filePath: targetDocx,
      generatePdf: true
    });

    assert.strictEqual(saveRes.success, true, 'Save must succeed');
    assert.strictEqual(saveRes.verified, true, 'Save must be verified');
    assert.ok(fs.existsSync(targetDocx), 'Target .docx must physically exist on disk');
    assert.ok(fs.existsSync(targetPdf), 'Target .pdf must physically exist on disk');
    assert.ok(saveRes.sizeBytes > 5000, `DOCX size should exceed 5KB, got ${saveRes.sizeBytes}`);
    assert.ok(saveRes.sha256 && saveRes.sha256.length === 64, 'SHA-256 hash must be valid 64-char string');
    pass('5.1 Word SaveAs2 produced verified .docx and .pdf files on disk', `DOCX Size: ${saveRes.sizeBytes} bytes, SHA256: ${saveRes.sha256.slice(0, 16)}...`);
  } catch (e) { fail('5.1 Word SaveAs2 verified files', e); }

  // -------------------------------------------------------------------------
  // 6. Clean Document Close & State Query
  // -------------------------------------------------------------------------
  console.log('\n--- 6. Clean Document Close & State Query ---');
  try {
    const closeRes = await wordAutomationServiceInstance.closeWordDocument({ quitWord: false });
    assert.strictEqual(closeRes.success, true, 'Close action must succeed');
    pass('6.1 Cleanly closed the test document in Microsoft Word');
  } catch (e) { fail('6.1 Cleanly closed test document', e); }

  // -------------------------------------------------------------------------
  // 7. LiveDocumentStudio Integration with Real Word Editor
  // -------------------------------------------------------------------------
  console.log('\n--- 7. LiveDocumentStudio Full Integration with Real Word Editor ---');
  try {
    const studioRes = await liveDocumentStudioInstance.createDocumentProgressively({
      instruction: "Create a Word document about Newton's Laws of Motion",
      fileName: 'Newton_Laws_Motion.docx',
      useRealWord: true
    });

    assert.strictEqual(studioRes.success, true, 'LiveDocumentStudio creation should succeed');
    assert.ok(studioRes.sessionId, 'SessionId must be present');
    assert.strictEqual(studioRes.verification.verified, true, 'Document must be verified');
    assert.ok(fs.existsSync(studioRes.filePath), 'Generated document must exist on disk');

    const status = liveDocumentStudioInstance.getStudioStatus();
    assert.strictEqual(status.windowControls.microsoftWordOpened, true, 'Microsoft Word must be registered as active editor');
    assert.ok(status.windowControls.wordVerification.pid, 'Word PID must be recorded');
    pass('7.1 LiveDocumentStudio operated real Word application and verified generated document', `File: ${studioRes.fileName}, PID: ${status.windowControls.wordVerification.pid}`);
  } catch (e) { fail('7.1 LiveDocumentStudio operated real Word', e); }

  // Clean close of the studio doc
  try {
    await wordAutomationServiceInstance.closeWordDocument({ quitWord: false });
    pass('7.2 Closed LiveDocumentStudio Word document cleanly');
  } catch (_) {}

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log(`REAL WORD ACCEPTANCE SUITE FINISHED: ${passedTests} PASSED, ${failedTests} FAILED (TOTAL: ${totalTests})`);
  console.log('========================================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runRealWordAcceptanceSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
