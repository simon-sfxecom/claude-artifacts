import * as vscode from 'vscode';
import * as path from 'path';
import { renderMarkdown } from './renderer';
import {
  WebviewMessage,
  WebviewOutgoingMessage,
  ArtifactState,
  handleWebviewMessage,
  getApproveButtonLabel,
  getModeIndicator,
  getRelativeTime,
  CSS_VARIABLES,
  MODE_BADGE_CSS,
  ACTION_BUTTON_CSS,
  MARKDOWN_CSS,
  LOADING_CSS,
  MERMAID_INIT,
  UTILITY_FUNCTIONS,
  ACTION_FUNCTIONS,
  COMMENT_FUNCTIONS,
  MERMAID_RENDER,
  MESSAGE_HANDLER,
  ICONS,
  generateApprovalBanner,
  generatePanelActionButtons,
  generateCommentModal,
  generateBottomBar,
  generateEmptyState,
  generateScriptInit,
  generateScriptFooter,
  generateLoadingOverlay
} from './shared';

/**
 * Manages artifact webview panels (fullscreen/tab view)
 * Supports multiple panels for different plans (Split View)
 */
export class ArtifactPanel {
  // Map of filePath to panel instance for multi-panel support
  public static panels: Map<string, ArtifactPanel> = new Map();
  // Legacy: reference to most recently opened panel
  public static currentPanel: ArtifactPanel | undefined;
  public static readonly viewType = 'claudeArtifacts.artifactPanel';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _context: vscode.ExtensionContext;
  private readonly _state: ArtifactState;
  private readonly _panelId: string;
  private _content: string = '';
  private _filePath: string = '';
  private _mtime: Date | null = null;
  private _disposables: vscode.Disposable[] = [];

