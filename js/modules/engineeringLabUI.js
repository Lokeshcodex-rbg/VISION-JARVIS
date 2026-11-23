/**
 * VISION AI — Iron Man-Inspired Engineering Lab UI
 * Features 7 comprehensive projects, 13-step verified engineering workflows,
 * live numerical calculation solvers, parametric OpenSCAD CAD viewer,
 * and pedagogical design tutoring.
 */

export class EngineeringLabUI {
  constructor(containerElement) {
    this.container = containerElement;
    this.projects = [];
    this.selectedProject = null;
    this.activeTab = 'workflow'; // 'workflow' | 'calculations' | 'cad' | 'materials'
    this.materials = {};

    this.init();
  }

  async init() {
    this.renderLoading();
    await this.loadData();
    this.render();
  }

  renderLoading() {
    this.container.innerHTML = `
      <div class="eng-loading-state">
        <div class="eng-spinner">⚙️</div>
        <h3>Initializing VISION AI Engineering Lab...</h3>
        <p>Loading 7 robotics blueprints, 13-step workflows, and material property databases.</p>
      </div>
    `;
  }

  async loadData() {
    try {
      const [projRes, matRes] = await Promise.all([
        fetch('/api/engineering/projects').then(r => r.json()),
        fetch('/api/engineering/materials').then(r => r.json())
      ]);

      if (projRes.success && projRes.projects) {
        this.projects = projRes.projects;
        this.selectedProject = this.projects[0];
      }
      if (matRes.success && matRes.materials) {
        this.materials = matRes.materials;
      }
    } catch (err) {
      console.error('[EngineeringLab] Failed to fetch data:', err);
    }
  }

