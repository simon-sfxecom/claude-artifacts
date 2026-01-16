import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { ArtifactViewProvider } from './artifactViewProvider';
import { ArtifactPanel } from './artifactPanel';
import { SessionInboxProvider } from './views/sessionInboxProvider';
import { ClaudeSession } from './models/session';
import { getWorktreeService } from './services/worktreeService';
import { getWalkthroughGenerator } from './services/walkthroughGenerator';
import { SessionDetailPanel } from './views/sessionDetailPanel';
import { ChatViewerPanel } from './views/chatViewerPanel';
import { getSessionService } from './services/sessionService';
import { getPlanService, disposePlanService, Plan } from './services/planService';
import { registerSessionTerminal, disposeTerminalTracking } from './claudeService';

// Allowed plans directory for path validation
const PLANS_DIR = path.join(os.homedir(), '.claude', 'plans');

let currentPlan: Plan | null = null;
let statusBarItem: vscode.StatusBarItem | undefined;

/**
 * Validate session ID format to prevent shell injection
 * Claude session IDs are alphanumeric with underscores/hyphens
 * Max length 128 to prevent buffer issues
 */
function isValidSessionId(id: string): boolean {
  return id.length > 0 && id.length <= 128 && /^[a-zA-Z0-9_-]+$/.test(id);
}

/**
 * Extract ClaudeSession from command argument (handles both direct session and TreeItem)
 */
function extractSession(arg: unknown): ClaudeSession | null {
  if (!arg) return null;
  // Direct session object
  if (typeof arg === 'object' && 'id' in arg && 'projectPath' in arg) {
    return arg as ClaudeSession;
  }
  // TreeItem with data property
  if (typeof arg === 'object' && 'data' in arg) {
    const data = (arg as { data?: unknown }).data;
    if (data && typeof data === 'object' && 'id' in data && 'projectPath' in data) {
      return data as ClaudeSession;
    }
  }
  return null;
}

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

  // Create and start the plan service for Claude Code
  const planService = getPlanService((plans, activePlan) => {
    currentPlan = activePlan;

    if (activePlan) {
      console.log(`Plan update: ${activePlan.filePath}`);

      // Update the sidebar view
      artifactViewProvider.updateContent(
        activePlan.markdownContent,
        activePlan.filePath,
        activePlan.mtime
      );

      // Also update the panel if it's open
      if (ArtifactPanel.currentPanel) {
        ArtifactPanel.currentPanel.updateContent(
          activePlan.markdownContent,
          activePlan.filePath,
          activePlan.mtime
        );
      }
    } else {
      artifactViewProvider.updateContent('', '', null);
      if (ArtifactPanel.currentPanel) {
        ArtifactPanel.currentPanel.updateContent('', '', null);
      }
    }

    // Notify session inbox about plan updates
    sessionInboxProvider.refresh();
  });
  planService.start();

  // Register refresh command
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeArtifacts.refresh', () => {
      planService.refresh();
    })
  );

  // Register open plan file command
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeArtifacts.openPlanFile', async () => {
      if (currentPlan) {
        try {
          const doc = await vscode.workspace.openTextDocument(currentPlan.filePath);
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

  // Register open in tab command (opens current/active plan)
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeArtifacts.openInTab', () => {
      if (currentPlan) {
        ArtifactPanel.createOrShow(context, currentPlan.markdownContent, currentPlan.filePath, currentPlan.mtime);
      } else {
        vscode.window.showInformationMessage('No artifact to display. Run /plan in Claude Code first.');
      }
    })
  );

  // Register open specific plan command (for Split View - multiple plans)
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeArtifacts.openPlan', async (arg: unknown) => {
      // Handle plan from tree item or direct path
      let planPath: string | undefined;

      if (typeof arg === 'string') {
        planPath = arg;
      } else if (arg && typeof arg === 'object') {
        // TreeItem with data property containing ClaudePlan
        const data = (arg as { data?: { filePath?: string } }).data;
        planPath = data?.filePath;
      }

      if (!planPath) {
        vscode.window.showWarningMessage('No plan selected');
        return;
      }

      // Path traversal validation - ensure path is within allowed directory
      const normalizedPath = path.normalize(planPath);
      if (!normalizedPath.startsWith(PLANS_DIR)) {
        vscode.window.showErrorMessage('Invalid plan path: must be within ~/.claude/plans/');
        return;
      }

      // Get plan from service or load directly
      const allPlans = planService.getPlans();
      const plan = allPlans.find(p => p.filePath === planPath);

      if (plan) {
        ArtifactPanel.createOrShow(context, plan.markdownContent, plan.filePath, plan.mtime);
      } else {
        // Try to load the file directly
        try {
          const content = await vscode.workspace.fs.readFile(vscode.Uri.file(planPath));
          const text = Buffer.from(content).toString('utf-8');
          const stat = await vscode.workspace.fs.stat(vscode.Uri.file(planPath));
          ArtifactPanel.createOrShow(context, text, planPath, new Date(stat.mtime));
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          vscode.window.showErrorMessage(`Failed to open plan: ${msg}`);
        }
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
    vscode.commands.registerCommand('claudeArtifacts.resumeSession', async (arg: unknown) => {
      const session = extractSession(arg);
      if (!session) {
        vscode.window.showWarningMessage('No session selected');
        return;
      }
      if (!isValidSessionId(session.id)) {
        vscode.window.showErrorMessage('Invalid session ID format');
        return;
      }
      // Use session ID in terminal name so we can find it later
      const terminal = vscode.window.createTerminal({
        name: `Claude: ${session.id}`,
        cwd: session.projectPath
      });
      terminal.show();
      terminal.sendText(`claude --resume ${session.id}`);

      // Register terminal for this session so we can target it later
      registerSessionTerminal(session.id, terminal);
    }),
    vscode.commands.registerCommand('claudeArtifacts.showSessionDetails', (arg: unknown) => {
      const session = extractSession(arg);
      if (!session) {
        vscode.window.showWarningMessage('No session selected');
        return;
      }
      SessionDetailPanel.createOrShow(context.extensionUri, session);
    }),
    vscode.commands.registerCommand('claudeArtifacts.openChat', (arg: unknown) => {
      const session = extractSession(arg);
      if (!session) {
        vscode.window.showWarningMessage('No session selected');
        return;
      }
      ChatViewerPanel.createOrShow(session, context.extensionUri);
    }),
    vscode.commands.registerCommand('claudeArtifacts.newChat', () => {
      const workingDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      const terminal = vscode.window.createTerminal({
        name: 'Claude: New Chat',
        cwd: workingDir
      });
      terminal.show();
      terminal.sendText('claude');
    })
  );

  // Walkthrough commands
  const walkthroughGenerator = getWalkthroughGenerator();
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeArtifacts.viewWalkthrough', async (arg: unknown) => {
      const session = extractSession(arg);
      if (!session) {
        vscode.window.showWarningMessage('No session selected');
        return;
      }
      try {
        await walkthroughGenerator.showWalkthrough(session.id, session.projectPath);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Failed to generate walkthrough: ${msg}`);
      }
    }),
    vscode.commands.registerCommand('claudeArtifacts.saveWalkthrough', async (arg: unknown) => {
      const session = extractSession(arg);
      if (!session) {
        vscode.window.showWarningMessage('No session selected');
        return;
      }
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
    { dispose: () => disposePlanService() },
    { dispose: () => clearInterval(statusBarInterval) }
  );
}

export function deactivate() {
  disposePlanService();
  disposeTerminalTracking();
}
