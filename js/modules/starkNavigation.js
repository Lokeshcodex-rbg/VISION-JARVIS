/**
 * VISION AI — Master Navigation & Secondary Operations Drawer Hub
 * Coordinates streamlined top header and secondary operations drawer containing:
 * 1. Live Assistant (Living Code Eye & Dialogue)
 * 2. Visual Brain (3D Holographic Neural Architecture)
 * 3. Knowledge Graph (12 Technical Domains & Multi-Tier Explainer)
 * 4. Engineering Lab (7 Projects & 13-Step Verified Workflows)
 * 5. AI Creation Lab (Compute/VRAM Profiler & Agent Scaffolder)
 * 6. Research Center (Scientific Evidence & Paper Synthesis)
 * 7. Code Development (Self-Coding Engine & Test Rollback)
 * 8. Simulations (Kinematics, Structural & Propulsion Mechanics)
 * 9. System Health (Windows Hardware Diagnostics & Bus Telemetry)
 * 10. Permissions (Security Profiles & Emergency Stop)
 * 11. Task History (Autonomous Projects & Multi-Agent Missions)
 */

export class StarkNavigation {
  constructor(options = {}) {
    this.activeView = 'view-assistant';
    this.isDrawerOpen = false;

    this.views = [
      { id: 'view-assistant', label: 'Live Assistant', icon: '👁️', desc: 'Living Code Eye & Voice Dialogue' },
      { id: 'view-visual-brain', label: 'Visual Brain', icon: '🧠', desc: '3D Holographic Neural Architecture' },
      { id: 'view-heart-soul', label: 'Heart & Soul', icon: '❤️', desc: 'Emotional Intelligence, Traits & Pulsing Heart Core' },
      { id: 'view-knowledge-graph', label: 'Knowledge Graph', icon: '🕸️', desc: '12 Technical Domains & Explainer' },
      { id: 'view-engineering-lab', label: 'Engineering Lab', icon: '⚙️', desc: '7 Projects & 13-Step Workflows' },
      { id: 'view-ai-creation-lab', label: 'AI Creation Lab', icon: '🤖', desc: 'Compute/VRAM Profiler & Scaffolder' },
      { id: 'view-research-center', label: 'Research Center', icon: '🔬', desc: 'Scientific Evidence & Synthesis' },
      { id: 'view-code-development', label: 'Code Dev', icon: '💻', desc: 'Self-Coding Engine & Test Rollback' },
      { id: 'view-simulations', label: 'Simulations', icon: '🚀', desc: 'Kinematics & Propulsion Mechanics' },
      { id: 'view-system-health', label: 'System Health', icon: '📊', desc: 'Windows Diagnostics & Bus Telemetry' },
      { id: 'view-permissions', label: 'Permissions', icon: '🛡️', desc: 'Security Profiles & Emergency Stop' },
      { id: 'view-task-history', label: 'Task History', icon: '📜', desc: 'Autonomous Multi-Agent Missions' }
    ];

    this.onViewChanged = options.onViewChanged || null;
    this.drawerPanel = null;
    this.drawerContainer = null;
    this.brandBtn = null;
    this.init();
  }

  init() {
    this.brandBtn = document.getElementById('stark-brand-menu-btn');
    this.drawerPanel = document.getElementById('stark-secondary-nav-panel');
    this.drawerContainer = document.getElementById('stark-drawer-nav-items');

    this.renderDrawerItems();
    this.attachEventListeners();
  }

  renderDrawerItems() {
    if (!this.drawerContainer) {
      this.drawerContainer = document.getElementById('stark-drawer-nav-items');
    }
    if (!this.drawerContainer) return;

    this.drawerContainer.innerHTML = this.views.map(v => `
      <button class="drawer-view-item ${v.id === this.activeView ? 'active' : ''}" data-view="${v.id}" title="${v.label}">
        <span class="item-icon">${v.icon}</span>
        <div class="item-content">
          <span class="item-label">${v.label}</span>
          <span class="item-desc">${v.desc}</span>
        </div>
      </button>
    `).join('');
  }

