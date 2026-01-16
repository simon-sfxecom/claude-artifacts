/**
 * Webview panel for detailed session view
 */

import * as vscode from 'vscode';
import { ClaudeSession, TranscriptEntry } from '../models/session';
import { getSessionService } from '../services/sessionService';
import { getWalkthroughGenerator } from '../services/walkthroughGenerator';

/**
 * Generate a nonce for Content Security Policy
 */
function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export class SessionDetailPanel {
  public static currentPanel: SessionDetailPanel | undefined;
  private static readonly viewType = 'claudeArtifacts.sessionDetail';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private _session: ClaudeSession | undefined;

  public static createOrShow(extensionUri: vscode.Uri, session: ClaudeSession) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it
    if (SessionDetailPanel.currentPanel) {
      SessionDetailPanel.currentPanel._panel.reveal(column);
      SessionDetailPanel.currentPanel.updateSession(session);
      return;
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      SessionDetailPanel.viewType,
      'Session Details',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    SessionDetailPanel.currentPanel = new SessionDetailPanel(panel, extensionUri, session);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, session: ClaudeSession) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._session = session;

    // Set the webview's initial html content
    this._update();

    // Listen for when the panel is disposed
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      message => {
        switch (message.command) {
          case 'resume':
            if (this._session) {
              vscode.commands.executeCommand('claudeArtifacts.resumeSession', this._session);
            }
            return;
          case 'viewWalkthrough':
            if (this._session) {
              vscode.commands.executeCommand('claudeArtifacts.viewWalkthrough', this._session);
            }
            return;
        }
      },
      null,
      this._disposables
    );
  }

  public updateSession(session: ClaudeSession) {
    this._session = session;
    this._update();
  }

  private async _update() {
    if (!this._session) return;

    const webview = this._panel.webview;
    this._panel.title = `Session: ${this._session.displayName.slice(0, 20)}`;
    webview.html = await this._getHtmlForWebview(webview);
  }

  private async _getHtmlForWebview(webview: vscode.Webview): Promise<string> {
    if (!this._session) return '<html><body>No session selected</body></html>';

    const session = this._session;
    const sessionService = getSessionService();
    const nonce = getNonce();

    // Get transcript entries
    let entries: TranscriptEntry[] = [];
    try {
      entries = await sessionService.getSessionDetails(session.id, session.projectPath);
    } catch (e) {
      console.error('Failed to load session details:', e);
    }

    // Generate summary stats
    const walkthroughGenerator = getWalkthroughGenerator();
    let summary;
    try {
      summary = await walkthroughGenerator.generateWalkthrough(session.id, session.projectPath);
    } catch (e) {
      console.error('Failed to generate walkthrough:', e);
    }

    const statusColor = this.getStatusColor(session.status);
    const statusLabel = session.status.charAt(0).toUpperCase() + session.status.slice(1);
    const duration = summary ? this.formatDuration(summary.duration) : 'Unknown';

    // XSS-safe: escape all user-derived content
    const toolCallsHtml = summary?.toolCalls.slice(0, 10).map(tc => `
      <div class="tool-item">
        <span class="tool-name">${escapeHtml(tc.tool)}</span>
        <span class="tool-count">${tc.count}</span>
      </div>
    `).join('') || '<p class="muted">No tool calls recorded</p>';

    const filesHtml = summary?.filesModified.slice(0, 15).map(f => `
      <div class="file-item">
        <span class="codicon codicon-file"></span>
        <span class="file-path">${escapeHtml(this.basename(f))}</span>
      </div>
    `).join('') || '<p class="muted">No files modified</p>';

    const timelineHtml = entries.slice(0, 20).map(entry => {
      const icon = this.getEntryIcon(entry.type);
      const time = entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : '';
      const content = this.getEntryPreview(entry);
      return `
        <div class="timeline-item">
          <span class="timeline-icon codicon codicon-${escapeHtml(icon)}"></span>
          <div class="timeline-content">
            <span class="timeline-type">${escapeHtml(entry.type)}</span>
            <span class="timeline-time">${escapeHtml(time)}</span>
            <p class="timeline-preview">${content}</p>
          </div>
        </div>
      `;
    }).join('') || '<p class="muted">No activity recorded</p>';

    // Content Security Policy
    const cspSource = webview.cspSource;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>Session Details</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      padding: 16px;
      line-height: 1.5;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 20px;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
      background-color: ${statusColor}22;
      color: ${statusColor};
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: ${statusColor};
    }
    h1 {
      font-size: 20px;
      font-weight: 600;
      margin: 0;
      flex: 1;
    }
    .actions {
      display: flex;
      gap: 8px;
      margin-bottom: 20px;
    }
    button {
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
    }
    .btn-primary {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    .btn-primary:hover {
      background-color: var(--vscode-button-hoverBackground);
    }
    .btn-secondary {
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 12px;
      margin-bottom: 24px;
    }
    .stat-card {
      background-color: var(--vscode-editor-inactiveSelectionBackground);
      padding: 12px;
      border-radius: 6px;
    }
    .stat-value {
      font-size: 24px;
      font-weight: 600;
      color: var(--vscode-textLink-foreground);
    }
    .stat-label {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }
    .section {
      margin-bottom: 24px;
    }
    .section-title {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 12px;
      color: var(--vscode-foreground);
    }
    .tool-item, .file-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 0;
      border-bottom: 1px solid var(--vscode-widget-border);
    }
    .tool-name, .file-path {
      flex: 1;
      font-size: 13px;
    }
    .tool-count {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }
    .timeline-item {
      display: flex;
      gap: 12px;
      padding: 8px 0;
      border-left: 2px solid var(--vscode-widget-border);
      padding-left: 12px;
      margin-left: 8px;
    }
    .timeline-icon {
      font-size: 14px;
      color: var(--vscode-textLink-foreground);
    }
    .timeline-content {
      flex: 1;
    }
    .timeline-type {
      font-weight: 500;
      font-size: 12px;
      text-transform: uppercase;
    }
    .timeline-time {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-left: 8px;
    }
    .timeline-preview {
      font-size: 13px;
      color: var(--vscode-descriptionForeground);
      margin: 4px 0 0 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .muted {
      color: var(--vscode-descriptionForeground);
      font-style: italic;
    }
    .codicon {
      font-family: 'codicon';
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(session.displayName)}</h1>
    <span class="status-badge">
      <span class="status-dot"></span>
      ${escapeHtml(statusLabel)}
    </span>
  </div>

  <div class="actions">
    <button class="btn-primary" id="resumeBtn">Resume Session</button>
    <button class="btn-secondary" id="walkthroughBtn">View Summary</button>
  </div>

  <div class="stats">
    <div class="stat-card">
      <div class="stat-value">${session.messageCount}</div>
      <div class="stat-label">Messages</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${summary?.toolCalls.reduce((s, t) => s + t.count, 0) || 0}</div>
      <div class="stat-label">Tool Calls</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${summary?.filesModified.length || 0}</div>
      <div class="stat-label">Files Modified</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${escapeHtml(duration)}</div>
      <div class="stat-label">Duration</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Tool Usage</div>
    ${toolCallsHtml}
  </div>

  <div class="section">
    <div class="section-title">Modified Files</div>
    ${filesHtml}
  </div>

  <div class="section">
    <div class="section-title">Recent Activity</div>
    ${timelineHtml}
  </div>

  <script nonce="${nonce}">
    (function() {
      try {
        const vscode = acquireVsCodeApi();

        document.getElementById('resumeBtn').addEventListener('click', function() {
          vscode.postMessage({ command: 'resume' });
        });

        document.getElementById('walkthroughBtn').addEventListener('click', function() {
          vscode.postMessage({ command: 'viewWalkthrough' });
        });
      } catch (err) {
        console.error('Failed to initialize webview:', err);
      }
    })();
  </script>
</body>
</html>`;
  }

  private getStatusColor(status: string): string {
    switch (status) {
      case 'active': return '#3794ff';
      case 'paused': return '#cca700';
      case 'completed': return '#89d185';
      default: return '#808080';
    }
  }

  private formatDuration(ms: number): string {
    if (ms < 60000) return '<1m';
    const minutes = Math.floor(ms / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  }

  private basename(filePath: string): string {
    return filePath.split('/').pop() || filePath;
  }

  private getEntryIcon(type: string): string {
    switch (type) {
      case 'user': return 'account';
      case 'assistant': return 'hubot';
      case 'tool_use': return 'tools';
      case 'tool_result': return 'output';
      default: return 'circle-outline';
    }
  }

  private getEntryPreview(entry: TranscriptEntry): string {
    if ((entry.type === 'user' || entry.type === 'assistant') && entry.content) {
      return escapeHtml(entry.content.slice(0, 100));
    }
    if (entry.type === 'tool_use' && entry.tool_name) {
      return escapeHtml(entry.tool_name);
    }
    if (entry.type === 'summary' && entry.summary) {
      return escapeHtml(entry.summary.slice(0, 100));
    }
    return '';
  }

  public dispose() {
    SessionDetailPanel.currentPanel = undefined;

    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}
