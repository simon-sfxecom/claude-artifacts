import * as vscode from 'vscode';
import * as path from 'path';
import * as fsPromises from 'fs/promises';
import * as os from 'os';
import * as crypto from 'crypto';
import { getMediaCaptureService, MediaEntry } from './mediaCaptureService';
import { getSessionService } from './sessionService';

/**
 * Session Monitor - Watches for transcript changes and triggers automatic screenshots
 *
 * Capture triggers:
 * - File modifications (Edit, Write tools)
 * - Test execution (Bash tool with test keywords)
 * - Errors (tool_result with error status)
 * - Plan approval (ExitPlanMode tool)
 * - Manual capture command
 */
/**
 * File state tracking for integrity checking
 */
interface FileState {
  size: number;
  hash: string;
  mtime: number;
}

export class SessionMonitor {
  private _watchers: Map<string, vscode.FileSystemWatcher> = new Map();
  private _lastProcessedState: Map<string, FileState> = new Map();
  private _disposables: vscode.Disposable[] = [];

  constructor() {}

  /**
   * Start monitoring a session
   */
  startMonitoring(sessionId: string, projectPath: string): void {
    const transcriptPath = path.join(os.homedir(), '.claude', 'projects', projectPath, 'sessions', `${sessionId}.jsonl`);

    // Check if already monitoring
    if (this._watchers.has(sessionId)) {
      return;
    }

    try {
      // Watch transcript file
      const pattern = new vscode.RelativePattern(path.dirname(transcriptPath), path.basename(transcriptPath));
      const watcher = vscode.workspace.createFileSystemWatcher(pattern);

      watcher.onDidChange(async () => {
        await this.processTranscriptUpdate(sessionId, projectPath, transcriptPath);
      });

      this._watchers.set(sessionId, watcher);
      this._disposables.push(watcher);

      console.log(`Started monitoring session: ${sessionId}`);
    } catch (error) {
      console.error(`Failed to start monitoring session ${sessionId}:`, error);
    }
  }

  /**
   * Stop monitoring a session
   */
  stopMonitoring(sessionId: string): void {
    const watcher = this._watchers.get(sessionId);
    if (watcher) {
      watcher.dispose();
      this._watchers.delete(sessionId);
      this._lastProcessedState.delete(sessionId);
      console.log(`Stopped monitoring session: ${sessionId}`);
    }
  }

  /**
   * Stop monitoring all sessions
   */
  stopAllMonitoring(): void {
    const sessionIds = Array.from(this._watchers.keys());
    sessionIds.forEach(id => this.stopMonitoring(id));

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  /**
   * Process transcript update and detect capture-worthy events
   */
  private async processTranscriptUpdate(sessionId: string, projectPath: string, transcriptPath: string): Promise<void> {
    try {
      // Read transcript file and stats
      const [content, stats] = await Promise.all([
        fsPromises.readFile(transcriptPath, 'utf-8'),
        fsPromises.stat(transcriptPath)
      ]);

      // Calculate hash of content for integrity check
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      const currentState: FileState = {
        size: stats.size,
        hash,
        mtime: stats.mtimeMs
      };

      // Get last processed state
      const lastState = this._lastProcessedState.get(sessionId);

      // Check for file truncation or rotation
      if (lastState && currentState.size < lastState.size) {
        console.warn(`Transcript file was truncated for session ${sessionId}, resetting state`);
        this._lastProcessedState.delete(sessionId);
        return;
      }

      // Check if file changed (hash different)
      if (lastState && currentState.hash === lastState.hash) {
        // No changes, skip processing
        return;
      }

      const lines = content.trim().split('\n').filter(l => l.trim());
      const lastSize = lastState ? Math.floor(lastState.size / 100) : 0; // Rough line estimate

      // Only process new lines
      const startIndex = Math.max(0, Math.min(lastSize, lines.length - 1));
      const newLines = lines.slice(startIndex);

      // Update state
      this._lastProcessedState.set(sessionId, currentState);

      // Parse and analyze new entries
      for (const line of newLines) {
        try {
          const entry = JSON.parse(line);
          await this.analyzeTranscriptEntry(sessionId, projectPath, entry);
        } catch (error) {
          console.error('Failed to parse transcript line:', error);
        }
      }
    } catch (error) {
      console.error(`Failed to process transcript for ${sessionId}:`, error);
    }
  }

  /**
   * Analyze a transcript entry and trigger screenshots if needed
   */
  private async analyzeTranscriptEntry(sessionId: string, projectPath: string, entry: any): Promise<void> {
    const mediaCaptureService = getMediaCaptureService();

    // Detect file modifications (Edit, Write tools)
    if (entry.type === 'tool_use') {
      const toolName = entry.name;
      const params = entry.input || {};

      if (toolName === 'Edit' || toolName === 'Write') {
        const fileName = params.file_path ? path.basename(params.file_path) : 'unknown';
        await mediaCaptureService.captureScreenshot(sessionId, projectPath, 'file-modified', {
          fileName
        });
        console.log(`Captured screenshot for file modification: ${fileName}`);
      }

      if (toolName === 'ExitPlanMode') {
        await mediaCaptureService.captureScreenshot(sessionId, projectPath, 'plan-approved');
        console.log('Captured screenshot for plan approval');
      }
    }

    // Detect test execution (Bash tool with test keywords)
    if (entry.type === 'tool_use' && entry.name === 'Bash') {
      const command = entry.input?.command || '';
      const testKeywords = ['test', 'npm test', 'jest', 'mocha', 'pytest', 'go test', 'cargo test', 'mvn test'];

      if (testKeywords.some(keyword => command.includes(keyword))) {
        await mediaCaptureService.captureScreenshot(sessionId, projectPath, 'test-run', {
          testResults: 'Test execution detected'
        });
        console.log('Captured screenshot for test execution');
      }
    }

    // Detect errors (tool_result with error status)
    if (entry.type === 'tool_result') {
      const isError = entry.is_error || false;
      const content = entry.content || '';

      if (isError || content.toLowerCase().includes('error')) {
        const errorMessage = typeof content === 'string' ? content.substring(0, 200) : 'Error detected';
        await mediaCaptureService.captureScreenshot(sessionId, projectPath, 'error', {
          errorMessage
        });
        console.log('Captured screenshot for error');
      }
    }
  }

  /**
   * Manual capture screenshot
   */
  async manualCapture(sessionId: string, projectPath: string): Promise<void> {
    const mediaCaptureService = getMediaCaptureService();
    await mediaCaptureService.captureScreenshot(sessionId, projectPath, 'manual');
    vscode.window.showInformationMessage('Screenshot captured');
  }

  /**
   * Auto-monitor all active sessions
   */
  async autoMonitorActiveSessions(): Promise<void> {
    const sessionService = getSessionService();
    const projects = await sessionService.getProjects();

    for (const project of projects) {
      for (const session of project.sessions) {
        if (session.status === 'active') {
          this.startMonitoring(session.id, session.projectPath);
        }
      }
    }
  }
}

// Singleton instance
let sessionMonitor: SessionMonitor | null = null;

export function getSessionMonitor(): SessionMonitor {
  if (!sessionMonitor) {
    sessionMonitor = new SessionMonitor();
  }
  return sessionMonitor;
}

export function disposeSessionMonitor(): void {
  if (sessionMonitor) {
    sessionMonitor.stopAllMonitoring();
    sessionMonitor = null;
  }
}
