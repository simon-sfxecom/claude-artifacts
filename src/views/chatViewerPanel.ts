/**
 * Webview panel for viewing Claude session history (read-only)
 * Displays chat messages from session .jsonl files
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ClaudeSession } from '../models/session';
import { getSessionService } from '../services/sessionService';

interface ChatMessage {
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  toolName?: string;
  timestamp?: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Validate session ID format to prevent shell injection
 */
function isValidSessionId(id: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

export class ChatViewerPanel {
  public static panels: Map<string, ChatViewerPanel> = new Map();
  private static readonly viewType = 'claudeArtifacts.chatViewer';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _session: ClaudeSession;
  private readonly _sessionFile: string;
  private _disposables: vscode.Disposable[] = [];
  private _fileWatcher: fs.FSWatcher | null = null;
  private _debounceTimer: NodeJS.Timeout | null = null;

  /**
   * Create or show a chat viewer for an existing session
   */
  public static createOrShow(session: ClaudeSession, extensionUri?: vscode.Uri) {
    // Check if panel already exists for this session
    const existing = ChatViewerPanel.panels.get(session.id);
    if (existing) {
      existing._panel.reveal();
      return;
    }

    const column = vscode.ViewColumn.Beside;

    const panel = vscode.window.createWebviewPanel(
      ChatViewerPanel.viewType,
      `Chat: ${session.displayName.slice(0, 25)}`,
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    const viewer = new ChatViewerPanel(panel, session);
    ChatViewerPanel.panels.set(session.id, viewer);
  }

  private constructor(panel: vscode.WebviewPanel, session: ClaudeSession) {
    this._panel = panel;
    this._session = session;

    const sessionService = getSessionService();
    this._sessionFile = sessionService.getSessionFilePath(session.id, session.projectPath);

    // Initial load
    this._updateContent();
    this._setupFileWatcher();

    // Handle messages from webview
    this._panel.webview.onDidReceiveMessage(
      message => this._handleMessage(message),
      null,
      this._disposables
    );

    // Handle disposal
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  private _handleMessage(message: { type: string }) {
    switch (message.type) {
      case 'resumeSession':
        // Validate session ID before shell interpolation
        if (!isValidSessionId(this._session.id)) {
          vscode.window.showErrorMessage('Invalid session ID format');
          return;
        }
        // Open VS Code terminal to resume session
        const terminal = vscode.window.createTerminal({
          name: `Claude: ${this._session.displayName.slice(0, 20)}`,
          cwd: this._session.projectPath
        });
        terminal.show();
        terminal.sendText(`claude --resume ${this._session.id}`);
        break;
    }
  }

  private _setupFileWatcher(): void {
    if (!this._sessionFile) return;

    try {
      this._fileWatcher = fs.watch(this._sessionFile, (eventType) => {
        if (eventType === 'change') {
          // Debounce updates
          if (this._debounceTimer) {
            clearTimeout(this._debounceTimer);
          }
          this._debounceTimer = setTimeout(() => {
            this._updateContent();
          }, 100);
        }
      });
    } catch (error) {
      console.error('Failed to setup file watcher:', error);
    }
  }

  private async _updateContent() {
    const messages = await this._parseSessionFile();
    this._panel.webview.html = this._getHtml(messages);
  }

  private async _parseSessionFile(): Promise<ChatMessage[]> {
    const messages: ChatMessage[] = [];
    if (!this._sessionFile) return messages;

    try {
      const content = fs.readFileSync(this._sessionFile, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);

      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          const parsed = this._parseEntry(entry);
          if (parsed) {
            messages.push(...parsed);
          }
        } catch {
          // Skip unparseable lines
        }
      }
    } catch (error) {
      console.error('Failed to read session file:', error);
    }

    return messages;
  }

  private _parseEntry(entry: unknown): ChatMessage[] | null {
    if (!entry || typeof entry !== 'object') return null;

    const obj = entry as Record<string, unknown>;
    const messages: ChatMessage[] = [];

    // Handle different entry formats
    if (obj.type === 'user' && obj.message) {
      const msg = obj.message as Record<string, unknown>;
      if (msg.content && Array.isArray(msg.content)) {
        const textParts = (msg.content as Array<{ type: string; text?: string }>)
          .filter(c => c.type === 'text' && c.text)
          .map(c => c.text)
          .join('\n');
        if (textParts) {
          messages.push({ role: 'user', content: textParts });
        }
      }
    }

    if (obj.type === 'assistant' && obj.message) {
      const msg = obj.message as Record<string, unknown>;
      if (msg.content && Array.isArray(msg.content)) {
        for (const block of msg.content as Array<Record<string, unknown>>) {
          if (block.type === 'text' && block.text) {
            messages.push({ role: 'assistant', content: block.text as string });
          }
          if (block.type === 'tool_use' && block.name) {
            messages.push({
              role: 'tool',
              content: `Using tool: ${block.name}`,
              toolName: block.name as string
            });
          }
        }
      }
    }

    // Direct message format
    if (obj.role && obj.content) {
      messages.push({
        role: obj.role as ChatMessage['role'],
        content: typeof obj.content === 'string' ? obj.content : JSON.stringify(obj.content)
      });
    }

    return messages.length > 0 ? messages : null;
  }

  private _getHtml(messages: ChatMessage[]): string {
    const messagesHtml = messages.map(msg => {
      const icon = this._getRoleIcon(msg.role);
      const roleClass = msg.role;
      const content = this._formatContent(msg.content);

      return `
        <div class="message ${roleClass}">
          <div class="message-header">
            <span class="icon">${icon}</span>
            <span class="role">${msg.role}${msg.toolName ? `: ${msg.toolName}` : ''}</span>
          </div>
          <div class="message-content">${content}</div>
        </div>
      `;
    }).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
  <title>Chat History</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; overflow: hidden; }
    body {
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, sans-serif);
      font-size: 13px;
      background-color: var(--vscode-editor-background, #1e1e1e);
      color: var(--vscode-editor-foreground, #d4d4d4);
      display: flex;
      flex-direction: column;
    }
    .header {
      background: var(--vscode-titleBar-activeBackground, #3c3c3c);
      padding: 10px 14px;
      border-bottom: 1px solid var(--vscode-widget-border, #454545);
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .live-dot {
      width: 8px; height: 8px;
      background: #3b82f6;
      border-radius: 50%;
    }
    .header-title { font-weight: 600; color: var(--vscode-foreground, #fff); }
    .header-status { font-size: 11px; color: var(--vscode-descriptionForeground, #888); }
    .resume-btn {
      background: var(--vscode-button-background, #0e639c);
      color: var(--vscode-button-foreground, #fff);
      border: none;
      padding: 6px 12px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
    }
    .resume-btn:hover { background: var(--vscode-button-hoverBackground, #1177bb); }
    .chat-container {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
    }
    .message {
      margin-bottom: 14px;
      padding: 10px 12px;
      border-radius: 6px;
      background: var(--vscode-editor-inactiveSelectionBackground, #2d2d2d);
    }
    .message.user { background: #1e3a5f; border-left: 3px solid #3b82f6; }
    .message.assistant { background: #1e3d1e; border-left: 3px solid #22c55e; }
    .message.tool { background: #3d2e1e; border-left: 3px solid #f59e0b; font-size: 11px; }
    .message.system { background: #2d2d3d; border-left: 3px solid #8b5cf6; }
    .message-header {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 6px;
      font-size: 11px;
      opacity: 0.8;
    }
    .icon { font-size: 14px; }
    .role { text-transform: capitalize; font-weight: 500; }
    .message-content {
      white-space: pre-wrap;
      word-break: break-word;
      line-height: 1.5;
    }
    .message-content code {
      background: rgba(0,0,0,0.3);
      padding: 1px 4px;
      border-radius: 3px;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 12px;
    }
    .empty-state {
      text-align: center;
      padding: 40px;
      color: var(--vscode-descriptionForeground, #888);
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <div class="live-dot"></div>
      <span class="header-title">${escapeHtml(this._session.displayName)}</span>
      <span class="header-status">${messages.length} messages</span>
    </div>
    <button class="resume-btn" onclick="resumeSession()">▶ Resume Session</button>
  </div>
  <div class="chat-container" id="chat">
    ${messagesHtml || '<div class="empty-state">No messages yet</div>'}
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    const chat = document.getElementById('chat');
    chat.scrollTop = chat.scrollHeight;

    function resumeSession() {
      vscode.postMessage({ type: 'resumeSession' });
    }
  </script>
</body>
</html>`;
  }

  private _getRoleIcon(role: string): string {
    switch (role) {
      case 'user': return '👤';
      case 'assistant': return '🤖';
      case 'tool': return '🔧';
      case 'system': return '📋';
      default: return '💬';
    }
  }

  private _formatContent(content: string): string {
    let formatted = escapeHtml(content);
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
    return formatted;
  }

  public dispose() {
    ChatViewerPanel.panels.delete(this._session.id);

    if (this._fileWatcher) {
      this._fileWatcher.close();
    }

    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
    }

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }

    this._panel.dispose();
  }
}