  /**
   * Create or show a panel for a specific plan file
   * Each unique filePath gets its own panel (Split View support)
   */
  public static createOrShow(
    context: vscode.ExtensionContext,
    content: string,
    filePath: string,
    mtime: Date | null = null
  ) {
    const column = vscode.ViewColumn.Beside;

    // Check if panel already exists for this file
    const existing = ArtifactPanel.panels.get(filePath);
    if (existing) {
      existing._panel.reveal(column);
      existing.updateContent(content, filePath, mtime);
      ArtifactPanel.currentPanel = existing;
      return;
    }

    // Create new panel
    const fileName = filePath ? path.basename(filePath, '.md') : 'Plan Preview';
    const panel = vscode.window.createWebviewPanel(
      ArtifactPanel.viewType,
      `📋 ${fileName}`,
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, 'media')
        ]
      }
    );

    const artifactPanel = new ArtifactPanel(panel, context, content, filePath, mtime);
    ArtifactPanel.panels.set(filePath, artifactPanel);
    ArtifactPanel.currentPanel = artifactPanel;
  }

  /**
   * Get panel by file path
   */
  public static getPanel(filePath: string): ArtifactPanel | undefined {
    return ArtifactPanel.panels.get(filePath);
  }

  /**
   * Update all open panels (useful when plan content changes)
   */
  public static updateAll(filePath: string, content: string, mtime: Date | null) {
    const panel = ArtifactPanel.panels.get(filePath);
    if (panel) {
      panel.updateContent(content, filePath, mtime);
    }
  }

  private constructor(
    panel: vscode.WebviewPanel,
    context: vscode.ExtensionContext,
    content: string,
    filePath: string,
    mtime: Date | null = null
  ) {
    this._panel = panel;
    this._context = context;

    // Extract session ID from plan filename (e.g., "toasty-colecashtari.md" → "toasty-colecashtari")
    const sessionId = filePath ? path.basename(filePath, '.md') : undefined;
    this._state = new ArtifactState(sessionId);

    this._panelId = filePath;
    this._content = content;
    this._filePath = filePath;
    this._mtime = mtime;

    this._update();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      (message) => this._handleMessage(message),
      null,
      this._disposables
    );
  }

  public updateContent(content: string, filePath: string, mtime: Date | null = null) {
    this._content = content;
    this._filePath = filePath;
    this._mtime = mtime;
    this._state.resetForNewContent();
    this._update();
  }

  public dispose() {
    // Remove from panels map
    ArtifactPanel.panels.delete(this._panelId);

    // Update currentPanel reference
    if (ArtifactPanel.currentPanel === this) {
      ArtifactPanel.currentPanel = undefined;
    }

    this._state.dispose();
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) x.dispose();
    }
  }

  private async _handleMessage(data: WebviewMessage) {
    try {
      const context = {
        postMessage: (msg: WebviewOutgoingMessage) => this._postMessage(msg),
        getFilePath: () => this._filePath,
        openFile: async () => {
          if (this._filePath) {
            const doc = await vscode.workspace.openTextDocument(this._filePath);
            await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
          }
        }
      };

      const result = await handleWebviewMessage(data, this._state, context);

      if (result.updateComments) {
        this._updateComments();
      }
      if (result.updateApproval) {
        this._updateApprovalState();
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(msg);
    }
  }

  /**
   * Full HTML rebuild - only for content changes
   */
  private _update() {
    const fileName = this._filePath ? path.basename(this._filePath) : 'Plan Preview';
    this._panel.title = fileName || 'Plan Preview';
    this._panel.webview.html = this._getHtmlContent();
  }

  /**
   * Send incremental update to webview via postMessage
   */
  private _postMessage(message: WebviewOutgoingMessage) {
    this._panel.webview.postMessage(message);
  }

  /**
   * Update comments without full HTML rebuild
   */
  private _updateComments() {
    this._postMessage({ type: 'updateComments', comments: this._state.comments });
  }

  /**
   * Update approval state without full HTML rebuild
   */
  private _updateApprovalState() {
    this._postMessage({
      type: 'setApprovalState',
      approved: this._state.planApproved,
      mode: this._state.approvalMode
    });
  }

  private _getHtmlContent(): string {
    const renderedContent = this._content ? renderMarkdown(this._content) : '';
    const timeAgo = getRelativeTime(this._mtime);
    const commentsJson = JSON.stringify(this._state.comments);
    const hasComments = this._state.comments.length > 0;
    const approveBtn = getApproveButtonLabel(this._state.permissionMode);
    const modeIndicator = getModeIndicator(this._state.permissionMode);
    const isApproved = this._state.planApproved;
    const approvalModeText = this._state.approvalMode === 'bypass' ? 'Bypass Mode' : this._state.approvalMode === 'manual' ? 'Manual Mode' : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline' https://cdn.jsdelivr.net; img-src data: https:;">
  <style>
    ${CSS_VARIABLES}

    body {
      font-family: var(--font-family);
      font-size: 14px;
      line-height: 1.6;
      color: var(--foreground);
      background-color: var(--background);
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      height: 100vh;
    }

    /* Toolbar */
    .toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 20px;
      background: var(--sidebar-bg);
      border-bottom: 1px solid var(--border-color);
      flex-shrink: 0;
    }

    .toolbar-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .toolbar-title {
      font-size: 15px;
      font-weight: 600;
      color: var(--foreground);
    }

    .toolbar-time {
      font-size: 12px;
      color: var(--muted);
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .toolbar-time svg { width: 14px; height: 14px; }

    ${MODE_BADGE_CSS}

    .action-buttons {
      display: flex;
      gap: 8px;
    }

    ${ACTION_BUTTON_CSS}

    .action-btn.feedback.has-comments {
      background: var(--warning);
      color: #000;
      border-color: var(--warning);
    }

    .action-buttons.approved {
      opacity: 0.5;
      pointer-events: none;
    }

    /* Approval Banner */
    .approval-banner {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 12px 20px;
      background: linear-gradient(135deg, rgba(78, 201, 176, 0.15), rgba(78, 201, 176, 0.05));
      border-bottom: 1px solid var(--success);
      flex-shrink: 0;
    }

    .approval-banner svg {
      width: 20px;
      height: 20px;
      color: var(--success);
    }

    .approval-banner-text {
      font-size: 14px;
      font-weight: 600;
      color: var(--success);
    }

    .approval-banner-mode {
      font-size: 11px;
      color: var(--muted);
      background: rgba(78, 201, 176, 0.2);
      padding: 3px 8px;
      border-radius: 4px;
    }

    /* Main Layout */
    .main-container {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    .content-area {
      flex: 1;
      overflow-y: auto;
      padding: 24px 40px;
    }

    .content {
      max-width: 800px;
    }

    /* Comments Sidebar */
    .comments-sidebar {
      width: 280px;
      background: var(--sidebar-bg);
      border-left: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
    }

    .comments-header {
      padding: 16px;
      border-bottom: 1px solid var(--border-color);
      font-size: 13px;
      font-weight: 600;
    }

    .comments-list {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
    }

    .comment-card {
      background: var(--input-bg);
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 10px;
    }

    .comment-meta {
      font-size: 11px;
      color: var(--muted);
      margin-bottom: 6px;
    }

    .comment-text {
      font-size: 13px;
      margin-bottom: 8px;
    }

    .comment-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }

    .comment-action-btn {
      background: none;
      border: none;
      color: var(--muted);
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
    }

    .comment-action-btn:hover {
      background: var(--border-color);
      color: var(--foreground);
    }

    .no-comments {
      text-align: center;
      color: var(--muted);
      padding: 20px;
      font-size: 12px;
    }

    /* Section Line - clickable headings */
    .section-line {
      cursor: pointer;
    }

    .section-line:hover {
      background: rgba(255,255,255,0.05);
      border-radius: 4px;
    }

    /* Empty State */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 300px;
      color: var(--muted);
      text-align: center;
    }

    .empty-state svg { width: 48px; height: 48px; margin-bottom: 16px; opacity: 0.5; }

    /* Bottom Bar */
    .bottom-bar {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px 20px;
      background: var(--sidebar-bg);
      border-top: 1px solid var(--border-color);
      flex-shrink: 0;
    }

    .bottom-bar-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .message-input {
      flex: 1;
      padding: 10px 14px;
      background: var(--input-bg);
      border: 1px solid var(--input-border);
      border-radius: 4px;
      color: var(--foreground);
      font-size: 13px;
    }

    .message-input:focus {
      outline: none;
      border-color: var(--link-color);
    }

    .submit-btn {
      padding: 10px 20px;
      background: var(--button-bg);
      color: var(--button-fg);
      border: none;
      border-radius: 4px;
      font-size: 13px;
      cursor: pointer;
    }

    .mode-toggle {
      display: flex;
      flex-direction: column;
      gap: 3px;
      font-size: 11px;
      color: var(--muted);
    }

    .mode-toggle-row {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .mode-toggle input[type="checkbox"] {
      width: 14px;
      height: 14px;
      cursor: pointer;
    }

    .mode-toggle label {
      cursor: pointer;
      user-select: none;
    }

    .mode-toggle-hint {
      font-size: 10px;
      color: var(--muted);
      opacity: 0.7;
      padding-left: 20px;
    }

    .submit-btn:hover { filter: brightness(1.15); }

    /* Modal */
    .modal-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      z-index: 100;
      align-items: center;
      justify-content: center;
    }

    .modal-overlay.active { display: flex; }

    .modal {
      background: var(--sidebar-bg);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 20px;
      width: 400px;
      max-width: 90%;
    }

    .modal-title {
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 8px;
    }

    .modal-subtitle {
      font-size: 12px;
      color: var(--muted);
      margin-bottom: 12px;
    }

    .modal-input {
      width: 100%;
      padding: 10px 12px;
      background: var(--input-bg);
      border: 1px solid var(--input-border);
      border-radius: 4px;
      color: var(--foreground);
      font-size: 13px;
      resize: vertical;
      min-height: 80px;
    }

    .modal-input:focus {
      outline: none;
      border-color: var(--link-color);
    }

    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 16px;
    }

    .modal-btn {
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      font-size: 13px;
      cursor: pointer;
    }

    .modal-btn-cancel {
      background: transparent;
      color: var(--muted);
    }

    .modal-btn-submit {
      background: var(--button-bg);
      color: var(--button-fg);
    }

    ${LOADING_CSS}
    ${MARKDOWN_CSS}
  </style>
