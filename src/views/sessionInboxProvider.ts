/**
 * TreeDataProvider for Session Inbox view
 * Shows Claude Code sessions grouped by project with recent plans at the top
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { getSessionService } from '../services/sessionService';
import { ClaudeProject, ClaudeSession, ClaudePlan, SessionStatus } from '../models/session';

type TreeItemType = 'inbox-header' | 'plans-header' | 'projects-header' | 'plan' | 'project' | 'session';

interface SessionTreeItem {
  type: TreeItemType;
  data?: ClaudeProject | ClaudeSession | ClaudePlan;
  label: string;
}

export class SessionInboxProvider implements vscode.TreeDataProvider<SessionTreeItem>, vscode.Disposable {
  private _onDidChangeTreeData = new vscode.EventEmitter<SessionTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private sessionService = getSessionService();
  private fileWatcher: vscode.FileSystemWatcher | undefined;
  private refreshTimeout: NodeJS.Timeout | undefined;
  private disposables: vscode.Disposable[] = [];

  constructor() {
    this.setupFileWatcher();
  }

  private setupFileWatcher(): void {
    // Watch for changes in ~/.claude/
    const claudeDir = this.sessionService.getClaudeDir();

    // Watch history.jsonl for new activity
    const historyPattern = new vscode.RelativePattern(claudeDir, 'history.jsonl');
    this.fileWatcher = vscode.workspace.createFileSystemWatcher(historyPattern);

    // Track event subscriptions for proper disposal
    this.disposables.push(
      this.fileWatcher.onDidChange(() => this.debouncedRefresh()),
      this.fileWatcher.onDidCreate(() => this.debouncedRefresh()),
      this.fileWatcher.onDidDelete(() => this.debouncedRefresh())
    );
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
      case 'inbox-header':
        item.iconPath = new vscode.ThemeIcon('inbox');
        item.collapsibleState = vscode.TreeItemCollapsibleState.None;
        item.contextValue = 'inbox-header';
        break;

      case 'plans-header':
        item.iconPath = new vscode.ThemeIcon('file-text');
        item.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        item.contextValue = 'plans-header';
        break;

      case 'projects-header':
        item.iconPath = new vscode.ThemeIcon('folder-library');
        item.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        item.contextValue = 'projects-header';
        break;

      case 'plan':
        const plan = element.data as ClaudePlan;
        item.iconPath = new vscode.ThemeIcon('file-code');
        item.collapsibleState = vscode.TreeItemCollapsibleState.None;
        item.tooltip = plan.preview || plan.filename;
        item.description = this.getRelativeTime(plan.mtime);
        item.command = {
          command: 'vscode.open',
          title: 'Open Plan',
          arguments: [vscode.Uri.file(plan.path)]
        };
        item.contextValue = 'plan';
        break;

      case 'project':
        const project = element.data as ClaudeProject;
        item.iconPath = new vscode.ThemeIcon('folder');
        item.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        item.description = `${project.sessions.length} sessions`;
        item.tooltip = project.path;
        item.contextValue = 'project';
        break;

      case 'session':
        const session = element.data as ClaudeSession;
        item.iconPath = this.getSessionIcon(session.status);
        item.collapsibleState = vscode.TreeItemCollapsibleState.None;
        item.description = this.getRelativeTime(new Date(session.lastActivity));
        item.tooltip = `${session.displayName}\n${session.messageCount} interactions`;
        item.command = {
          command: 'claudeArtifacts.showSessionDetails',
          title: 'Show Session Details',
          arguments: [session]
        };
        item.contextValue = `session-${session.status}`;
        break;
    }

    return item;
  }

  async getChildren(element?: SessionTreeItem): Promise<SessionTreeItem[]> {
    if (!element) {
      // Root level: show sections
      return this.getRootItems();
    }

    switch (element.type) {
      case 'plans-header':
        return this.getPlanItems();

      case 'projects-header':
        return this.getProjectItems();

      case 'project':
        const project = element.data as ClaudeProject;
        return this.getSessionItems(project);

      default:
        return [];
    }
  }

  private async getRootItems(): Promise<SessionTreeItem[]> {
    const projects = await this.sessionService.getProjects();
    const activeSessions = projects.reduce((count, p) =>
      count + p.sessions.filter(s => s.status === 'active').length, 0
    );

    const items: SessionTreeItem[] = [];

    // Inbox header with badge
    if (activeSessions > 0) {
      items.push({
        type: 'inbox-header',
        label: `Inbox (${activeSessions})`
      });
    }

    // Recent Plans section
    items.push({
      type: 'plans-header',
      label: 'Recent Plans'
    });

    // Projects section
    items.push({
      type: 'projects-header',
      label: 'Projects'
    });

    return items;
  }

  private async getPlanItems(): Promise<SessionTreeItem[]> {
    const plans = await this.sessionService.getRecentPlans(5);

    return plans.map(plan => ({
      type: 'plan' as const,
      data: plan,
      label: plan.filename.replace('.md', '')
    }));
  }

  private async getProjectItems(): Promise<SessionTreeItem[]> {
    const projects = await this.sessionService.getProjects();

    return projects.map(project => ({
      type: 'project' as const,
      data: project,
      label: project.name
    }));
  }

  private getSessionItems(project: ClaudeProject): SessionTreeItem[] {
    return project.sessions.map(session => ({
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
    // Dispose EventEmitter
    this._onDidChangeTreeData.dispose();

    // Dispose all tracked subscriptions
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];

    // Dispose file watcher
    this.fileWatcher?.dispose();

    // Clear timeout
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }
  }
}
