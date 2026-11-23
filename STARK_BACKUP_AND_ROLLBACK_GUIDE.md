# VISION AI (MADE BY LOKESH) — BACKUP, RESTORE AND ROLLBACK GUIDE

**Repository:** `D:\Jarvis`  
**Safety Protocol:** Reversible Milestones & Zero Remote Publishing

---

## 1. BACKUP ARCHITECTURE

VISION AI (MADE BY LOKESH) maintains three levels of automatic state and artifact preservation:

1. **Git Recoverable Milestones:**
   - Primary branch `master` remains protected.
   - All experimental and full-system work occurs on dedicated branches (`stage-a-diagnosis-and-repair`, `stark-unified-full-system`).
   - Every major capability milestone is committed locally without remote pushing.
2. **Automated Pre-Edit Code Backups:**
   - Every file edit performed by `server/selfDevelopmentEngine.js` or `server/selfRepairService.js` creates a timestamped copy in:
     `D:\Jarvis\backups\code_edits\<filename>.<timestamp>.bak`
3. **Persistent Structured JSON State:**
   - System state is safely persisted in `D:\Jarvis\data/`:
     - `dynamic_tools.json`: Dynamic runtime tools.
     - `plugin_registry.json`: Installed extensions and manifests.
     - `knowledge_graph/graph.json`: Semantic relations and concepts.
     - `user_memory.json`: Categorized user memories (episodic, preference, project).
     - `audit_log.json`: Append-only secret-redacted audit trail.

---

## 2. ROLLBACK PROCEDURES

### Scenario 1: Reverting Uncommitted Working Directory Edits

To discard all uncommitted changes and restore the clean branch state:

```powershell
git restore .
git clean -fd
```

### Scenario 2: Restoring a Single Source File from Git

To restore a specific corrupted or regressed file from the last commit:

```powershell
git checkout HEAD -- server/toolsRegistry.js
```

### Scenario 3: Restoring an Individual File from Automated Pre-Edit Backup

```powershell
# List available backups
Get-ChildItem -Path "D:\Jarvis\backups\code_edits" -Filter "*.bak" | Sort-Object LastWriteTime -Descending

# Restore candidate
Copy-Item "D:\Jarvis\backups\code_edits\server.js.<timestamp>.bak" "D:\Jarvis\server.js"
```

### Scenario 4: Reverting to a Prior Git Milestone

To roll back the entire repository to an earlier verified commit:

```powershell
# View commit history
git log --oneline -n 10

# Create a recovery branch from a known good commit
git checkout -b rollback-recovery <commit-hash>
```

---

## 3. RUNTIME SUBSYSTEM RESET (POST EMERGENCY-STOP)

When an emergency stop has been latched:

- **In Desktop UI:** Click the green **Resume** button.
- **Via REST API:**

  ```powershell
  Invoke-RestMethod -Uri "http://localhost:3000/api/security/emergency-reset" -Method POST -Body '{"reason":"Manual user resume"}' -ContentType "application/json"
  ```

- **Via Node Command Line:**

  ```powershell
  node -e "const { emergencyStopControllerInstance } = require('./server/emergencyStopController'); emergencyStopControllerInstance.reset('Admin reset');"
  ```

- **Process Restart:**
  If the application is unresponsive, terminate Node processes and relaunch:

  ```powershell
  Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
  Stop-Process -Name "electron" -Force -ErrorAction SilentlyContinue
  npm start
  ```