  render() {
    if (!this.selectedProject) {
      this.container.innerHTML = `<div class="eng-error">No engineering projects found. Check backend status.</div>`;
      return;
    }

    const p = this.selectedProject;
    const isConceptual = p.isConceptualOnly || p.classification?.includes('CONCEPTUAL');

    this.container.innerHTML = `
      <div class="engineering-lab-layout">
        <!-- Top Project Switcher Header -->
        <div class="eng-project-selector-bar">
          <div class="eng-header-title">
            <span class="eng-icon">🦾</span>
            <div>
              <h3>VISION AI Engineering & Robotics Lab</h3>
              <span class="eng-subtitle">Iron Man Advanced Prototyping, Kinematics, Dynamics & Parametric CAD</span>
            </div>
          </div>

          <div class="eng-project-dropdown-wrapper">
            <label for="project-select-dropdown">Active Project:</label>
            <select id="project-select-dropdown" class="eng-dropdown">
              ${this.projects.map(proj => `
                <option value="${proj.projectId}" ${proj.projectId === p.projectId ? 'selected' : ''}>
                  ${proj.title} ${proj.isConceptualOnly ? '(Simulation Study)' : ''}
                </option>
              `).join('')}
            </select>
          </div>
        </div>

        <!-- Warning banner if conceptual simulation only -->
        ${isConceptual ? `
          <div class="eng-conceptual-warning-banner">
            <span class="warning-icon">⚠️</span>
            <div class="warning-text">
              <strong>STRICTLY CONCEPTUAL MODEL & NON-OPERATIONAL SIMULATION</strong>
              <p>Physical construction of high-energy propulsion or pressurized human-worn flight machinery requires certified aerospace laboratory facilities. Calculations here are bounded computational simulations.</p>
            </div>
          </div>
        ` : ''}

        <!-- Project Hero Card -->
        <div class="eng-hero-card">
          <div class="eng-hero-left">
            <div class="project-badge ${isConceptual ? 'badge-conceptual' : 'badge-hardware'}">
              ${isConceptual ? 'SIMULATION STUDY' : 'HARDWARE PROTOTYPE'}
            </div>
            <h2>${p.title}</h2>
            <p class="project-arch-desc">${p.architecture || p.description}</p>
          </div>
          <div class="eng-hero-right">
            <div class="eng-metric-chip">
              <span class="metric-label">Estimated BOM</span>
              <span class="metric-val">$${p.totalEstimatedBOM_USD ? p.totalEstimatedBOM_USD.toFixed(2) : (p.totalEstimatedConceptualCostUSD ? p.totalEstimatedConceptualCostUSD.toLocaleString() : 'N/A')}</span>
            </div>
            <div class="eng-metric-chip">
              <span class="metric-label">Safety Factor</span>
              <span class="metric-val">${p.safetyFactor ? p.safetyFactor + 'x' : 'Simulation'}</span>
            </div>
            <button id="btn-teach-design" class="stark-btn stark-btn-primary" title="Ask JARVIS to teach the physics and design of this project">
              🎓 Teach Me This Design
            </button>
          </div>
        </div>

        <!-- Navigation Tabs: 13-Step Workflow, Solvers, CAD, Materials -->
        <div class="eng-nav-tabs">
          <button class="eng-tab-btn ${this.activeTab === 'workflow' ? 'active' : ''}" data-tab="workflow">📋 13-Step Verified Workflow</button>
          <button class="eng-tab-btn ${this.activeTab === 'calculations' ? 'active' : ''}" data-tab="calculations">🧮 Engineering Solvers (Torque / Beam / Kinematics)</button>
          <button class="eng-tab-btn ${this.activeTab === 'cad' ? 'active' : ''}" data-tab="cad">📐 Parametric 3D CAD (OpenSCAD)</button>
          <button class="eng-tab-btn ${this.activeTab === 'materials' ? 'active' : ''}" data-tab="materials">🧱 Materials Database (Al, Ti, Carbon, Polymers)</button>
        </div>

        <!-- Tab Body Content -->
        <div class="eng-tab-content" id="eng-tab-content">
          ${this.renderTabBody()}
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  renderTabBody() {
    const p = this.selectedProject;

    if (this.activeTab === 'workflow') {
      return `
        <div class="workflow-steps-grid">
          ${(p.workflow13Steps || []).map(step => `
            <div class="workflow-step-card status-${step.status.toLowerCase()}">
              <div class="step-header">
                <span class="step-num">Step ${step.step}</span>
                <span class="step-status-tag">${step.status}</span>
              </div>
              <div class="step-name">${step.name}</div>
              <div class="step-deliverable">${step.deliverable}</div>
            </div>
          `).join('')}
        </div>
      `;
    }

    if (this.activeTab === 'calculations') {
      return `
        <div class="eng-solvers-container">
          <!-- Actuator Torque Solver -->
          <div class="solver-card">
            <div class="solver-header">
              <h4>⚡ Actuator Sizing & Dynamic Torque Solver</h4>
              <span class="equation-tag">tau = (m*g*L) + (I * alpha)</span>
            </div>
            <div class="solver-form-row">
              <label>Payload (kg): <input type="number" id="calc-payload" value="1.5" step="0.1" /></label>
              <label>Link Length (m): <input type="number" id="calc-length" value="0.45" step="0.05" /></label>
              <label>Arm Mass (kg): <input type="number" id="calc-arm-mass" value="0.8" step="0.1" /></label>
              <label>Angular Accel (rad/s²): <input type="number" id="calc-accel" value="2.5" step="0.5" /></label>
              <button id="btn-run-torque-calc" class="stark-btn stark-btn-primary">Calculate Torque</button>
            </div>
            <div id="torque-result-box" class="solver-result-box">
              <span class="placeholder-text">Click "Calculate Torque" to run verified numerical sizing.</span>
            </div>
          </div>

          <!-- Beam Deflection Solver -->
          <div class="solver-card">
            <div class="solver-header">
              <h4>📏 Cantilever Beam Stress & Deflection</h4>
              <span class="equation-tag">delta = (P * L^3) / (3 * E * I)</span>
            </div>
            <div class="solver-form-row">
              <label>Tip Load (N): <input type="number" id="calc-beam-load" value="65" /></label>
              <label>Beam Length (m): <input type="number" id="calc-beam-len" value="0.35" step="0.05" /></label>
              <label>Material:
                <select id="calc-beam-mat">
                  <option value="aluminum_6061_t6">Aluminum 6061-T6</option>
                  <option value="titanium_ti6al4v">Titanium Grade 5</option>
                  <option value="steel_4140">Alloy Steel 4140</option>
                  <option value="petg_polymer">PETG Polymer</option>
                </select>
              </label>
              <button id="btn-run-beam-calc" class="stark-btn stark-btn-primary">Analyze Beam</button>
            </div>
            <div id="beam-result-box" class="solver-result-box">
              <span class="placeholder-text">Click "Analyze Beam" to compute bending stress, von Mises safety factor, and tip deflection.</span>
            </div>
          </div>
        </div>
      `;
    }

    if (this.activeTab === 'cad') {
      return `
        <div class="cad-generator-card">
          <div class="cad-header">
            <h4>📐 Algorithmic 3D CAD Parametric Model</h4>
            <button id="btn-copy-cad" class="stark-btn stark-btn-glass">📋 Copy OpenSCAD Code</button>
          </div>
          <p class="cad-desc">Generated parametric OpenSCAD script for rapid manufacturing or 3D printing.</p>
          <pre id="cad-code-pre" class="cad-code-pre"><code>// Loading CAD geometry...</code></pre>
          <div class="cad-footer-instructions">
            <span>Render in OpenSCAD via CLI: <code>openscad -o model.stl model.scad</code></span>
          </div>
        </div>
      `;
    }

    if (this.activeTab === 'materials') {
      return `
        <div class="materials-table-card">
          <h4>🧱 Engineering Materials Database</h4>
          <p>Verified mechanical, thermal, and cost parameters used for all structural analysis.</p>
          <div class="table-responsive">
            <table class="eng-table">
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Density (kg/m³)</th>
                  <th>Young's Modulus (GPa)</th>
                  <th>Yield Strength (MPa)</th>
                  <th>Cost ($/kg)</th>
                  <th>Machinability / Prototyping</th>
                </tr>
              </thead>
              <tbody>
                ${Object.entries(this.materials).map(([k, m]) => `
                  <tr>
                    <td><strong>${m.name}</strong></td>
                    <td>${m.densityKgM3}</td>
                    <td>${m.youngsModulusGPa}</td>
                    <td>${m.yieldStrengthMPa}</td>
                    <td>$${m.estimatedCostPerKg.toFixed(2)}</td>
                    <td>${m.machinabilityRating}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    return '';
  }

  attachEventListeners() {
    // Project dropdown
    const dropdown = this.container.querySelector('#project-select-dropdown');
    if (dropdown) {
      dropdown.addEventListener('change', (e) => {
        const pId = e.target.value;
        const found = this.projects.find(p => p.projectId === pId);
        if (found) {
          this.selectedProject = found;
          this.render();
          if (this.activeTab === 'cad') this.loadCADModel();
        }
      });
    }

    // Tab buttons
    this.container.querySelectorAll('.eng-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeTab = btn.dataset.tab;
        this.render();
        if (this.activeTab === 'cad') this.loadCADModel();
      });
    });

    // Teach me this design button
    const teachBtn = this.container.querySelector('#btn-teach-design');
    if (teachBtn) {
      teachBtn.addEventListener('click', () => {
        this.teachDesign();
      });
    }

    // Run Torque Calc
    const torqueBtn = this.container.querySelector('#btn-run-torque-calc');
    if (torqueBtn) {
      torqueBtn.addEventListener('click', () => this.runTorqueCalculation());
    }

    // Run Beam Calc
    const beamBtn = this.container.querySelector('#btn-run-beam-calc');
    if (beamBtn) {
      beamBtn.addEventListener('click', () => this.runBeamCalculation());
    }

    // Copy CAD button
    const copyCadBtn = this.container.querySelector('#btn-copy-cad');
    if (copyCadBtn) {
      copyCadBtn.addEventListener('click', () => {
        const pre = this.container.querySelector('#cad-code-pre code');
        if (pre) {
          navigator.clipboard.writeText(pre.innerText);
          copyCadBtn.innerText = '✅ Copied!';
          setTimeout(() => copyCadBtn.innerText = '📋 Copy OpenSCAD Code', 2000);
        }
      });
    }
  }

  async loadCADModel() {
    const pre = this.container.querySelector('#cad-code-pre code');
    if (!pre) return;

    try {
      const res = await fetch('/api/engineering/cad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectType: this.selectedProject.projectId,
          parameters: { length: 180, width: 35, thickness: 10 }
        })
      });
      const data = await res.json();
      if (data.success && data.scadCode) {
        pre.innerText = data.scadCode;
      } else {
        pre.innerText = '// Standard component mount geometry';
      }
    } catch (err) {
      pre.innerText = '// OpenSCAD parametric script generation active';
    }
  }

  async runTorqueCalculation() {
    const box = this.container.querySelector('#torque-result-box');
    if (!box) return;

    const payload = parseFloat(this.container.querySelector('#calc-payload')?.value || '1.5');
    const length = parseFloat(this.container.querySelector('#calc-length')?.value || '0.45');
    const armMass = parseFloat(this.container.querySelector('#calc-arm-mass')?.value || '0.8');
    const accel = parseFloat(this.container.querySelector('#calc-accel')?.value || '2.5');

    box.innerHTML = `<span class="calc-loading">Computing dynamic inertia & torque...</span>`;

    try {
      const res = await fetch('/api/engineering/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calculationType: 'torque',
          payloadKg: payload,
          linkLengthMeters: length,
          linkMassKg: armMass,
          angularAccelerationRadS2: accel
        })
      });

      const data = await res.json();
      if (data.success && data.result) {
        const r = data.result;
        box.innerHTML = `
          <div class="result-grid">
            <div class="res-item">
              <span class="res-label">Gravity Torque:</span>
              <strong class="res-val">${r.calculations.gravityTorqueNm} N·m</strong>
            </div>
            <div class="res-item">
              <span class="res-label">Dynamic Inertial Torque:</span>
              <strong class="res-val">${r.calculations.dynamicTorqueNm} N·m</strong>
            </div>
            <div class="res-item highlight">
              <span class="res-label">Total Required Torque (1.5x SF):</span>
              <strong class="res-val">${r.calculations.totalRequiredTorqueNm} N·m (${r.calculations.totalRequiredTorqueKgCm} kg·cm)</strong>
            </div>
            <div class="res-item">
              <span class="res-label">Mechanical Power:</span>
              <strong class="res-val">${r.calculations.mechanicalPowerWatts} W</strong>
            </div>
          </div>
          <div class="actuator-recommendation">
            🏷️ <strong>Recommended Actuator:</strong> ${r.recommendedActuatorClass}
          </div>
        `;
      }
    } catch (err) {
      box.innerHTML = `<div class="res-error">Calculation error: ${err.message}</div>`;
    }
  }

  async runBeamCalculation() {
    const box = this.container.querySelector('#beam-result-box');
    if (!box) return;

    const loadN = parseFloat(this.container.querySelector('#calc-beam-load')?.value || '65');
    const lengthM = parseFloat(this.container.querySelector('#calc-beam-len')?.value || '0.35');
    const matKey = this.container.querySelector('#calc-beam-mat')?.value || 'aluminum_6061_t6';

    box.innerHTML = `<span class="calc-loading">Solving Euler-Bernoulli & von Mises stresses...</span>`;

    try {
      const res = await fetch('/api/engineering/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calculationType: 'beam',
          loadNewtons: loadN,
          lengthMeters: lengthM,
          materialKey: matKey,
          widthMeters: 0.035,
          heightMeters: 0.015
        })
      });

      const data = await res.json();
      if (data.success && data.result) {
        const r = data.result.results;
        box.innerHTML = `
          <div class="result-grid">
            <div class="res-item">
              <span class="res-label">von Mises Stress:</span>
              <strong class="res-val">${r.vonMisesStressMPa} MPa</strong>
            </div>
            <div class="res-item">
              <span class="res-label">Material Yield Strength:</span>
              <strong class="res-val">${r.yieldStrengthMPa} MPa</strong>
            </div>
            <div class="res-item highlight">
              <span class="res-label">Safety Factor:</span>
              <strong class="res-val">${r.safetyFactor}x (${r.status})</strong>
            </div>
            <div class="res-item">
              <span class="res-label">Tip Deflection:</span>
              <strong class="res-val">${r.maxDeflectionMm} mm</strong>
            </div>
          </div>
        `;
      }
    } catch (err) {
      box.innerHTML = `<div class="res-error">Calculation error: ${err.message}</div>`;
    }
  }

  async teachDesign() {
    // Open chat or show modal teaching the active design
    const p = this.selectedProject;
    try {
      const res = await fetch('/api/brain/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: 'Robotics',
          concept: p.title,
          level: 'intermediate'
        })
      });
      const data = await res.json();
      const exp = data?.explanation?.explanation;
      alert(`🎓 JARVIS Engineering Tutoring — ${p.title}\n\n${exp?.summary || p.architecture}\n\nGoverning Law: ${exp?.governingEquations || 'F = m*a'}\n\nKey Concept: ${exp?.keyIdea || 'Analyzed with 13-step verified engineering workflow.'}`);
    } catch (_) {
      alert(`🎓 JARVIS Engineering Tutoring — ${p.title}\n\nArchitecture: ${p.architecture}`);
    }
  }
}
