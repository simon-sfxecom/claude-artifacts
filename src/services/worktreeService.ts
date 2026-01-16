/**
 * Service for managing Git worktrees
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import { Worktree } from '../models/session';

const execFileAsync = promisify(execFile);

/**
 * Validate branch name to prevent command injection
 * Git branch names cannot contain: space, ~, ^, :, ?, *, [, \, control chars
 */
function isValidBranchName(name: string): boolean {
  if (!name || name.length === 0 || name.length > 255) return false;
  // Disallow dangerous characters and patterns
  const invalidPatterns = [
    /\s/,           // whitespace
    /\.\./,         // double dots
    /^\./,          // starts with dot
    /\/\./,         // contains /.
    /\.lock$/,      // ends with .lock
    /@\{/,          // @{ sequence
    /[\x00-\x1f\x7f]/, // control characters
    /[~^:?*\[\]\\]/, // special git chars
  ];
  return !invalidPatterns.some(pattern => pattern.test(name));
}

/**
 * Validate file path to prevent path traversal
 */
function isValidPath(filePath: string): boolean {
  if (!filePath) return false;
  // Normalize and check for traversal attempts
  const normalized = path.normalize(filePath);
  return !normalized.includes('..') && path.isAbsolute(normalized);
}

export class WorktreeService {
  private workspaceRoot: string | undefined;

  constructor() {
    this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  }

  /**
   * Get the worktrees directory path (../worktrees/ relative to workspace)
   */
  getWorktreesDir(): string | undefined {
    if (!this.workspaceRoot) return undefined;
    return path.join(path.dirname(this.workspaceRoot), 'worktrees');
  }

  /**
   * List all worktrees for the current repository
   */
  async listWorktrees(): Promise<Worktree[]> {
    if (!this.workspaceRoot) return [];

    try {
      const { stdout } = await execFileAsync('git', ['worktree', 'list', '--porcelain'], {
        cwd: this.workspaceRoot
      });

      return this.parseWorktreeOutput(stdout);
    } catch (error) {
      console.error('Failed to list worktrees:', error);
      return [];
    }
  }

  /**
   * Parse git worktree list --porcelain output
   */
  private parseWorktreeOutput(output: string): Worktree[] {
    const worktrees: Worktree[] = [];
    const blocks = output.trim().split('\n\n');

    for (const block of blocks) {
      const lines = block.split('\n');
      const worktree: Partial<Worktree> = {};

      for (const line of lines) {
        if (line.startsWith('worktree ')) {
          worktree.path = line.slice(9);
        } else if (line.startsWith('HEAD ')) {
          worktree.head = line.slice(5);
        } else if (line.startsWith('branch ')) {
          worktree.branch = line.slice(7).replace('refs/heads/', '');
        } else if (line === 'bare') {
          worktree.isMain = true;
        } else if (line === 'locked') {
          worktree.isLocked = true;
        } else if (line.startsWith('locked ')) {
          worktree.isLocked = true;
          worktree.lockReason = line.slice(7);
        }
      }

      if (worktree.path && worktree.head) {
        worktrees.push({
          path: worktree.path,
          branch: worktree.branch || 'detached',
          head: worktree.head,
          isMain: worktree.isMain || false,
          isLocked: worktree.isLocked || false,
          lockReason: worktree.lockReason
        });
      }
    }

    return worktrees;
  }

  /**
   * Create a new worktree
   */
  async createWorktree(branchName: string, baseBranch?: string): Promise<Worktree | null> {
    if (!this.workspaceRoot) {
      vscode.window.showErrorMessage('No workspace folder open');
      return null;
    }

    // Validate branch name to prevent injection
    if (!isValidBranchName(branchName)) {
      vscode.window.showErrorMessage('Invalid branch name');
      return null;
    }

    if (baseBranch && !isValidBranchName(baseBranch)) {
      vscode.window.showErrorMessage('Invalid base branch name');
      return null;
    }

    const worktreesDir = this.getWorktreesDir();
    if (!worktreesDir) return null;

    const worktreePath = path.join(worktreesDir, branchName);

    try {
      // Ensure worktrees directory exists using fs instead of shell
      await fs.mkdir(worktreesDir, { recursive: true });

      // Create new branch and worktree using execFile (safe from injection)
      const baseRef = baseBranch || 'HEAD';
      await execFileAsync('git', ['worktree', 'add', '-b', branchName, worktreePath, baseRef], {
        cwd: this.workspaceRoot
      });

      vscode.window.showInformationMessage(`Created worktree: ${branchName}`);

      return {
        path: worktreePath,
        branch: branchName,
        head: '', // Will be populated on next list
        isMain: false,
        isLocked: false
      };
    } catch (error) {
      // Try without -b if branch already exists
      try {
        await execFileAsync('git', ['worktree', 'add', worktreePath, branchName], {
          cwd: this.workspaceRoot
        });

        vscode.window.showInformationMessage(`Created worktree for existing branch: ${branchName}`);

        return {
          path: worktreePath,
          branch: branchName,
          head: '',
          isMain: false,
          isLocked: false
        };
      } catch (innerError) {
        const msg = innerError instanceof Error ? innerError.message : String(innerError);
        vscode.window.showErrorMessage(`Failed to create worktree: ${msg}`);
        return null;
      }
    }
  }

  /**
   * Remove a worktree
   */
  async removeWorktree(worktreePath: string, force: boolean = false): Promise<boolean> {
    if (!this.workspaceRoot) return false;

    // Validate path
    if (!isValidPath(worktreePath)) {
      vscode.window.showErrorMessage('Invalid worktree path');
      return false;
    }

    try {
      const args = force ? ['worktree', 'remove', '--force', worktreePath] : ['worktree', 'remove', worktreePath];
      await execFileAsync('git', args, { cwd: this.workspaceRoot });

      vscode.window.showInformationMessage(`Removed worktree: ${path.basename(worktreePath)}`);
      return true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Failed to remove worktree: ${msg}`);
      return false;
    }
  }

  /**
   * Open a worktree in a new VS Code window
   */
  async openWorktreeInNewWindow(worktreePath: string): Promise<void> {
    const uri = vscode.Uri.file(worktreePath);
    await vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: true });
  }

  /**
   * Lock a worktree to prevent pruning
   */
  async lockWorktree(worktreePath: string, reason?: string): Promise<boolean> {
    if (!this.workspaceRoot) return false;

    // Validate path
    if (!isValidPath(worktreePath)) {
      return false;
    }

    try {
      const args = reason
        ? ['worktree', 'lock', '--reason', reason, worktreePath]
        : ['worktree', 'lock', worktreePath];
      await execFileAsync('git', args, { cwd: this.workspaceRoot });
      return true;
    } catch (error) {
      console.error('Failed to lock worktree:', error);
      return false;
    }
  }

  /**
   * Unlock a worktree
   */
  async unlockWorktree(worktreePath: string): Promise<boolean> {
    if (!this.workspaceRoot) return false;

    // Validate path
    if (!isValidPath(worktreePath)) {
      return false;
    }

    try {
      await execFileAsync('git', ['worktree', 'unlock', worktreePath], {
        cwd: this.workspaceRoot
      });
      return true;
    } catch (error) {
      console.error('Failed to unlock worktree:', error);
      return false;
    }
  }

  /**
   * Prune stale worktree entries
   */
  async pruneWorktrees(): Promise<boolean> {
    if (!this.workspaceRoot) return false;

    try {
      await execFileAsync('git', ['worktree', 'prune'], { cwd: this.workspaceRoot });
      return true;
    } catch (error) {
      console.error('Failed to prune worktrees:', error);
      return false;
    }
  }

  /**
   * Get available branches for worktree creation
   */
  async getBranches(): Promise<string[]> {
    if (!this.workspaceRoot) return [];

    try {
      const { stdout } = await execFileAsync(
        'git',
        ['branch', '-a', '--format=%(refname:short)'],
        { cwd: this.workspaceRoot }
      );

      return stdout.trim().split('\n').filter(Boolean);
    } catch (error) {
      console.error('Failed to get branches:', error);
      return [];
    }
  }

  /**
   * Check if we're in a git repository
   */
  async isGitRepository(): Promise<boolean> {
    if (!this.workspaceRoot) return false;

    try {
      await execFileAsync('git', ['rev-parse', '--git-dir'], { cwd: this.workspaceRoot });
      return true;
    } catch {
      return false;
    }
  }
}

// Singleton instance
let worktreeServiceInstance: WorktreeService | null = null;

export function getWorktreeService(): WorktreeService {
  if (!worktreeServiceInstance) {
    worktreeServiceInstance = new WorktreeService();
  }
  return worktreeServiceInstance;
}