</head>
<body>
  <div class="toolbar">
    <div class="toolbar-left">
      <span class="toolbar-title">Plan Preview</span>
      ${timeAgo ? `
      <span class="toolbar-time">
        <svg viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 3.5a.5.5 0 00-1 0V9a.5.5 0 00.252.434l3.5 2a.5.5 0 00.496-.868L8 8.71V3.5z"/>
          <path d="M8 16A8 8 0 108 0a8 8 0 000 16zm7-8A7 7 0 111 8a7 7 0 0114 0z"/>
        </svg>
        ${timeAgo}
      </span>
      ` : ''}
      ${modeIndicator ? `<span class="mode-badge">${modeIndicator}</span>` : ''}
    </div>
    ${generatePanelActionButtons(approveBtn, hasComments, this._state.comments.length, isApproved)}
  </div>

  ${generateApprovalBanner(isApproved, approvalModeText)}

  <div class="main-container">
    <div class="content-area">
      ${renderedContent ? `
      <div class="content" id="content">
        ${renderedContent}
      </div>
      ` : generateEmptyState('panel')}
    </div>

    <div class="comments-sidebar">
      <div class="comments-header">Comments</div>
      <div class="comments-list" id="commentsList"></div>
    </div>
  </div>

  ${generateBottomBar('panel')}

  <!-- Loading Overlay -->
  ${generateLoadingOverlay()}

  <!-- Comment Modal -->
  ${generateCommentModal('panel')}

  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <script>
    ${generateScriptInit(commentsJson)}

    ${MERMAID_INIT}
    ${UTILITY_FUNCTIONS}
    ${ACTION_FUNCTIONS}
    ${COMMENT_FUNCTIONS}

    function setLoading(isLoading) {
      const overlay = document.getElementById('loadingOverlay');
      const submitBtn = document.querySelector('.submit-btn');

      if (isLoading) {
        overlay.classList.add('active');
        if (submitBtn) submitBtn.disabled = true;
      } else {
        overlay.classList.remove('active');
        if (submitBtn) submitBtn.disabled = false;
      }
    }

    ${MESSAGE_HANDLER}

    ${generateScriptFooter()}
    ${MERMAID_RENDER}
  </script>
</body>
</html>`;
  }
}
