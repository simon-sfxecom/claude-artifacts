import * as cp from 'child_process';
import * as util from 'util';
import * as os from 'os';
import * as path from 'path';
import * as fsPromises from 'fs/promises';
import * as vscode from 'vscode';

const execAsync = util.promisify(cp.exec);

/**
 * Media entry stored in the index
 */
export interface MediaEntry {
  id: string;
  type: 'screenshot' | 'video';
  filePath: string;
  timestamp: number;
  eventType: 'file-modified' | 'test-run' | 'error' | 'plan-approved' | 'manual';
  metadata?: {
    fileName?: string;
    errorMessage?: string;
    testResults?: string;
  };
  comments?: MediaComment[];
}

/**
 * Comment on media (image annotation or video timestamp comment)
 */
export interface MediaComment {
  id: string;
  text: string;
  position?: { x: number; y: number }; // for image annotations
  videoTimestamp?: number; // for video comments
  createdAt: number;
}

/**
 * Media index stored per session
 */
export interface MediaIndex {
  sessionId: string;
  media: MediaEntry[];
}

/**
 * Screenshot capture tool
 */
type ScreenshotTool = 'scrot' | 'gnome-screenshot' | 'imagemagick' | 'screencapture' | 'powershell' | 'fallback';

/**
 * Media Capture Service - Handles automatic screenshot capture
 *
 * Platform support:
 * - Linux: scrot (preferred), gnome-screenshot, ImageMagick (import)
 * - macOS: screencapture (native)
 * - Windows: PowerShell + .NET
 * - Fallback: screenshot-desktop npm package
 */
export class MediaCaptureService {
  private readonly _walkthroughsDir: string;
  private _availableTool: ScreenshotTool | null = null;

  constructor() {
    this._walkthroughsDir = path.join(os.homedir(), '.claude', 'walkthroughs');
  }

  /**
   * Initialize service and detect available tools
   */
  async initialize(): Promise<void> {
    this._availableTool = await this.detectScreenshotTool();
    console.log(`Media capture initialized with tool: ${this._availableTool}`);
  }

  /**
   * Detect available screenshot tool for current platform
   */
  private async detectScreenshotTool(): Promise<ScreenshotTool> {
    const platform = os.platform();

    if (platform === 'darwin') {
      // macOS: screencapture is built-in
      return 'screencapture';
    }

    if (platform === 'win32') {
      // Windows: PowerShell is built-in
      return 'powershell';
    }

    if (platform === 'linux') {
      // Linux: try in order of preference
      const tools: ScreenshotTool[] = ['scrot', 'gnome-screenshot', 'imagemagick'];

      for (const tool of tools) {
        if (await this.isToolAvailable(tool)) {
          return tool;
        }
      }
    }

    // Fallback to npm package
    return 'fallback';
  }

  /**
   * Check if a screenshot tool is available
   */
  private async isToolAvailable(tool: ScreenshotTool): Promise<boolean> {
    try {
      switch (tool) {
        case 'scrot':
          await execAsync('which scrot');
          return true;

        case 'gnome-screenshot':
          await execAsync('which gnome-screenshot');
          return true;

        case 'imagemagick':
          await execAsync('which import');
          return true;

        default:
          return false;
      }
    } catch {
      return false;
    }
  }

  /**
   * Capture a screenshot for a session
   */
  async captureScreenshot(
    sessionId: string,
    projectPath: string,
    eventType: MediaEntry['eventType'],
    metadata?: MediaEntry['metadata']
  ): Promise<string | null> {
    try {
      // Ensure directories exist
      const sessionDir = path.join(this._walkthroughsDir, sessionId);
      const screenshotsDir = path.join(sessionDir, 'screenshots');
      await fsPromises.mkdir(screenshotsDir, { recursive: true });

      // Generate filename
      const timestamp = Date.now();
      const filename = `${timestamp}-${eventType}.png`;
      const filepath = path.join(screenshotsDir, filename);

      // Capture screenshot
      await this.captureToFile(filepath);

      // Add to media index
      await this.addToMediaIndex(sessionId, {
        id: `${timestamp}`,
        type: 'screenshot',
        filePath: filepath,
        timestamp,
        eventType,
        metadata,
        comments: []
      });

      return filepath;
    } catch (error) {
      console.error('Failed to capture screenshot:', error);
      return null;
    }
  }