  openDrawer() {
    if (!this.drawerPanel) {
      this.drawerPanel = document.getElementById('stark-secondary-nav-panel');
    }
    if (!this.drawerPanel) return;

    this.isDrawerOpen = true;
    this.drawerPanel.style.display = 'block';
    this.drawerPanel.setAttribute('aria-hidden', 'false');
    // Force reflow for smooth CSS slide transition
    void this.drawerPanel.offsetHeight;
    this.drawerPanel.classList.add('is-open');

    if (this.brandBtn) {
      this.brandBtn.setAttribute('aria-expanded', 'true');
    }
  }

  closeDrawer() {
    if (!this.drawerPanel) return;

    this.isDrawerOpen = false;
    this.drawerPanel.classList.remove('is-open');
    this.drawerPanel.setAttribute('aria-hidden', 'true');

    if (this.brandBtn) {
      this.brandBtn.setAttribute('aria-expanded', 'false');
    }

    setTimeout(() => {
      if (!this.isDrawerOpen && this.drawerPanel) {
        this.drawerPanel.style.display = 'none';
      }
    }, 280);
  }

  toggleDrawer() {
    if (this.isDrawerOpen) {
      this.closeDrawer();
    } else {
      this.openDrawer();
    }
  }

  attachEventListeners() {
    if (this.brandBtn) {
      this.brandBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleDrawer();
      });
    }

    const closeBtn = document.getElementById('close-secondary-nav-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.closeDrawer();
      });
    }

    const backdrop = document.getElementById('secondary-nav-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', () => {
        this.closeDrawer();
      });
    }

    if (this.drawerContainer) {
      this.drawerContainer.addEventListener('click', (e) => {
        const item = e.target.closest('.drawer-view-item');
        if (!item) return;
        const targetView = item.dataset.view;
        this.switchView(targetView);
        this.closeDrawer();
      });
    }

    // Close drawer when clicking any utility button in the drawer
    const utilityBtns = document.querySelectorAll('.drawer-utility-btn');
    utilityBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.closeDrawer();
      });
    });

    // Global keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      // Don't intercept shortcuts when typing in inputs
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) {
        return;
      }

      // Alt+M or Ctrl+M: Toggle operations drawer
      if ((e.altKey && (e.key === 'm' || e.key === 'M')) || (e.ctrlKey && (e.key === 'm' || e.key === 'M'))) {
        e.preventDefault();
        this.toggleDrawer();
        return;
      }

      // Esc: Close drawer if open
      if (e.key === 'Escape' && this.isDrawerOpen) {
        e.preventDefault();
        this.closeDrawer();
        return;
      }

      // Ctrl+Alt+B: Jump to Visual Brain
      if (e.ctrlKey && e.altKey && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        this.switchView(this.activeView === 'view-visual-brain' ? 'view-assistant' : 'view-visual-brain');
        this.closeDrawer();
      }

      // Ctrl+Alt+E: Jump to Engineering Lab
      if (e.ctrlKey && e.altKey && (e.key === 'e' || e.key === 'E')) {
        e.preventDefault();
        this.switchView(this.activeView === 'view-engineering-lab' ? 'view-assistant' : 'view-engineering-lab');
        this.closeDrawer();
      }
    });
  }

  switchView(viewId) {
    if (this.activeView === viewId && viewId !== 'view-assistant') return;

    this.activeView = viewId;

    // Update active state in drawer
    if (this.drawerContainer) {
      const items = this.drawerContainer.querySelectorAll('.drawer-view-item');
      items.forEach(item => {
        item.classList.toggle('active', item.dataset.view === viewId);
      });
    }

    // Manage containers
    const allViewPanes = document.querySelectorAll('.stark-view-pane');
    allViewPanes.forEach(pane => {
      if (pane.id === viewId) {
        pane.style.display = 'block';
        pane.classList.add('active-pane');
      } else {
        pane.style.display = 'none';
        pane.classList.remove('active-pane');
      }
    });

    // Notify listeners (e.g. to resize 3D canvas or load data)
    if (typeof this.onViewChanged === 'function') {
      this.onViewChanged(viewId);
    }
  }

  getActiveView() {
    return this.activeView;
  }
}
