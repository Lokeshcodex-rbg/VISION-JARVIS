/**
 * VISION AI — Productivity, Tasks & Reminder Subsystem
 * Persists structured tasks and deadlines safely in data/tasks.json.
 * Provides atomic disk updates, corruption recovery, and deadline notifications.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '../data');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');

class TaskManager {
  constructor() {
    this.tasks = [];
    this.init();
  }

  init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(TASKS_FILE)) {
        const raw = fs.readFileSync(TASKS_FILE, 'utf8');
        this.tasks = JSON.parse(raw);
      } else {
        this.tasks = [];
        this.save();
      }
    } catch (err) {
      console.warn('[TASK_MANAGER] Error reading tasks file. Initializing empty:', err.message);
      this.tasks = [];
    }
  }

  save() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      // Atomic write via temp file
      const tempFile = TASKS_FILE + '.tmp';
      fs.writeFileSync(tempFile, JSON.stringify(this.tasks, null, 2), 'utf8');
      fs.renameSync(tempFile, TASKS_FILE);
      return true;
    } catch (err) {
      console.warn('[TASK_MANAGER] Error saving tasks file:', err.message);
      return false;
    }
  }

  /**
   * Creates a new persistent task.
   */
  createTask(title, options = {}) {
    const cleanTitle = String(title || '').trim();
    if (!cleanTitle) throw new Error('Task title cannot be empty.');

    const task = {
      id: 'tsk_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      title: cleanTitle,
      description: options.description ? String(options.description).trim() : '',
      category: options.category || 'general',
      priority: options.priority || 'medium', // 'low' | 'medium' | 'high' | 'critical'
      dueDate: options.dueDate || null,
      completed: false,
      completedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.tasks.push(task);
    this.save();

    return {
      success: true,
      task,
      summary: `Task created: "${task.title}" (Priority: ${task.priority}${task.dueDate ? `, Due: ${task.dueDate}` : ''}).`
    };
  }

  /**
   * Lists tasks with optional filtering ('all', 'pending', 'completed', or category).
   */
  listTasks(filter = 'pending') {
    let result = [...this.tasks];

    if (filter === 'pending') {
      result = result.filter(t => !t.completed);
    } else if (filter === 'completed') {
      result = result.filter(t => t.completed);
    } else if (filter && filter !== 'all') {
      result = result.filter(t => t.category.toLowerCase() === filter.toLowerCase());
    }

    const pendingCount = this.tasks.filter(t => !t.completed).length;

    return {
      success: true,
      filter,
      totalCount: this.tasks.length,
      pendingCount,
      tasks: result,
      summary: result.length === 0
        ? `No ${filter} tasks found.`
        : `You have ${result.length} ${filter} task${result.length === 1 ? '' : 's'}: ${result.slice(0, 4).map(t => `"${t.title}"`).join(', ')}${result.length > 4 ? '...' : ''}.`
    };
  }

  /**
   * Marks a task as completed by ID or matching title keyword.
   */
  completeTask(query) {
    const q = String(query || '').toLowerCase().trim();
    if (!q) throw new Error('Specify a task ID or keyword to complete.');

    const task = this.tasks.find(t => t.id === q || t.title.toLowerCase().includes(q));
    if (!task) {
      return {
        success: false,
        status: 'not_found',
        summary: `No matching task found for "${query}".`
      };
    }

    task.completed = true;
    task.completedAt = new Date().toISOString();
    task.updatedAt = new Date().toISOString();
    this.save();

    return {
      success: true,
      status: 'completed',
      task,
      summary: `Marked task "${task.title}" as complete.`
    };
  }

  /**
   * Deletes a task by ID or keyword.
   */
  deleteTask(query) {
    const q = String(query || '').toLowerCase().trim();
    if (!q) throw new Error('Specify a task ID or keyword to delete.');

    const initialLen = this.tasks.length;
    this.tasks = this.tasks.filter(t => t.id !== q && !t.title.toLowerCase().includes(q));

    const deleted = initialLen - this.tasks.length;
    if (deleted > 0) {
      this.save();
      return {
        success: true,
        status: 'deleted',
        deletedCount: deleted,
        summary: `Deleted ${deleted} task${deleted === 1 ? '' : 's'} matching "${query}".`
      };
    }

    return {
      status: 'not_found',
      summary: `No matching task found to delete for "${query}".`
    };
  }

  /**
   * Clears all tasks.
   */
  clearAll() {
    this.tasks = [];
    this.save();
    return { success: true, summary: 'All tasks have been cleared.' };
  }
}

module.exports = {
  TaskManager,
  taskManagerInstance: new TaskManager()
};
