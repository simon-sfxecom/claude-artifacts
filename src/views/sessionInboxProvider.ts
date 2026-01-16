/**
 * TreeDataProvider for Session Inbox view
 * Shows Claude Code sessions for the current workspace with smart filtering
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { getSessionService } from '../services/sessionService';
import { ClaudeProject, ClaudeSession, ClaudePlan, SessionStatus } from '../models/session';

type TreeItemType =
  | 'current-project-header'
  | 'active-sessions-header'
  | 'recent-sessions-header'
  | 'plans-header'
  | 'other-projects-header'
  | 'plan'
  | 'project'
  | 'session';

interface SessionTreeItem {
  type: TreeItemType;
  data?: ClaudeProject | ClaudeSession | ClaudePlan;
  label: string;
}

const MAX_RECENT_SESSIONS = 10;
const MAX_OTHER_PROJECTS = 5;
const LIVE_UPDATE_INTERVAL = 2000; // 2 seconds

interface LiveSessionState {
  sessionId: string;
  projectPath: string;
  lastMessage?: string;
  currentTool?: string;
  isThinking?: boolean;
  inputRequired?: boolean;
  waitingTool?: string;
}

export class SessionInboxProvider implements vscode.TreeDataProvider<SessionTreeItem>, vscode.Disposable {
  private _onDidChangeTreeData = new vscode.EventEmitter<SessionTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private sessionService = getSessionService();
  private fileWatcher: vscode.FileSystemWatcher | undefined;
  private refreshTimeout: NodeJS.Timeout | undefined;
  private liveUpdateInterval: NodeJS.Timeout | undefined;
  private disposables: vscode.Disposable[] = [];
  private liveSessionStates: Map<string, LiveSessionState> = new Map();

  constructor() {
    this.setupFileWatcher();
    this.setupWorkspaceWatcher();
    this.setupLiveUpdates();
  }

  private setupFileWatcher(): void {
    const claudeDir = this.sessionService.getClaudeDir();

    // Watch history.jsonl for new activity
    const historyPattern = new vscode.RelativePattern(claudeDir, 'history.jsonl');
    this.fileWatcher = vscode.workspace.createFileSystemWatcher(historyPattern);

    this.disposables.push(
      this.fileWatcher.onDidChange(() => this.debouncedRefresh()),
      this.fileWatcher.onDidCreate(() => this.debouncedRefresh()),
      this.fileWatcher.onDidDelete(() => this.debouncedRefresh())
    );
  }

  private setupWorkspaceWatcher(): void {
    // Refresh when workspace changes
    this.disposables.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => this.refresh())
    );
  }

  private setupLiveUpdates(): void {
    // Poll active sessions for live updates
    this.liveUpdateInterval = setInterval(async () => {
      await this.updateLiveSessionStates();
    }, LIVE_UPDATE_INTERVAL);
  }

  private async updateLiveSessionStates(): Promise<void> {
    try {
      const allProjects = await this.sessionService.getProjects();
      const activeSessions = allProjects.flatMap(p =>
        p.sessions.filter(s => s.status === 'active').map(s => ({
          session: s,
          projectPath: p.path
        }))
      );

      let hasChanges = false;

      // Update state for each active session
      for (const { session, projectPath } of activeSessions) {
        const activity = await this.sessionService.getLastActivity(session.id, projectPath);
        const currentState = this.liveSessionStates.get(session.id);

        // Check if state changed
        if (!currentState ||
            currentState.lastMessage !== activity.lastMessage ||
            currentState.currentTool !== activity.currentTool ||
            currentState.inputRequired !== activity.inputRequired) {
          this.liveSessionStates.set(session.id, {
            sessionId: session.id,
            projectPath,
            ...activity
          });
          hasChanges = true;
        }
      }

      // Clean up states for sessions that are no longer active
      const activeIds = new Set(activeSessions.map(s => s.session.id));
      for (const id of this.liveSessionStates.keys()) {
        if (!activeIds.has(id)) {
          this.liveSessionStates.delete(id);
          hasChanges = true;
        }
      }

      // Only refresh if something changed
      if (hasChanges) {
        this._onDidChangeTreeData.fire();
      }
    } catch (error) {
      console.error('Failed to update live session states:', error);
    }
  }

  getLiveState(sessionId: string): LiveSessionState | undefined {
    return this.liveSessionStates.get(sessionId);
  }

  private getCurrentWorkspacePath(): string | undefined {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  }

  private debouncedRefresh(): void {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }
    this.refreshTimeout = setTimeout(() => {
      this.sessionService.invalidateCache();
      this.refresh();
    }, 500);
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: SessionTreeItem): vscode.TreeItem {
    const item = new vscode.TreeItem(element.label);

    switch (element.type) {
      case 'current-project-header':
        item.iconPath = new vscode.ThemeIcon('folder-active');
        item.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        item.contextValue = 'current-project-header';
        item.description = 'current workspace';
        break;

      case 'active-sessions-header':
        item.iconPath = new vscode.ThemeIcon('pulse');
        item.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        item.contextValue = 'active-sessions-header';
        break;

      case 'recent-sessions-header':
        item.iconPath = new vscode.ThemeIcon('history');
        item.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        item.contextValue = 'recent-sessions-header';
        break;

      case 'plans-header':
        item.iconPath = new vscode.ThemeIcon('file-text');
        item.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        item.contextValue = 'plans-header';
        break;

      case 'other-projects-header':
        item.iconPath = new vscode.ThemeIcon('folder-library');
        item.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        item.contextValue = 'other-projects-header';
        break;

      case 'plan':
        const plan = element.data as ClaudePlan;
        if (!plan) break;
        item.iconPath = new vscode.ThemeIcon('file-code');
        item.collapsibleState = vscode.TreeItemCollapsibleState.None;
        item.tooltip = plan.preview || plan.filename;
        item.description = this.getRelativeTime(plan.mtime);
        item.command = {
          command: 'claudeArtifacts.openPlan',
          title: 'Open Plan in Tab',
          arguments: [plan.path]
        };
        item.contextValue = 'plan';
        break;

      case 'project':
        const project = element.data as ClaudeProject;
        if (!project) break;
        item.iconPath = new vscode.ThemeIcon('folder');
        item.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        const activeCount = project.sessions.filter(s => s.status === 'active').length;
        item.description = activeCount > 0
          ? `${activeCount} active, ${project.sessions.length} total`
          : `${project.sessions.length} sessions`;
        item.tooltip = project.path;
        item.contextValue = 'project';
        break;

      case 'session':
        const session = element.data as ClaudeSession;
        if (!session) break;

        // Check for live state if this is an active session
        const liveState = session.status === 'active' ? this.liveSessionStates.get(session.id) : undefined;

        if (liveState?.inputRequired) {
          // Show warning icon when Claude is waiting for user input
          item.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.yellow'));
          const toolLabel = this.getInputToolLabel(liveState.waitingTool);
          item.description = `⚠️ ${toolLabel}`;
          item.tooltip = [
            session.displayName,
            `⚠️ Input Required: ${toolLabel}`,
            liveState.lastMessage ? `"${liveState.lastMessage}..."` : '',
            `${session.messageCount} messages`
          ].filter(Boolean).join('\n');
        } else if (liveState?.currentTool) {
          // Show spinning icon and current tool for active sessions
          item.iconPath = new vscode.ThemeIcon('sync~spin', new vscode.ThemeColor('charts.blue'));
          item.description = `⚡ ${liveState.currentTool}`;
          item.tooltip = [
            session.displayName,
            `Tool: ${liveState.currentTool}`,
            liveState.lastMessage ? `"${liveState.lastMessage}..."` : '',
            `${session.messageCount} messages`
          ].filter(Boolean).join('\n');
        } else if (liveState?.lastMessage) {
          item.iconPath = this.getSessionIcon(session.status);
          item.description = `💬 ${this.truncate(liveState.lastMessage, 30)}`;
          item.tooltip = `${session.displayName}\n"${liveState.lastMessage}..."\n${session.messageCount} messages`;
        } else {
          item.iconPath = this.getSessionIcon(session.status);
          item.description = this.getRelativeTime(new Date(session.lastActivity));
          item.tooltip = `${session.displayName}\n${session.messageCount} messages\nStatus: ${session.status}`;
        }

        item.collapsibleState = vscode.TreeItemCollapsibleState.None;
        item.command = {
          command: 'claudeArtifacts.showSessionDetails',
          title: 'Show Session Details',
          arguments: [session]
        };
        item.contextValue = liveState?.inputRequired ? 'session-input-required' : `session-${session.status}`;
        break;
    }

    return item;
  }

  async getChildren(element?: SessionTreeItem): Promise<SessionTreeItem[]> {
    if (!element) {
      return this.getRootItems();
    }

    switch (element.type) {
      case 'current-project-header':
        return this.getCurrentProjectSessions();

      case 'active-sessions-header':
        return this.getActiveSessionItems();

      case 'recent-sessions-header':
        return this.getRecentSessionItems();

      case 'plans-header':
        return this.getPlanItems();

      case 'other-projects-header':
        return this.getOtherProjectItems();

      case 'project':
        const project = element.data as ClaudeProject;
        if (!project) return [];
        return this.getSessionItems(project);

      default:
        return [];
    }
  }

  private async getRootItems(): Promise<SessionTreeItem[]> {
    const items: SessionTreeItem[] = [];
    const currentPath = this.getCurrentWorkspacePath();
    const allProjects = await this.sessionService.getProjects();

    // Find current project
    const currentProject = currentPath
      ? allProjects.find(p => p.path === currentPath || currentPath.startsWith(p.path))
      : null;

    // Count active sessions globally
    const allActiveSessions = allProjects.flatMap(p =>
      p.sessions.filter(s => s.status === 'active')
    );

    // 1. Active Sessions (if any)
    if (allActiveSessions.length > 0) {
      items.push({
        type: 'active-sessions-header',
        label: `Active Sessions (${allActiveSessions.length})`
      });
    }

    // 2. Current Project (if we're in one)
    if (currentProject) {
      items.push({
        type: 'current-project-header',
        label: currentProject.name
      });
    }

    // 3. Recent Plans
    items.push({
      type: 'plans-header',
      label: 'Recent Plans'
    });

    // 4. Other Projects
    const otherProjects = allProjects.filter(p => p !== currentProject);
    if (otherProjects.length > 0) {
      items.push({
        type: 'other-projects-header',
        label: `Other Projects (${otherProjects.length})`
      });
    }

    return items;
  }

  private async getActiveSessionItems(): Promise<SessionTreeItem[]> {
    const allProjects = await this.sessionService.getProjects();
    const activeSessions = allProjects.flatMap(p =>
      p.sessions.filter(s => s.status === 'active')
    );

    // Sort by last activity
    activeSessions.sort((a, b) => b.lastActivity - a.lastActivity);

    return activeSessions.map(session => ({
      type: 'session' as const,
      data: session,
      label: this.truncate(session.displayName, 40)
    }));
  }

  private async getCurrentProjectSessions(): Promise<SessionTreeItem[]> {
    const currentPath = this.getCurrentWorkspacePath();
    if (!currentPath) return [];

    const allProjects = await this.sessionService.getProjects();
    const currentProject = allProjects.find(p =>
      p.path === currentPath || currentPath.startsWith(p.path)
    );

    if (!currentProject) {
      return [{
        type: 'session' as const,
        label: 'No sessions for this workspace'
      }];
    }

    // Get active sessions first, then recent (non-active)
    const active = currentProject.sessions.filter(s => s.status === 'active');
    const nonActive = currentProject.sessions
      .filter(s => s.status !== 'active')
      .sort((a, b) => b.lastActivity - a.lastActivity)
      .slice(0, MAX_RECENT_SESSIONS);

    const sessions = [...active, ...nonActive];

    if (sessions.length === 0) {
      return [{
        type: 'session' as const,
        label: 'No sessions yet'
      }];
    }

    return sessions.map(session => ({
      type: 'session' as const,
      data: session,
      label: this.truncate(session.displayName, 35)
    }));
  }

  private async getRecentSessionItems(): Promise<SessionTreeItem[]> {
    const allProjects = await this.sessionService.getProjects();
    const currentPath = this.getCurrentWorkspacePath();

    // Get all sessions except from current project
    const allSessions = allProjects
      .filter(p => !(currentPath && (p.path === currentPath || currentPath.startsWith(p.path))))
      .flatMap(p => p.sessions)
      .filter(s => s.status !== 'active') // Active shown separately
      .sort((a, b) => b.lastActivity - a.lastActivity)
      .slice(0, MAX_RECENT_SESSIONS);

    if (allSessions.length === 0) {
      return [{
        type: 'session' as const,
        label: 'No recent sessions'
      }];
    }

    return allSessions.map(session => ({
      type: 'session' as const,
      data: session,
      label: this.truncate(session.displayName, 35)
    }));
  }

  private async getPlanItems(): Promise<SessionTreeItem[]> {
    const plans = await this.sessionService.getRecentPlans(5);

    if (plans.length === 0) {
      return [{
        type: 'plan' as const,
        label: 'No plans found'
      }];
    }

    return plans.map(plan => ({
      type: 'plan' as const,
      data: plan,
      label: plan.filename.replace('.md', '')
    }));
  }

  private async getOtherProjectItems(): Promise<SessionTreeItem[]> {
    const allProjects = await this.sessionService.getProjects();
    const currentPath = this.getCurrentWorkspacePath();

    // Filter out current project and limit
    const otherProjects = allProjects
      .filter(p => !(currentPath && (p.path === currentPath || currentPath.startsWith(p.path))))
      .slice(0, MAX_OTHER_PROJECTS);

    if (otherProjects.length === 0) {
      return [{
        type: 'project' as const,
        label: 'No other projects'
      }];
    }

    return otherProjects.map(project => ({
      type: 'project' as const,
      data: project,
      label: project.name
    }));
  }

  private getSessionItems(project: ClaudeProject): SessionTreeItem[] {
    // Active first, then recent
    const active = project.sessions.filter(s => s.status === 'active');
    const recent = project.sessions
      .filter(s => s.status !== 'active')
      .sort((a, b) => b.lastActivity - a.lastActivity)
      .slice(0, MAX_RECENT_SESSIONS);

    return [...active, ...recent].map(session => ({
      type: 'session' as const,
      data: session,
      label: this.truncate(session.displayName, 30)
    }));
  }

  private getSessionIcon(status: SessionStatus): vscode.ThemeIcon {
    switch (status) {
      case 'active':
        return new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('charts.blue'));
      case 'paused':
        return new vscode.ThemeIcon('circle-outline', new vscode.ThemeColor('charts.yellow'));
      case 'completed':
        return new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
      default:
        return new vscode.ThemeIcon('circle-outline');
    }
  }

  /**
   * Get a human-readable label for input-required tools
   */
  private getInputToolLabel(tool: string | undefined): string {
    switch (tool) {
      case 'AskUserQuestion':
        return 'Question';
      case 'ExitPlanMode':
        return 'Plan Approval';
      default:
        return 'Input Required';
    }
  }

  private getRelativeTime(date: Date): string {
    const now = Date.now();
    const diff = now - date.getTime();

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return date.toLocaleDateString();
  }

  private truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength - 3) + '...';
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
    this.fileWatcher?.dispose();
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }
    if (this.liveUpdateInterval) {
      clearInterval(this.liveUpdateInterval);
    }
    this.liveSessionStates.clear();
  }
}
