/**
 * VISION AI — Personal Intelligence & Proactive UI Component
 * Phase 14 Module 9: Mission Control View for Projects, Preferences,
 * Proactive Recommendations, and Avoid Topics Management.
 */

export class PersonalIntelligenceUI {
  constructor() {
    this.container = document.getElementById('caps-personal-tab');
    this.projectsContainer = document.getElementById('personal-projects-container');
    this.recsContainer = document.getElementById('proactive-recommendations-container');
    this.avoidList = document.getElementById('avoid-topics-list');
    this.levelSelect = document.getElementById('proactive-level-select');
    this.refreshBtn = document.getElementById('btn-refresh-personal-context');
    this.addAvoidBtn = document.getElementById('btn-add-avoid-topic');
    this.avoidInput = document.getElementById('input-avoid-topic');
    this.initEventListeners();
  }

  initEventListeners() {
    if (this.refreshBtn) {
      this.refreshBtn.addEventListener('click', () => this.refreshAll());
    }

    if (this.levelSelect) {
      this.levelSelect.addEventListener('change', async (e) => {
        const level = e.target.value;
        try {
          const res = await fetch('/api/personal/proactive/level', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ level })
          });
          const data = await res.json();
          if (data.success) {
            this.refreshProactive();
          }
        } catch (_) {}
      });
    }

    if (this.addAvoidBtn && this.avoidInput) {
      this.addAvoidBtn.addEventListener('click', async () => {
        const topic = this.avoidInput.value.trim();
        if (!topic) return;
        try {
          const res = await fetch('/api/personal/avoid-topics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic })
          });
          const data = await res.json();
          if (data.success) {
            this.avoidInput.value = '';
            this.loadAvoidTopics();
          }
        } catch (_) {}
      });
    }

    // Modal Tab Click Listener
    const personalTabBtn = document.querySelector('[data-tab="caps-personal-tab"]');
    if (personalTabBtn) {
      personalTabBtn.addEventListener('click', () => {
        this.refreshAll();
      });
    }
  }

  async refreshAll() {
    await Promise.all([
      this.loadProjectsAndContext(),
      this.loadProactive(),
      this.loadAvoidTopics()
    ]);
  }

  async loadProjectsAndContext() {
    if (!this.projectsContainer) return;
    try {
      const res = await fetch('/api/personal/projects');
      const data = await res.json();
      if (!data.success || !Array.isArray(data.projects)) {
        this.projectsContainer.innerHTML = '<p style="color: #64748b; font-size: 12px;">No active projects found.</p>';
        return;
      }

      this.projectsContainer.innerHTML = data.projects.map(p => `
        <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid #334155; border-radius: 6px; padding: 10px; margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <strong style="color: #38bdf8; font-size: 13px;">${p.projectName}</strong>
            <span style="font-size: 11px; padding: 2px 6px; border-radius: 4px; background: ${p.status === 'COMPLETED' ? '#10b981' : '#0284c7'}; color: #fff;">${p.status}</span>
          </div>
          <p style="margin: 4px 0; color: #cbd5e1; font-size: 12px;">${p.objective || 'No objective specified'}</p>
          <div style="font-size: 11px; color: #94a3b8; display: flex; gap: 12px; margin-top: 6px;">
            <span>Milestones: ${p.milestones ? p.milestones.length : 0}</span>
            <span>Decisions: ${p.decisions ? p.decisions.length : 0}</span>
            <span>Key Files: ${p.keyFiles ? p.keyFiles.length : 0}</span>
          </div>
        </div>
      `).join('');
    } catch (_) {
      this.projectsContainer.innerHTML = '<p style="color: #f43f5e; font-size: 12px;">Failed to load projects.</p>';
    }
  }

  async loadProactive() {
    if (!this.recsContainer) return;
    try {
      const res = await fetch('/api/personal/proactive');
      const data = await res.json();
      if (this.levelSelect && data.level) {
        this.levelSelect.value = data.level.level || data.level;
      }

      if (!data.success || !Array.isArray(data.notifications) || data.notifications.length === 0) {
        this.recsContainer.innerHTML = '<p style="color: #64748b; font-size: 12px;">No pending proactive recommendations.</p>';
        return;
      }

      this.recsContainer.innerHTML = data.notifications.map(n => `
        <div style="background: rgba(15, 23, 42, 0.7); border-left: 3px solid #38bdf8; border-radius: 4px; padding: 8px 10px; margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between;">
            <strong style="color: #e2e8f0; font-size: 12px;">${n.title}</strong>
            <span style="font-size: 10px; color: #94a3b8;">${n.category}</span>
          </div>
          <p style="margin: 2px 0 4px 0; color: #cbd5e1; font-size: 11px;">${n.message}</p>
          <p style="margin: 0 0 6px 0; color: #38bdf8; font-size: 10px; font-style: italic;">Reason: ${n.evidenceReason}</p>
          <div style="display: flex; gap: 6px;">
            <button class="rec-act-btn stark-btn-primary" data-id="${n.id}" data-action="ACCEPT" style="padding: 2px 8px; font-size: 10px;">Accept</button>
            <button class="rec-act-btn stark-btn-glass" data-id="${n.id}" data-action="SNOOZE" style="padding: 2px 8px; font-size: 10px;">Snooze</button>
            <button class="rec-act-btn stark-btn-glass" data-id="${n.id}" data-action="DISMISS" style="padding: 2px 8px; font-size: 10px;">Dismiss</button>
          </div>
        </div>
      `).join('');

      this.recsContainer.querySelectorAll('.rec-act-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = e.target.getAttribute('data-id');
          const action = e.target.getAttribute('data-action');
          try {
            await fetch('/api/personal/proactive/action', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ notificationId: id, action })
            });
            this.loadProactive();
          } catch (_) {}
        });
      });
    } catch (_) {
      this.recsContainer.innerHTML = '<p style="color: #f43f5e; font-size: 12px;">Failed to load recommendations.</p>';
    }
  }

  async loadAvoidTopics() {
    if (!this.avoidList) return;
    try {
      const res = await fetch('/api/personal/avoid-topics');
      const data = await res.json();
      if (!data.success || !Array.isArray(data.avoidTopics)) return;

      this.avoidList.innerHTML = data.avoidTopics.map(t => `
        <span style="display: inline-block; background: rgba(244, 63, 94, 0.15); border: 1px solid rgba(244, 63, 94, 0.4); color: #fda4af; padding: 2px 8px; border-radius: 12px; margin: 2px;">
          ⛔ ${t}
        </span>
      `).join('');
    } catch (_) {}
  }
}

