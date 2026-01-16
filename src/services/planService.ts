/**
 * Plan Service for Claude Code
 *
 * Watches and manages Claude Code plans from ~/.claude/plans/*.md
 * Also handles auto-registration of terminals for new sessions
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fsPromises from 'fs/promises';
import * as os from 'os';
import { registerSessionTerminal, getSessionTerminal } from '../claudeService';

export interface Plan {
  id: string;
  sessionId: string;
  filePath: string;
  mtime: Date;
  markdownContent: string;
}

type PlanCallback = (plans: Plan[], activePlan: Plan | null) => void;

export class PlanService {
  private _watcher: vscode.FileSystemWatcher | undefined;
  private _plans: Map<string, Plan> = new Map();
  private _activePlanId: string | null = null;
  private _debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private _callback: PlanCallback;
  private _disposables: vscode.Disposable[] = [];

  private readonly _plansDir: string;

  constructor(callback: PlanCallback) {
    this._callback = callback;
    this._plansDir = path.join(os.homedir(), '.claude', 'plans');
  }

  public async start() {
    await this._startWatcher();
    await this._loadAllPlans();
  }

  private async _startWatcher() {
    try {
      await fsPromises.access(this._plansDir);

      const pattern = new vscode.RelativePattern(this._plansDir, '*.md');
      this._watcher = vscode.workspace.createFileSystemWatcher(pattern);

      this._watcher.onDidChange(uri => this._onFileChange(uri));
      this._watcher.onDidCreate(uri => this._onFileChange(uri));
      this._watcher.onDidDelete(uri => this._onPlanDelete(uri.fsPath));

      this._disposables.push(this._watcher);
      console.log('Claude Code plan watcher started:', this._plansDir);
    } catch {
      console.log('Claude Code plans directory not found, skipping watcher');
    }
  }

  private _debounce(filePath: string, fn: () => void, delay: number = 200) {
    const existing = this._debounceTimers.get(filePath);
    if (existing) {
      clearTimeout(existing);
    }
    this._debounceTimers.set(filePath, setTimeout(() => {
      this._debounceTimers.delete(filePath);
      fn();
    }, delay));
  }

  private _onFileChange(uri: vscode.Uri) {
    this._debounce(uri.fsPath, () => this._loadPlan(uri.fsPath));
  }

  private _onPlanDelete(filePath: string) {
    const planId = filePath;
    if (this._plans.has(planId)) {
      this._plans.delete(planId);
      if (this._activePlanId === planId) {
        this._activePlanId = null;
      }
      this._notifyUpdate();
    }
  }

  private async _loadAllPlans() {
    try {
      await fsPromises.access(this._plansDir);
      const files = await fsPromises.readdir(this._plansDir);
      const mdFiles = files.filter(f => f.endsWith('.md'));

      await Promise.all(mdFiles.map(f =>
        this._loadPlan(path.join(this._plansDir, f))
      ));
    } catch {
      // Directory doesn't exist
    }

    this._notifyUpdate();
  }

  private async _loadPlan(filePath: string) {
    try {
      const [content, stats] = await Promise.all([
        fsPromises.readFile(filePath, 'utf-8'),
        fsPromises.stat(filePath)
      ]);

      const fileName = path.basename(filePath, '.md');
      const isNewPlan = !this._plans.has(filePath);

      const plan: Plan = {
        id: filePath,
        sessionId: fileName,
        filePath,
        mtime: stats.mtime,
        markdownContent: content
      };

      this._plans.set(plan.id, plan);
      this._updateActivePlan();
      this._notifyUpdate();

      // Auto-register terminal for new plans
      if (isNewPlan) {
        this._tryAutoRegisterTerminal(fileName);
      }
    } catch (error) {
      console.error('Error loading plan:', error);
    }
  }

  /**
   * Try to find and register an unregistered Claude terminal for a new session
   * Only registers terminals that are clearly Claude-related to avoid mismatches
   */
  private _tryAutoRegisterTerminal(sessionId: string) {
    // Skip if already registered
    if (getSessionTerminal(sessionId)) {
      return;
    }

    // Find a Claude terminal that's not yet registered
    // ONLY register terminals with "claude" in the name - avoid generic shells
    const terminals = vscode.window.terminals;

    for (const terminal of terminals) {
      const name = terminal.name.toLowerCase();

      // Only auto-register terminals explicitly named "claude" or "node"
      // Do NOT register generic shells (zsh, bash, fish) to avoid mismatches
      if (name.includes('claude') || name === 'node') {
        console.log(`Auto-registering terminal "${terminal.name}" for session ${sessionId}`);
        registerSessionTerminal(sessionId, terminal);
        return;
      }
    }

    // Note: We intentionally do NOT auto-register generic shells (zsh, bash, fish)
    // because with multiple sessions, we cannot reliably determine which terminal
    // belongs to which session. Users should start sessions via "Resume Session".
  }

  private _updateActivePlan() {
    // Set the most recently modified plan as active
    let newest: Plan | null = null;

    for (const plan of this._plans.values()) {
      if (!newest || plan.mtime > newest.mtime) {
        newest = plan;
      }
    }

    this._activePlanId = newest?.id ?? null;
  }

  private _notifyUpdate() {
    const plans = Array.from(this._plans.values())
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    const activePlan = this._activePlanId
      ? this._plans.get(this._activePlanId) ?? null
      : null;

    this._callback(plans, activePlan);
  }

  // Public API

  public getPlans(): Plan[] {
    return Array.from(this._plans.values())
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
  }

  public getActivePlan(): Plan | null {
    return this._activePlanId ? this._plans.get(this._activePlanId) ?? null : null;
  }

  public setActivePlan(planId: string) {
    if (this._plans.has(planId)) {
      this._activePlanId = planId;
      this._notifyUpdate();
    }
  }

  public refresh() {
    this._loadAllPlans();
  }

  public dispose() {
    this._debounceTimers.forEach(timer => clearTimeout(timer));
    this._debounceTimers.clear();
    this._disposables.forEach(d => d.dispose());
  }
}

// Singleton
let planServiceInstance: PlanService | null = null;

export function getPlanService(callback?: PlanCallback): PlanService {
  if (!planServiceInstance) {
    if (!callback) {
      throw new Error('PlanService must be initialized with a callback');
    }
    planServiceInstance = new PlanService(callback);
  }
  return planServiceInstance;
}

export function disposePlanService() {
  if (planServiceInstance) {
    planServiceInstance.dispose();
    planServiceInstance = null;
  }
}