  /**
   * Capture screenshot to file using detected tool
   */
  private async captureToFile(filepath: string): Promise<void> {
    if (!this._availableTool) {
      await this.initialize();
    }

    switch (this._availableTool) {
      case 'scrot':
        await execAsync(`scrot "${filepath}"`);
        break;

      case 'gnome-screenshot':
        await execAsync(`gnome-screenshot -f "${filepath}"`);
        break;

      case 'imagemagick':
        await execAsync(`import -window root "${filepath}"`);
        break;

      case 'screencapture':
        await execAsync(`screencapture -x "${filepath}"`);
        break;

      case 'powershell':
        // PowerShell screenshot command
        const psScript = `
          Add-Type -AssemblyName System.Windows.Forms
          $screen = [System.Windows.Forms.Screen]::PrimaryScreen
          $bounds = $screen.Bounds
          $bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
          $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
          $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
          $bitmap.Save('${filepath.replace(/\\/g, '\\\\')}')
          $graphics.Dispose()
          $bitmap.Dispose()
        `;
        await execAsync(`powershell -Command "${psScript}"`);
        break;

      case 'fallback':
        // Use screenshot-desktop npm package
        try {
          const screenshot = await import('screenshot-desktop');
          const imgBuffer = await screenshot.default();
          await fsPromises.writeFile(filepath, imgBuffer);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          throw new Error(`Fallback screenshot tool failed: ${msg}. Install a native tool: scrot (Linux), screencapture (macOS), or FFmpeg (Windows)`);
        }
        break;

      default:
        throw new Error('No screenshot tool available. Install: scrot/gnome-screenshot (Linux), screencapture comes with macOS, or use PowerShell (Windows)');
    }
  }

  /**
   * Get media index for a session
   */
  async getMediaIndex(sessionId: string): Promise<MediaIndex> {
    const indexPath = path.join(this._walkthroughsDir, sessionId, 'media-index.json');

    try {
      const data = await fsPromises.readFile(indexPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      // Return empty index if not found
      return {
        sessionId,
        media: []
      };
    }
  }

  /**
   * Save media index for a session
   */
  private async saveMediaIndex(sessionId: string, index: MediaIndex): Promise<void> {
    const sessionDir = path.join(this._walkthroughsDir, sessionId);
    await fsPromises.mkdir(sessionDir, { recursive: true });

    const indexPath = path.join(sessionDir, 'media-index.json');
    await fsPromises.writeFile(indexPath, JSON.stringify(index, null, 2));
  }

  /**
   * Add entry to media index
   */
  private async addToMediaIndex(sessionId: string, entry: MediaEntry): Promise<void> {
    const index = await this.getMediaIndex(sessionId);
    index.media.push(entry);
    await this.saveMediaIndex(sessionId, index);
  }

  /**
   * Add comment to media entry
   */
  async addComment(
    sessionId: string,
    mediaId: string,
    text: string,
    position?: { x: number; y: number },
    videoTimestamp?: number
  ): Promise<void> {
    const index = await this.getMediaIndex(sessionId);
    const media = index.media.find(m => m.id === mediaId);

    if (media) {
      if (!media.comments) {
        media.comments = [];
      }

      media.comments.push({
        id: `${Date.now()}`,
        text,
        position,
        videoTimestamp,
        createdAt: Date.now()
      });

      await this.saveMediaIndex(sessionId, index);
    }
  }

  /**
   * Get all screenshots for a session
   */
  async getScreenshots(sessionId: string): Promise<MediaEntry[]> {
    const index = await this.getMediaIndex(sessionId);
    return index.media.filter(m => m.type === 'screenshot');
  }

  /**
   * Delete media entry
   */
  async deleteMedia(sessionId: string, mediaId: string): Promise<void> {
    const index = await this.getMediaIndex(sessionId);
    const media = index.media.find(m => m.id === mediaId);

    if (media) {
      // Delete file
      try {
        await fsPromises.unlink(media.filePath);
      } catch (error) {
        console.error('Failed to delete media file:', error);
      }

      // Remove from index
      index.media = index.media.filter(m => m.id !== mediaId);
      await this.saveMediaIndex(sessionId, index);
    }
  }

  /**
   * Clean up old media for storage limit
   */
  async cleanupOldMedia(sessionId: string, maxCount: number = 100, maxSizeBytes: number = 500 * 1024 * 1024): Promise<void> {
    const index = await this.getMediaIndex(sessionId);

    // Sort by timestamp (oldest first)
    const sorted = [...index.media].sort((a, b) => a.timestamp - b.timestamp);

    // Calculate total size
    let totalSize = 0;
    for (const media of sorted) {
      try {
        const stats = await fsPromises.stat(media.filePath);
        totalSize += stats.size;
      } catch {
        // File doesn't exist, remove from index
        index.media = index.media.filter(m => m.id !== media.id);
      }
    }

    // Remove oldest if over limits
    let removed = 0;
    while (sorted.length > maxCount || totalSize > maxSizeBytes) {
      const oldest = sorted.shift();
      if (!oldest) break;

      try {
        const stats = await fsPromises.stat(oldest.filePath);
        await fsPromises.unlink(oldest.filePath);
        totalSize -= stats.size;
        removed++;

        // Remove from index
        index.media = index.media.filter(m => m.id !== oldest.id);
      } catch (error) {
        console.error('Failed to delete old media:', error);
      }
    }

    if (removed > 0) {
      await this.saveMediaIndex(sessionId, index);
      console.log(`Cleaned up ${removed} old media entries for session ${sessionId}`);
    }
  }
}

// Singleton instance
let mediaCaptureService: MediaCaptureService | null = null;

export function getMediaCaptureService(): MediaCaptureService {
  if (!mediaCaptureService) {
    mediaCaptureService = new MediaCaptureService();
  }
  return mediaCaptureService;
}
