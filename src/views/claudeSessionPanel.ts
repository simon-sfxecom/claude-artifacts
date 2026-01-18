import * as vscode from 'vscode';
import { getPTYManager, PTYSession } from '../services/ptyManager';
import { getPlanService } from '../services/planService';
import { getTerminalWebviewHTML } from '../shared/terminalWebview';
import { ClaudeSession } from '../models/session';

/**
 * Claude Session Panel - Embedded terminal with xterm.js and PTY
 *
 * This panel provides a full-featured terminal emulator for Claude Code sessions
 * with a sidebar showing the current plan and quick action buttons.
 */
export class ClaudeSessionPanel {
  public static currentPanels: Map<string, ClaudeSessionPanel> = new Map();
  private static readonly viewType = 'claudeArtifacts.claudeSessionPanel';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _session: ClaudeSession;
  private _ptySession: PTYSession | undefined;
  private _disposables: vscode.Disposable[] = [];;
  private _planUpdateListener: vscode.Disposable | undefined;

  /**
   * Create or show a Claude session panel
   */
  public static createOrShow(
    extensionUri: vscode.Uri,
    session: ClaudeSession
  ): ClaudeSessionPanel {
    const column = vscode.ViewColumn.One;
    const sessionKey = `${session.projectPath}:${session.id}`;

    // If we already have a panel for this session, show it
    if (ClaudeSessionPanel.currentPanels.has(sessionKey)) {
      const panel = ClaudeSessionPanel.currentPanels.get(sessionKey)!;
      panel._panel.reveal(column);
      return panel;
    }

    // Otherwise, create a new panel
    const displayName = session.displayName || session.id;
    const panel = vscode.window.createWebviewPanel(
      ClaudeSessionPanel.viewType,
      `Claude: ${displayName}`,
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'node_modules', '@xterm'),
          vscode.Uri.joinPath(extensionUri, 'node_modules')
        ]
      }
    );

    const claudePanel = new ClaudeSessionPanel(panel, extensionUri, session);
    ClaudeSessionPanel.currentPanels.set(sessionKey, claudePanel);

    return claudePanel;
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    session: ClaudeSession
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._session = session;

    // Set initial HTML
    this.updateWebview();

    // Listen for webview messages
    this._panel.webview.onDidReceiveMessage(
      message => this.handleMessage(message),
      null,
      this._disposables
    );

    // Handle panel dispose
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Listen for plan updates
    this.startPlanListener();
  }

  /**
   * Update webview HTML
   */
  private updateWebview(): void {
    const webview = this._panel.webview;
    const nonce = getNonce();
    const cspSource = webview.cspSource;

    // Get xterm resources
    const xtermCss = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@xterm', 'xterm', 'css', 'xterm.css')
    );
    const xtermJs = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@xterm', 'xterm', 'lib', 'xterm.js')
    );
    const xtermAddonFit = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@xterm', 'addon-fit', 'lib', 'addon-fit.js')
    );
    const xtermAddonWebgl = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@xterm', 'addon-webgl', 'lib', 'addon-webgl.js')
    );

    webview.html = getTerminalWebviewHTML(
      this._session.id,
      this._session.displayName || this._session.id,
      cspSource,
      nonce,
      xtermCss.toString(),
      xtermJs.toString(),
      xtermAddonFit.toString(),
      xtermAddonWebgl.toString()
    );
  }

  /**
   * Handle messages from webview
   */
  private async handleMessage(message: { type: string; data?: any; cols?: number; rows?: number }): Promise<void> {
    const ptyManager = getPTYManager();

    switch (message.type) {
      case 'ready':
        // Webview is ready, start PTY session
        await this.startPTYSession();
        break;

      case 'terminalInput':
        // Forward input to PTY
        if (this._ptySession) {
          ptyManager.write(this._session.id, message.data);
        }
        break;

      case 'terminalResize':
        // Resize PTY
        if (this._ptySession && message.cols && message.rows) {
          ptyManager.resize(this._session.id, message.cols, message.rows);
        }
        break;

      case 'pause':
        // Send Ctrl+C to pause
        if (this._ptySession) {
          ptyManager.write(this._session.id, '\x03');
        }
        break;

      case 'sendFeedback':
        // Trigger feedback command
        await vscode.commands.executeCommand('claudeArtifacts.sendFeedback');
        break;

      case 'approve':
        // Trigger approve command
        await vscode.commands.executeCommand('claudeArtifacts.approve');
        break;

      case 'decline':
        // Send 'n' to decline
        if (this._ptySession) {
          ptyManager.write(this._session.id, 'n\n');
        }
        break;
    }
  }

  /**
   * Start PTY session for Claude Code
   */
  private async startPTYSession(): Promise<void> {
    const ptyManager = getPTYManager();

    try {
      // Check if this is a new session or existing session
      const isNewSession = this._session.id.startsWith('new-chat-') || !this._session.planFile;

      if (isNewSession) {
        // Start a new Claude session
        this._ptySession = ptyManager.newSession(this._session.id, this._session.projectPath);

        // Auto-send 'claude' command to start
        setTimeout(() => {
          ptyManager.write(this._session.id, 'claude\n');
        }, 500);
      } else {
        // Resume existing Claude session
        this._ptySession = ptyManager.resumeSession(this._session.id, this._session.projectPath);
      }

      // Listen for PTY output
      ptyManager.addListener(this._session.id, (data: string) => {
        // Forward output to webview
        this._panel.webview.postMessage({
          type: 'terminalOutput',
          data: data
        });
      });

      console.log(`PTY session ${isNewSession ? 'started (new)' : 'resumed'} for ${this._session.id}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Failed to start terminal session: ${msg}`);
    }
  }

  /**
   * Start listening for plan updates
   */
  private startPlanListener(): void {
    const planService = getPlanService((plans, activePlan) => {
      // Check if this plan is for our session
      if (activePlan && activePlan.sessionId === this._session.id) {
        // Send plan update to webview
        this._panel.webview.postMessage({
          type: 'planUpdate',
          content: activePlan.markdownContent,
          needsApproval: this._session.inputRequired || false
        });
      }
    });

    // Store the listener (it's already registered, just keeping reference)
    // The plan service will call our callback when plans update
  }

  /**
   * Dispose the panel
   */
  public dispose(): void {
    const sessionKey = `${this._session.projectPath}:${this._session.id}`;
    ClaudeSessionPanel.currentPanels.delete(sessionKey);

    // Stop PTY session
    if (this._ptySession) {
      const ptyManager = getPTYManager();
      ptyManager.dispose(this._session.id);
    }

    // Clean up resources
    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }

    if (this._planUpdateListener) {
      this._planUpdateListener.dispose();
    }
  }
}

/**
 * Generate a nonce for CSP
 */
function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
