import * as cp from 'child_process';
import * as util from 'util';
import * as os from 'os';
import * as path from 'path';
import * as fsPromises from 'fs/promises';
import * as vscode from 'vscode';

const execAsync = util.promisify(cp.exec);

/**
 * Recording session information
 */
interface RecordingSession {
  sessionId: string;
  projectPath: string;
  process: cp.ChildProcess;
  outputPath: string;
  startTime: number;
}

/**
 * Video Recording Service - FFmpeg-based screen recording
 *
 * Platform-specific FFmpeg commands:
 * - Linux X11: ffmpeg -f x11grab -i :0.0 output.webm
 * - Linux Wayland: ffmpeg -f kmsgrab -i - output.webm (requires root)
 * - macOS: ffmpeg -f avfoundation -i "1:0" output.webm
 * - Windows: ffmpeg -f gdigrab -i desktop output.webm
 */
export class VideoRecordingService {
  private _recordings: Map<string, RecordingSession> = new Map();
  private _statusBarItem: vscode.StatusBarItem | undefined;
  private _updateInterval: NodeJS.Timeout | undefined;
  private _ffmpegAvailable: boolean = false;

  constructor() {
    // Create status bar item
    this._statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this._statusBarItem.command = 'claudeArtifacts.stopRecording';
  }

  /**
   * Initialize and check for FFmpeg
   */
  async initialize(): Promise<boolean> {
    this._ffmpegAvailable = await this.checkFFmpegAvailable();

    if (!this._ffmpegAvailable) {
      console.warn('FFmpeg not found. Video recording will not be available.');
    } else {
      console.log('FFmpeg detected. Video recording is available.');
    }

    return this._ffmpegAvailable;
  }

