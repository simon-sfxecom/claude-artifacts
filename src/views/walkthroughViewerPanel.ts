import * as vscode from 'vscode';
import { ClaudeSession } from '../models/session';
import { getMediaCaptureService, MediaEntry } from '../services/mediaCaptureService';
import { getWalkthroughHTML } from '../shared/walkthroughWebview';

/**
 * Walkthrough Viewer Panel - Rich media viewer with timeline, gallery, and annotations
 *
 * Features:
 * - Timeline navigation with event markers
 * - Media gallery with lazy loading
 * - Lightbox image viewer
 * - Video player with comment timeline
 * - Annotation system for images and videos
 * - Export to PDF/Zip
 */
export class WalkthroughViewerPanel {
  public static currentPanels: Map<string, WalkthroughViewerPanel> = new Map();
  private static readonly viewType = 'claudeArtifacts.walkthroughViewer';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _session: ClaudeSession;
  private _disposables: vscode.Disposable[] = [];

  /**
   * Create or show walkthrough viewer panel
   */
  public static async createOrShow(
    extensionUri: vscode.Uri,
    session: ClaudeSession
  ): Promise<WalkthroughViewerPanel> {
    const column = vscode.ViewColumn.One;
    const sessionKey = `${session.projectPath}:${session.id}`;

    // If we already have a panel for this session, show it
    if (WalkthroughViewerPanel.currentPanels.has(sessionKey)) {
      const panel = WalkthroughViewerPanel.currentPanels.get(sessionKey)!;
      panel._panel.reveal(column);
      return panel;
    }

    // Otherwise, create a new panel
    const displayName = session.displayName || session.id;
    const panel = vscode.window.createWebviewPanel(
      WalkthroughViewerPanel.viewType,
      `Walkthrough: ${displayName}`,
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'out'),
          vscode.Uri.file(require('os').homedir())
        ]
      }
    );

    const viewerPanel = new WalkthroughViewerPanel(panel, extensionUri, session);
    WalkthroughViewerPanel.currentPanels.set(sessionKey, viewerPanel);

    return viewerPanel;
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
  }

  /**
   * Update webview HTML
   */
  private async updateWebview(): Promise<void> {
    const webview = this._panel.webview;
    const nonce = getNonce();
    const cspSource = webview.cspSource;

    // Load media for this session
    const mediaCaptureService = getMediaCaptureService();
    const mediaIndex = await mediaCaptureService.getMediaIndex(this._session.id);

    // Convert file paths to webview URIs
    const mediaWithUris = mediaIndex.media.map(entry => ({
      ...entry,
      webviewUri: webview.asWebviewUri(vscode.Uri.file(entry.filePath)).toString()
    }));

    webview.html = getWalkthroughHTML(
      this._session,
      mediaWithUris,
      nonce,
      cspSource
    );
  }

  /**
   * Handle messages from webview
   */
  private async handleMessage(message: { type: string; [key: string]: any }): Promise<void> {
    const mediaCaptureService = getMediaCaptureService();

    switch (message.type) {
      case 'addComment':
        await mediaCaptureService.addComment(
          this._session.id,
          message.mediaId,
          message.text,
          message.position,
          message.videoTimestamp
        );
        await this.updateWebview();
        break;

      case 'deleteMedia':
        await mediaCaptureService.deleteMedia(this._session.id, message.mediaId);
        await this.updateWebview();
        vscode.window.showInformationMessage('Media deleted');
        break;

      case 'exportPDF':
        await this.exportPDF();
        break;

      case 'exportZip':
        await this.exportZip();
        break;

      case 'refresh':
        await this.updateWebview();
        break;
    }
  }

  /**
   * Export walkthrough to PDF
   */
  private async exportPDF(): Promise<void> {
    vscode.window.showInformationMessage('PDF export feature coming soon!');
    // TODO: Implement PDF generation with images embedded
  }

  /**
   * Export walkthrough to Zip
   */
  private async exportZip(): Promise<void> {
    const path = require('path');
    const fs = require('fs').promises;
    const os = require('os');

    try {
      // Prompt for save location
      const saveUri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(path.join(os.homedir(), `walkthrough-${this._session.id}.zip`)),
        filters: {
          'Zip Archive': ['zip']
        }
      });

      if (!saveUri) {
        return;
      }

      // Get media index
      const mediaCaptureService = getMediaCaptureService();
      const mediaIndex = await mediaCaptureService.getMediaIndex(this._session.id);

      // Create zip (using simple tar for now, proper zip would need a library)
      const archiver = require('archiver');
      const output = require('fs').createWriteStream(saveUri.fsPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      archive.pipe(output);

      // Add media files
      for (const media of mediaIndex.media) {
        try {
          const fileName = path.basename(media.filePath);
          archive.file(media.filePath, { name: fileName });
        } catch (error) {
          console.error(`Failed to add ${media.filePath} to archive:`, error);
        }
      }

      // Add media index
      archive.append(JSON.stringify(mediaIndex, null, 2), { name: 'media-index.json' });

      await archive.finalize();

      vscode.window.showInformationMessage(`Walkthrough exported to ${saveUri.fsPath}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Export failed: ${msg}`);
    }
  }

  /**
   * Dispose the panel
   */
  public dispose(): void {
    const sessionKey = `${this._session.projectPath}:${this._session.id}`;
    WalkthroughViewerPanel.currentPanels.delete(sessionKey);

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
function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
