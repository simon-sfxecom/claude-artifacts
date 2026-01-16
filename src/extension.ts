import * as vscode from 'vscode';
import { ArtifactViewProvider } from './artifactViewProvider';
import { ArtifactPanel } from './artifactPanel';
import { PlanWatcher } from './planWatcher';
import { SessionInboxProvider } from './views/sessionInboxProvider';
import { ClaudeSession } from './models/session';
import { getWorktreeService } from './services/worktreeService';
import { getWalkthroughGenerator } from './services/walkthroughGenerator';
import { SessionDetailPanel } from './views/sessionDetailPanel';
import { getSessionService } from './services/sessionService';

let planWatcher: PlanWatcher | undefined;
let currentContent: string = '';
let currentFilePath: string = '';
let currentMtime: Date | null = null;
let statusBarItem: vscode.StatusBarItem | undefined;

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

  // Create and register session inbox provider
  const sessionInboxProvider = new SessionInboxProvider();
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(
      'claudeArtifacts.sessionInbox',
      sessionInboxProvider
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

  // Session inbox commands
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeArtifacts.refreshSessions', () => {
      sessionInboxProvider.refresh();
    }),
    vscode.commands.registerCommand('claudeArtifacts.resumeSession', async (session: ClaudeSession) => {
      const terminal = vscode.window.createTerminal({
        name: `Claude: ${session.displayName.slice(0, 20)}`,
        cwd: session.projectPath
      });
      terminal.show();
      terminal.sendText(`claude --resume ${session.id}`);
    }),
    vscode.commands.registerCommand('claudeArtifacts.showSessionDetails', (session: ClaudeSession) => {
      SessionDetailPanel.createOrShow(context.extensionUri, session);
    })
  );

  // Walkthrough commands
  const walkthroughGenerator = getWalkthroughGenerator();
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeArtifacts.viewWalkthrough', async (session: ClaudeSession) => {
      try {
        await walkthroughGenerator.showWalkthrough(session.id, session.projectPath);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Failed to generate walkthrough: ${msg}`);
      }
    }),
    vscode.commands.registerCommand('claudeArtifacts.saveWalkthrough', async (session: ClaudeSession) => {
      try {
        const filePath = await walkthroughGenerator.saveWalkthrough(session.id, session.projectPath);
        if (filePath) {
          const openNow = await vscode.window.showInformationMessage(
            `Walkthrough saved to ${filePath}`,
            'Open File'
          );
          if (openNow === 'Open File') {
            const doc = await vscode.workspace.openTextDocument(filePath);
            await vscode.window.showTextDocument(doc);
          }
        } else {
          vscode.window.showWarningMessage('No walkthrough data available for this session');
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Failed to save walkthrough: ${msg}`);
      }
    })
  );

  // Worktree commands
  const worktreeService = getWorktreeService();
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeArtifacts.newWorktreeSession', async () => {
      const isGit = await worktreeService.isGitRepository();
      if (!isGit) {
        vscode.window.showErrorMessage('Not a git repository');
        return;
      }

      const branchName = await vscode.window.showInputBox({
        prompt: 'Enter branch name for new worktree',
        placeHolder: 'feature/my-feature',
        validateInput: (value) => {
          if (!value) return 'Branch name is required';
          if (value.includes(' ')) return 'Branch name cannot contain spaces';
          return null;
        }
      });

      if (!branchName) return;

      const worktree = await worktreeService.createWorktree(branchName);
      if (worktree) {
        const openNow = await vscode.window.showInformationMessage(
          `Worktree created at ${worktree.path}`,
          'Open in New Window',
          'Later'
        );

        if (openNow === 'Open in New Window') {
          await worktreeService.openWorktreeInNewWindow(worktree.path);
        }
      }
    }),

    vscode.commands.registerCommand('claudeArtifacts.listWorktrees', async () => {
      const worktrees = await worktreeService.listWorktrees();

      if (worktrees.length === 0) {
        vscode.window.showInformationMessage('No worktrees found');
        return;
      }

      const items = worktrees.map(w => ({
        label: w.branch,
        description: w.path,
        detail: w.isMain ? '(main)' : w.isLocked ? '(locked)' : '',
        worktree: w
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a worktree to open'
      });

      if (selected) {
        await worktreeService.openWorktreeInNewWindow(selected.worktree.path);
      }
    }),

    vscode.commands.registerCommand('claudeArtifacts.removeWorktree', async () => {
      const worktrees = await worktreeService.listWorktrees();
      const removable = worktrees.filter(w => !w.isMain);

      if (removable.length === 0) {
        vscode.window.showInformationMessage('No removable worktrees found');
        return;
      }

      const items = removable.map(w => ({
        label: w.branch,
        description: w.path,
        worktree: w
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a worktree to remove'
      });

      if (selected) {
        const confirm = await vscode.window.showWarningMessage(
          `Remove worktree "${selected.label}"?`,
          { modal: true },
          'Remove'
        );

        if (confirm === 'Remove') {
          await worktreeService.removeWorktree(selected.worktree.path);
        }
      }
    })
  );

  // Create status bar item for active sessions
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = 'claudeArtifacts.refreshSessions';
  context.subscriptions.push(statusBarItem);

  // Cache session service reference for efficiency
  const sessionServiceForStatusBar = getSessionService();
  let isStatusBarUpdating = false;

  // Update status bar periodically with error handling and overlap prevention
  const updateStatusBar = async () => {
    // Prevent overlapping calls
    if (isStatusBarUpdating || !statusBarItem) return;
    isStatusBarUpdating = true;

    try {
      const projects = await sessionServiceForStatusBar.getProjects();
      const activeSessions = projects.reduce((count, p) =>
        count + p.sessions.filter(s => s.status === 'active').length, 0
      );

      if (statusBarItem) {
        if (activeSessions > 0) {
          statusBarItem.text = `$(hubot) Claude: ${activeSessions} active`;
          statusBarItem.tooltip = `${activeSessions} active Claude session${activeSessions > 1 ? 's' : ''}`;
          statusBarItem.show();
        } else {
          statusBarItem.hide();
        }
      }
    } catch (error) {
      console.error('Failed to update status bar:', error);
    } finally {
      isStatusBarUpdating = false;
    }
  };

  // Initial update and periodic refresh
  updateStatusBar();
  const statusBarInterval = setInterval(updateStatusBar, 30000); // Every 30 seconds

  // Register disposables for cleanup
  context.subscriptions.push(
    artifactViewProvider,
    sessionInboxProvider,
    { dispose: () => planWatcher?.dispose() },
    { dispose: () => clearInterval(statusBarInterval) }
  );
}

export function deactivate() {
  planWatcher?.dispose();
}
