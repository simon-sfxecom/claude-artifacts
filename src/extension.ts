import * as vscode from 'vscode';
import { ArtifactViewProvider } from './artifactViewProvider';
import { ArtifactPanel } from './artifactPanel';
import { PlanWatcher } from './planWatcher';

let planWatcher: PlanWatcher | undefined;
let currentContent: string = '';
let currentFilePath: string = '';
let currentMtime: Date | null = null;

export function activate(context: vscode.ExtensionContext) {
  console.log('Claude Artifacts extension is now active');

  // Create the webview provider
  const artifactViewProvider = new ArtifactViewProvider(context);

  // Register the webview view provider
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'claudeArtifacts.artifactView',
      artifactViewProvider
    )
  );

  // Create and start the plan watcher
  planWatcher = new PlanWatcher((content, filePath, mtime) => {
    currentContent = content;
    currentFilePath = filePath;
    currentMtime = mtime;
    artifactViewProvider.updateContent(content, filePath, mtime);

    // Also update the panel if it's open
    if (ArtifactPanel.currentPanel) {
      ArtifactPanel.currentPanel.updateContent(content, filePath, mtime);
    }
  });
  planWatcher.start();

  // Register refresh command
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeArtifacts.refresh', () => {
      planWatcher?.refresh();
    })
  );

  // Register open plan file command
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeArtifacts.openPlanFile', async () => {
      const currentFile = planWatcher?.getCurrentFile();
      if (currentFile) {
        try {
          const doc = await vscode.workspace.openTextDocument(currentFile);
          await vscode.window.showTextDocument(doc);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          vscode.window.showErrorMessage(`Failed to open plan file: ${msg}`);
        }
      } else {
        vscode.window.showInformationMessage('No plan file currently active');
      }
    })
  );

  // Register open in tab command
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeArtifacts.openInTab', () => {
      if (currentContent || currentFilePath) {
        ArtifactPanel.createOrShow(context, currentContent, currentFilePath, currentMtime);
      } else {
        vscode.window.showInformationMessage('No artifact to display. Run /plan in Claude Code first.');
      }
    })
  );

  // Register keyboard shortcut commands
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeArtifacts.approve', () => {
      artifactViewProvider.approve();
    }),
    vscode.commands.registerCommand('claudeArtifacts.approveManual', () => {
      artifactViewProvider.approveManual();
    }),
    vscode.commands.registerCommand('claudeArtifacts.sendFeedback', () => {
      artifactViewProvider.sendFeedback();
    })
  );

  // Register disposables for cleanup
  context.subscriptions.push(
    artifactViewProvider,
    { dispose: () => planWatcher?.dispose() }
  );
}

export function deactivate() {
  planWatcher?.dispose();
}
