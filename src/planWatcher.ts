import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as os from 'os';

type ContentCallback = (content: string, filePath: string, mtime: Date | null) => void;

export class PlanWatcher {
  private _watcher: vscode.FileSystemWatcher | undefined;
  private _currentFile: string = '';
  private _debounceTimer: NodeJS.Timeout | undefined;
  private _callback: ContentCallback;
  private _plansDir: string;

  constructor(callback: ContentCallback) {
    this._callback = callback;
    this._plansDir = path.join(os.homedir(), '.claude', 'plans');
  }

  public start() {
    // Watch for changes in the plans directory
    const pattern = new vscode.RelativePattern(this._plansDir, '*.md');
    this._watcher = vscode.workspace.createFileSystemWatcher(pattern);

    this._watcher.onDidChange(uri => this._onFileChange(uri));
    this._watcher.onDidCreate(uri => this._onFileChange(uri));
    this._watcher.onDidDelete(() => this._onFileDelete());

    // Load the most recent plan file on startup
    this._loadMostRecentPlan();
  }

  public refresh() {
    if (this._currentFile) {
      this._loadFile(this._currentFile);
    } else {
      this._loadMostRecentPlan();
    }
  }

  public getCurrentFile(): string | undefined {
    return this._currentFile || undefined;
  }

  public dispose() {
    this._watcher?.dispose();
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
    }
  }

  private _onFileChange(uri: vscode.Uri) {
    // Debounce rapid updates (Claude writes frequently during plan mode)
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
    }

    this._debounceTimer = setTimeout(() => {
      this._loadFile(uri.fsPath);
    }, 200);
  }

  private async _onFileDelete() {
    // If our current file was deleted, try to load another
    if (this._currentFile) {
      try {
        await fsPromises.access(this._currentFile);
      } catch {
        // File doesn't exist, load another
        this._loadMostRecentPlan();
      }
    }
  }

  private async _loadMostRecentPlan() {
    try {
      // Check if directory exists
      try {
        await fsPromises.access(this._plansDir);
      } catch {
        this._callback('', '', null);
        return;
      }

      const fileNames = await fsPromises.readdir(this._plansDir);
      const mdFiles = fileNames.filter(f => f.endsWith('.md'));

      if (mdFiles.length === 0) {
        this._currentFile = '';
        this._callback('', '', null);
        return;
      }

      // Get stats for all files in parallel
      const filesWithStats = await Promise.all(
        mdFiles.map(async (name) => {
          const filePath = path.join(this._plansDir, name);
          try {
            const stats = await fsPromises.stat(filePath);
            return { name, path: filePath, mtime: stats.mtime };
          } catch {
            return null;
          }
        })
      );

      // Filter out failed stats and sort by mtime descending
      const validFiles = filesWithStats
        .filter((f): f is NonNullable<typeof f> => f !== null)
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      if (validFiles.length > 0) {
        await this._loadFile(validFiles[0].path);
      } else {
        this._currentFile = '';
        this._callback('', '', null);
      }
    } catch (error) {
      console.error('Error loading most recent plan:', error);
      this._callback('', '', null);
    }
  }

  private async _loadFile(filePath: string) {
    try {
      const [content, stats] = await Promise.all([
        fsPromises.readFile(filePath, 'utf-8'),
        fsPromises.stat(filePath)
      ]);
      this._currentFile = filePath;
      this._callback(content, filePath, stats.mtime);
    } catch (error) {
      console.error('Error reading plan file:', error);
    }
  }
}
