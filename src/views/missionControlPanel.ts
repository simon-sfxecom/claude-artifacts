import * as vscode from 'vscode';
import { getSessionAggregator } from '../services/sessionAggregator';
import { MissionControlState, SessionCard, ProjectGroup, FilterState, SortBy } from '../models/missionControl';
import { getMissionControlHTML } from '../shared/missionControlWebview';
import { getSessionService } from '../services/sessionService';

/**
 * Mission Control Panel - Rich dashboard for managing Claude sessions
 */
export class MissionControlPanel {
  public static currentPanel: MissionControlPanel | undefined;
  private static readonly viewType = 'claudeArtifacts.missionControl';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _state: MissionControlState;
  private _updateInterval: NodeJS.Timeout | undefined;
  private _disposables: vscode.Disposable[] = [];

  /**
   * Create or show the Mission Control panel
   */
  public static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.ViewColumn.One;

    // If we already have a panel, show it
    if (MissionControlPanel.currentPanel) {
      MissionControlPanel.currentPanel._panel.reveal(column);
      return;
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      MissionControlPanel.viewType,
      'Mission Control',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'out')]
      }
    );

    MissionControlPanel.currentPanel = new MissionControlPanel(panel, extensionUri);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    // Initialize state
    this._state = {
      projects: [],
      sessions: [],
      filters: {
        status: [],
        projects: []
      },
      sortBy: 'activity',
      viewMode: 'cards'
    };

    // Set initial content
    this.updateWebview();

    // Listen for messages from webview
    this._panel.webview.onDidReceiveMessage(
      message => this.handleMessage(message),
      null,
      this._disposables
    );

    // Handle panel dispose
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Start polling for updates
    this.startPolling();

    // Initial state load
    this.updateState();
  }

  /**
   * Start polling for state updates
   */
  private startPolling(): void {
    // Poll every 2 seconds
    this._updateInterval = setInterval(() => {
      this.updateState();
    }, 2000);
  }

  /**
   * Stop polling
   */
  private stopPolling(): void {
    if (this._updateInterval) {
      clearInterval(this._updateInterval);
      this._updateInterval = undefined;
    }
  }

  /**
   * Update state from services
   */
  private async updateState(): Promise<void> {
    try {
      const aggregator = getSessionAggregator();
      const sessionService = getSessionService();

      // Get all sessions with current filters
      const sessions = await aggregator.getSessionCards(this._state.filters, this._state.sortBy);

      // Get projects
      const projects = await sessionService.getProjects();

      // Build project groups
      const projectGroups: ProjectGroup[] = projects.map(project => ({
        project,
        expanded: false,
        activeSessions: project.sessions.filter(s => s.status === 'active').length,
        totalSessions: project.sessions.length
      }));

      // Check if state changed
      const stateChanged = this.detectChanges(sessions, this._state.sessions);

      if (stateChanged || projectGroups.length !== this._state.projects.length) {
        this._state.sessions = sessions;
        this._state.projects = projectGroups;
        this.updateWebview();
      }
    } catch (error) {
      console.error('Failed to update Mission Control state:', error);
    }
  }

  /**
   * Detect if sessions changed
   */
  private detectChanges(newSessions: SessionCard[], oldSessions: SessionCard[]): boolean {
    if (newSessions.length !== oldSessions.length) {
      return true;
    }

    for (let i = 0; i < newSessions.length; i++) {
      const newS = newSessions[i];
      const oldS = oldSessions[i];

      if (!oldS ||
          newS.session.id !== oldS.session.id ||
          newS.session.lastActivity !== oldS.session.lastActivity ||
          newS.session.status !== oldS.session.status ||
          newS.preview.currentActivity !== oldS.preview.currentActivity) {
        return true;
      }
    }

    return false;
  }

  /**
   * Update webview content
   */
  private updateWebview(): void {
    const webview = this._panel.webview;
    const nonce = getNonce();
    const cspSource = webview.cspSource;

    webview.html = getMissionControlHTML(this._state, nonce, cspSource);
  }

  /**
   * Handle messages from webview
   */
  private async handleMessage(message: { type: string; payload?: any }): Promise<void> {
    switch (message.type) {
      case 'selectSession':
        await this.selectSession(message.payload.sessionId, message.payload.projectPath);
        break;

      case 'executeCommand':
        await this.executeCommand(message.payload.handler, message.payload.sessionId, message.payload.projectPath);
        break;

      case 'applyFilters':
        this.applyFilters(message.payload);
        break;

      case 'refresh':
        this.refresh();
        break;
    }
  }

  /**
   * Select a session
   */
  private async selectSession(sessionId: string, projectPath: string): Promise<void> {
    // Find the session card
    const card = this._state.sessions.find(s =>
      s.session.id === sessionId && s.session.projectPath === projectPath
    );

    if (card) {
      this._state.activeSession = card;
      this.updateWebview();
    }
  }

  /**
   * Execute a command
   */
  private async executeCommand(handler: string, sessionId: string, projectPath: string): Promise<void> {
    try {
      // Find the session
      const card = this._state.sessions.find(s =>
        s.session.id === sessionId && s.session.projectPath === projectPath
      );

      if (!card) {
        return;
      }

      // Execute the command
      await vscode.commands.executeCommand(handler, card.session);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Failed to execute command: ${msg}`);
    }
  }

  /**
   * Apply filters
   */
  private applyFilters(filterPayload: any): void {
    // Update filters
    if (filterPayload.search !== undefined) {
      this._state.filters.search = filterPayload.search;
    }

    if (filterPayload.status !== undefined) {
      this._state.filters.status = filterPayload.status;
    }

    if (filterPayload.projects !== undefined) {
      this._state.filters.projects = filterPayload.projects;
    }

    // Invalidate cache and update
    const aggregator = getSessionAggregator();
    aggregator.invalidate();
    this.updateState();
  }

  /**
   * Refresh the panel
   */
  public refresh(): void {
    const aggregator = getSessionAggregator();
    aggregator.invalidate();
    this.updateState();
  }

  /**
   * Dispose the panel
   */
  public dispose() {
    MissionControlPanel.currentPanel = undefined;

    // Stop polling
    this.stopPolling();

    // Clean up resources
    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}

/**
 * Generate a nonce for CSP
 */
function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
