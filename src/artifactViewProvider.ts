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
  HEADER_CSS,
  MARKDOWN_CSS,
  MERMAID_INIT,
  UTILITY_FUNCTIONS,
  ACTION_FUNCTIONS,
  COMMENT_FUNCTIONS,
  MERMAID_RENDER,
  MESSAGE_HANDLER,
  ICONS,
  generateApprovalBanner,
  generateSidebarActionButtons,
  generateCommentModal,
  generateBottomBar,
  generateEmptyState,
  generateScriptInit,
  generateScriptFooter
} from './shared';

export class ArtifactViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  public static readonly viewType = 'claudeArtifacts.artifactView';

  private _view?: vscode.WebviewView;
  private _currentContent: string = '';
  private _currentFilePath: string = '';
  private _currentMtime: Date | null = null;
  private _state: ArtifactState;

  constructor(private readonly _context: vscode.ExtensionContext) {
    this._state = new ArtifactState();
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._context.extensionUri, 'media')
      ]
    };

    webviewView.webview.html = this._getHtmlContent('', '');

    webviewView.webview.onDidReceiveMessage(
      (data) => this._handleMessage(data),
      undefined,
      this._context.subscriptions
    );
  }

  public updateContent(content: string, filePath: string, mtime: Date | null = null) {
    this._currentContent = content;
    this._currentFilePath = filePath;
    this._currentMtime = mtime;
    this._state.resetForNewContent();

    if (this._view) {
      this._view.webview.html = this._getHtmlContent(content, filePath, mtime);
    }
  }

  private async _handleMessage(data: WebviewMessage) {
    try {
      // Handle openFullscreen directly
      if (data.type === 'openFullscreen') {
        vscode.commands.executeCommand('claudeArtifacts.openInTab');
        return;
      }

      const context = {
        postMessage: (msg: WebviewOutgoingMessage) => this._postMessage(msg),
        getFilePath: () => this._currentFilePath,
        openFile: async () => {
          if (this._currentFilePath) {
            const doc = await vscode.workspace.openTextDocument(this._currentFilePath);
            await vscode.window.showTextDocument(doc);
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
  private _updateWebview() {
    if (this._view) {
      this._view.webview.html = this._getHtmlContent(
        this._currentContent,
        this._currentFilePath,
        this._currentMtime
      );
    }
  }

  /**
   * Send incremental update to webview via postMessage
   */
  private _postMessage(message: WebviewOutgoingMessage) {
    this._view?.webview.postMessage(message);
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

  public dispose() {
    this._state.dispose();
  }

  /**
   * Public methods for keyboard shortcuts
   */
  public async approve(): Promise<void> {
    if (this._state.planApproved) return;
    try {
      await this._state.claudeService.sendChoice(1);
      this._state.setApproved('bypass');
      this._updateApprovalState();
      vscode.window.showInformationMessage('Plan approved (bypass permissions)');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(msg);
    }
  }

  public async approveManual(): Promise<void> {
    if (this._state.planApproved) return;
    try {
      await this._state.claudeService.sendChoice(2);
      this._state.setApproved('manual');
      this._updateApprovalState();
      vscode.window.showInformationMessage('Plan approved (manual edits)');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(msg);
    }
  }

  public async sendFeedback(): Promise<void> {
    if (this._state.comments.length === 0) {
      vscode.window.showWarningMessage('No comments to send. Add comments first!');
      return;
    }
    try {
      const feedback = this._state.getFormattedComments();
      const commentCount = this._state.clearComments();
      await this._state.claudeService.sendChoiceWithFeedback(3, feedback);
      this._updateComments();
      vscode.window.showInformationMessage(`Sent ${commentCount} comment(s) to Claude`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(msg);
    }
  }

  private _getHtmlContent(markdown: string, filePath: string, mtime: Date | null = null): string {
    const fileName = filePath ? path.basename(filePath) : '';
    const renderedContent = markdown ? renderMarkdown(markdown) : '';
    const timeAgo = getRelativeTime(mtime);
    const commentsJson = JSON.stringify(this._state.comments);
    const hasComments = this._state.comments.length > 0;
    const approveBtn = getApproveButtonLabel(this._state.permissionMode);
    const modeIndicator = getModeIndicator(this._state.permissionMode);
    const isApproved = this._state.planApproved;
    const approvalModeText = this._state.approvalMode === 'bypass' ? 'Bypass Mode' : this._state.approvalMode === 'manual' ? 'Manual Mode' : '';

    // Source badge for Claude Code
    const sourceLabel = 'Claude';

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
      font-size: 13px;
      line-height: 1.6;
      color: var(--foreground);
      background-color: var(--sidebar-bg);
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      height: 100vh;
    }

    ${HEADER_CSS}

    ${MODE_BADGE_CSS}

    .approval-banner {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 12px;
      background: linear-gradient(135deg, rgba(78, 201, 176, 0.15), rgba(78, 201, 176, 0.05));
      border-bottom: 1px solid var(--success);
      flex-shrink: 0;
    }

    .approval-banner svg {
      width: 16px;
      height: 16px;
      color: var(--success);
    }

    .approval-banner-text {
      font-size: 12px;
      font-weight: 500;
      color: var(--success);
    }

    .approval-banner-mode {
      font-size: 10px;
      color: var(--muted);
      background: rgba(78, 201, 176, 0.2);
      padding: 2px 6px;
      border-radius: 3px;
    }

    .action-bar {
      display: flex;
      gap: 6px;
      padding: 10px 12px;
      border-bottom: 1px solid var(--border-color);
      flex-shrink: 0;
    }

    .action-bar.approved {
      opacity: 0.5;
      pointer-events: none;
    }

    .action-btn {
      flex: 1;
      padding: 8px 12px;
      border: none;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }

    .action-btn svg { width: 14px; height: 14px; }
    .action-btn.primary { background: var(--success); color: #000; }
    .action-btn.primary:hover { filter: brightness(1.1); }
    .action-btn.secondary { background: var(--input-bg); color: var(--foreground); border: 1px solid var(--border-color); }
    .action-btn.secondary:hover { background: var(--border-color); }
    .action-btn.feedback { background: ${hasComments ? 'var(--warning)' : 'var(--input-bg)'}; color: ${hasComments ? '#000' : 'var(--foreground)'}; border: 1px solid ${hasComments ? 'var(--warning)' : 'var(--border-color)'}; }
    .action-btn.feedback:hover { filter: brightness(1.1); }

    .badge { background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 10px; font-size: 10px; }

    .comments-section {
      padding: 8px 12px;
      border-bottom: 1px solid var(--border-color);
      flex-shrink: 0;
      max-height: 150px;
      overflow-y: auto;
      display: ${hasComments ? 'block' : 'none'};
    }

    .comments-header { font-size: 10px; color: var(--muted); text-transform: uppercase; margin-bottom: 8px; }

    .comment-item { background: var(--input-bg); border-radius: 4px; padding: 8px; margin-bottom: 6px; font-size: 11px; }
    .comment-meta { font-size: 10px; color: var(--muted); margin-bottom: 4px; display: flex; justify-content: space-between; }
    .comment-delete { color: var(--danger); cursor: pointer; opacity: 0.7; }
    .comment-delete:hover { opacity: 1; }

    .content-wrapper { flex: 1; overflow-y: auto; padding: 12px; }

    .section-line { position: relative; cursor: pointer; }
    .section-line:hover::after { content: '+'; position: absolute; right: 0; top: 0; width: 20px; height: 20px; background: var(--button-bg); color: var(--button-fg); border-radius: 3px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: bold; }

    .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 150px; color: var(--muted); text-align: center; }
    .empty-state svg { width: 40px; height: 40px; margin-bottom: 10px; opacity: 0.5; }

    .bottom-bar { display: flex; flex-direction: column; gap: 6px; padding: 8px 12px; border-top: 1px solid var(--border-color); flex-shrink: 0; }
    .bottom-bar-row { display: flex; gap: 6px; align-items: center; }

    .message-input { flex: 1; padding: 6px 10px; background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 4px; color: var(--foreground); font-size: 12px; }
    .message-input:focus { outline: none; border-color: var(--link-color); }

    .send-btn { padding: 6px 12px; background: var(--button-bg); color: var(--button-fg); border: none; border-radius: 4px; font-size: 11px; cursor: pointer; }
    .send-btn:hover { filter: brightness(1.15); }

    .mode-toggle { display: flex; flex-direction: column; gap: 2px; font-size: 10px; color: var(--muted); }
    .mode-toggle-row { display: flex; align-items: center; gap: 4px; }
    .mode-toggle input[type="checkbox"] { width: 12px; height: 12px; cursor: pointer; }
    .mode-toggle label { cursor: pointer; user-select: none; }
    .mode-toggle-hint { font-size: 9px; color: var(--muted); opacity: 0.7; padding-left: 16px; }

    .modal-overlay { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.6); z-index: 100; align-items: center; justify-content: center; }
    .modal-overlay.active { display: flex; }
    .modal { background: var(--sidebar-bg); border: 1px solid var(--border-color); border-radius: 6px; padding: 16px; width: 90%; max-width: 300px; }
    .modal-title { font-size: 13px; font-weight: 600; margin-bottom: 8px; }
    .modal-subtitle { font-size: 11px; color: var(--muted); margin-bottom: 12px; }
    .modal-input { width: 100%; padding: 8px; background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 4px; color: var(--foreground); font-size: 12px; resize: vertical; min-height: 60px; }
    .modal-input:focus { outline: none; border-color: var(--link-color); }
    .modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
    .modal-btn { padding: 6px 12px; border: none; border-radius: 4px; font-size: 11px; cursor: pointer; }
    .modal-btn.cancel { background: transparent; color: var(--muted); }
    .modal-btn.submit { background: var(--button-bg); color: var(--button-fg); }

    ${MARKDOWN_CSS}
  </style>
</head>
<body>
  ${fileName ? `
  <div class="header">
    <div class="header-left">
      <span class="source-badge">${sourceLabel}</span>
      <span class="filename" onclick="openFile()">
        ${ICONS.openFile}
        ${fileName}
      </span>
      ${timeAgo ? `<span class="time-ago">${timeAgo}</span>` : ''}
      ${modeIndicator ? `<span class="mode-badge" title="Claude permission mode">${modeIndicator}</span>` : ''}
    </div>
    <div class="header-right">
      <button class="icon-btn" onclick="openFullscreen()" title="Open in Fullscreen Tab">
        ${ICONS.fullscreen}
      </button>
    </div>
  </div>
  ` : ''}

  ${generateApprovalBanner(isApproved, approvalModeText)}

  ${generateSidebarActionButtons(approveBtn, hasComments, this._state.comments.length, isApproved)}

  <div class="comments-section">
    <div class="comments-header">Comments to send</div>
    <div id="commentsList"></div>
  </div>

  <div class="content-wrapper">
    ${renderedContent ? `
    <div class="content" id="contentArea">
      ${renderedContent}
    </div>
    ` : generateEmptyState('sidebar')}
  </div>

  ${generateBottomBar('sidebar')}

  ${generateCommentModal('sidebar')}

  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <script>
    ${generateScriptInit(commentsJson)}

    ${MERMAID_INIT}
    ${UTILITY_FUNCTIONS}
    ${ACTION_FUNCTIONS}
    ${COMMENT_FUNCTIONS}
    ${MESSAGE_HANDLER}

    ${generateScriptFooter()}
    ${MERMAID_RENDER}
  </script>
</body>
</html>`;
  }
}