  /**
   * Check if FFmpeg is available
   */
  private async checkFFmpegAvailable(): Promise<boolean> {
    try {
      await execAsync('ffmpeg -version');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Start recording for a session
   */
  async startRecording(sessionId: string, projectPath: string): Promise<boolean> {
    if (!this._ffmpegAvailable) {
      vscode.window.showErrorMessage(
        'FFmpeg is not installed. Please install FFmpeg to use video recording.',
        'Installation Guide'
      ).then(choice => {
        if (choice === 'Installation Guide') {
          vscode.env.openExternal(vscode.Uri.parse('https://ffmpeg.org/download.html'));
        }
      });
      return false;
    }

    // Check if already recording
    if (this._recordings.has(sessionId)) {
      vscode.window.showWarningMessage('Recording already in progress for this session');
      return false;
    }

    try {
      // Create output directory
      const walkthroughsDir = path.join(os.homedir(), '.claude', 'walkthroughs', sessionId, 'videos');
      await fsPromises.mkdir(walkthroughsDir, { recursive: true });

      // Generate output filename
      const timestamp = Date.now();
      const filename = `${timestamp}-session.webm`;
      const outputPath = path.join(walkthroughsDir, filename);

      // Get FFmpeg command for current platform
      const ffmpegCmd = this.getFFmpegCommand(outputPath);

      // Start FFmpeg process
      const ffmpegProcess = cp.spawn(ffmpegCmd.command, ffmpegCmd.args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      // Handle process errors
      ffmpegProcess.on('error', (error) => {
        console.error('FFmpeg process error:', error);
        vscode.window.showErrorMessage(`Recording failed: ${error.message}`);
        this._recordings.delete(sessionId);
        this.updateStatusBar();
      });

      // Store recording session
      this._recordings.set(sessionId, {
        sessionId,
        projectPath,
        process: ffmpegProcess,
        outputPath,
        startTime: timestamp
      });

      // Update status bar
      this.updateStatusBar();
      this.startStatusBarUpdates();

      vscode.window.showInformationMessage('Screen recording started');
      return true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Failed to start recording: ${msg}`);
      return false;
    }
  }

  /**
   * Stop recording for a session
   */
  async stopRecording(sessionId: string): Promise<string | null> {
    const recording = this._recordings.get(sessionId);
    if (!recording) {
      vscode.window.showWarningMessage('No recording in progress');
      return null;
    }

    try {
      // Send graceful termination signal (q for FFmpeg)
      recording.process.stdin?.write('q');

      // Wait for process to exit (with timeout)
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          recording.process.kill('SIGTERM');
          resolve();
        }, 5000);

        recording.process.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      this._recordings.delete(sessionId);
      this.updateStatusBar();

      if (this._recordings.size === 0) {
        this.stopStatusBarUpdates();
      }

      vscode.window.showInformationMessage('Recording stopped');
      return recording.outputPath;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      recording.process.kill('SIGKILL');
      this._recordings.delete(sessionId);
      this.updateStatusBar();
      return null;
    }
  }

  /**
   * Pause recording (not supported by FFmpeg, need to stop and restart)
   */
  pauseRecording(sessionId: string): void {
    vscode.window.showWarningMessage('Pause not supported. You can stop recording and start a new one.');
  }

  /**
   * Get FFmpeg command for current platform
   */
  private getFFmpegCommand(outputPath: string): { command: string; args: string[] } {
    const platform = os.platform();

    // Common output settings
    const outputArgs = [
      '-c:v', 'libvpx-vp9',  // VP9 codec
      '-crf', '28',          // Quality (0-63, lower is better)
      '-b:v', '1M',          // Bitrate
      '-y',                  // Overwrite output file
      outputPath
    ];

    if (platform === 'darwin') {
      // macOS: avfoundation
      return {
        command: 'ffmpeg',
        args: [
          '-f', 'avfoundation',
          '-i', '1:0',  // Screen 1, no audio
          '-r', '30',   // 30 fps
          ...outputArgs
        ]
      };
    }

    if (platform === 'win32') {
      // Windows: gdigrab
      return {
        command: 'ffmpeg',
        args: [
          '-f', 'gdigrab',
          '-i', 'desktop',
          '-r', '30',
          ...outputArgs
        ]
      };
    }

    // Linux: x11grab (most common)
    // Note: Wayland users may need different approach
    const display = process.env.DISPLAY || ':0.0';
    return {
      command: 'ffmpeg',
      args: [
        '-f', 'x11grab',
        '-i', display,
        '-r', '30',
        ...outputArgs
      ]
    };
  }

  /**
   * Update status bar with recording info
   */
  private updateStatusBar(): void {
    if (!this._statusBarItem) return;

    const count = this._recordings.size;

    if (count > 0) {
      // Show recording indicator
      this._statusBarItem.text = `$(record) Recording (${count})`;
      this._statusBarItem.tooltip = `${count} session${count > 1 ? 's' : ''} being recorded. Click to stop.`;
      this._statusBarItem.show();
    } else {
      this._statusBarItem.hide();
    }
  }

  /**
   * Start periodic status bar updates to show duration
   */
  private startStatusBarUpdates(): void {
    if (this._updateInterval) return;

    this._updateInterval = setInterval(() => {
      if (!this._statusBarItem) return;

      const count = this._recordings.size;
      if (count === 0) {
        this.stopStatusBarUpdates();
        return;
      }

      // Get oldest recording to show duration
      const oldest = Array.from(this._recordings.values())
        .sort((a, b) => a.startTime - b.startTime)[0];

      if (oldest) {
        const durationSec = Math.floor((Date.now() - oldest.startTime) / 1000);
        const minutes = Math.floor(durationSec / 60);
        const seconds = durationSec % 60;
        const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        this._statusBarItem.text = `$(record) Recording ${timeStr}`;
        this._statusBarItem.tooltip = `${count} session${count > 1 ? 's' : ''} being recorded. Click to stop.`;
      }
    }, 1000); // Update every second
  }

  /**
   * Stop status bar updates
   */
  private stopStatusBarUpdates(): void {
    if (this._updateInterval) {
      clearInterval(this._updateInterval);
      this._updateInterval = undefined;
    }
  }

  /**
   * Check if recording is active
   */
  isRecording(sessionId: string): boolean {
    return this._recordings.has(sessionId);
  }

  /**
   * Get all active recordings
   */
  getActiveRecordings(): RecordingSession[] {
    return Array.from(this._recordings.values());
  }

  /**
   * Stop all recordings
   */
  async stopAllRecordings(): Promise<void> {
    const sessionIds = Array.from(this._recordings.keys());
    for (const sessionId of sessionIds) {
      await this.stopRecording(sessionId);
    }
  }

  /**
   * Dispose service
   */
  dispose(): void {
    this.stopAllRecordings();
    this.stopStatusBarUpdates();

    if (this._statusBarItem) {
      this._statusBarItem.dispose();
      this._statusBarItem = undefined;
    }
  }
}

// Singleton instance
let videoRecordingService: VideoRecordingService | null = null;

export function getVideoRecordingService(): VideoRecordingService {
  if (!videoRecordingService) {
    videoRecordingService = new VideoRecordingService();
  }
  return videoRecordingService;
}

export function disposeVideoRecordingService(): void {
  if (videoRecordingService) {
    videoRecordingService.dispose();
    videoRecordingService = null;
  }
}
