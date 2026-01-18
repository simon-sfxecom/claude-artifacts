import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { ClaudeSession } from '../models/session';

/**
 * Service for generating preview thumbnails and summaries for sessions
 */
export class ThumbnailGenerator {
  private readonly claudeDir: string;

  constructor() {
    this.claudeDir = path.join(os.homedir(), '.claude');
  }

  /**
   * Generate preview from plan file
   */
  async generatePlanThumbnail(planPath: string): Promise<string> {
    try {
      const content = await fs.readFile(planPath, 'utf-8');
      // Take first 200 characters of plan
      const preview = content.substring(0, 200).trim();
      // Remove markdown headers and formatting
      const cleaned = preview
        .replace(/^#+\s*/gm, '')
        .replace(/\*\*/g, '')
        .replace(/\n+/g, ' ');
      return this.truncate(cleaned, 150);
    } catch (error) {
      return '';
    }
  }

  /**
   * Generate preview from last message
   */
  generateMessagePreview(message: string, maxLength: number = 80): string {
    if (!message) return '';
    // Clean up the message
    const cleaned = message
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return this.truncate(cleaned, maxLength);
  }

  /**
   * Generate activity summary for a session
   */
  async generateActivitySummary(session: ClaudeSession): Promise<string> {
    if (session.waitingTool) {
      return `Waiting for ${session.waitingTool}`;
    }

    if (session.status === 'active') {
      // Try to get current activity from transcript
      const activity = await this.getCurrentActivity(session);
      if (activity) {
        return activity;
      }
      return 'Active';
    }

    if (session.status === 'paused') {
      return 'Paused';
    }

    return 'Completed';
  }

  /**
   * Get current activity from session transcript
   */
  private async getCurrentActivity(session: ClaudeSession): Promise<string | null> {
    try {
      const sessionFile = this.getSessionFilePath(session);
      const content = await fs.readFile(sessionFile, 'utf-8');
      const lines = content.trim().split('\n');

      // Get last few entries
      const recentEntries = lines.slice(-5)
        .map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(entry => entry !== null);

      // Find most recent tool use
      for (let i = recentEntries.length - 1; i >= 0; i--) {
        const entry = recentEntries[i];
        if (entry.type === 'tool_use') {
          const toolName = entry.tool_name || entry.name;
          const input = entry.tool_input || entry.input;

          if (toolName === 'Edit' || toolName === 'Write') {
            const fileName = input?.file_path ? path.basename(input.file_path) : 'file';
            return `Editing ${fileName}`;
          }

          if (toolName === 'Read') {
            const fileName = input?.file_path ? path.basename(input.file_path) : 'file';
            return `Reading ${fileName}`;
          }

          if (toolName === 'Bash') {
            const cmd = input?.command || '';
            if (cmd.includes('test') || cmd.includes('pytest') || cmd.includes('jest')) {
              return 'Running tests...';
            }
            if (cmd.includes('npm') || cmd.includes('yarn')) {
              return 'Running npm command...';
            }
            if (cmd.includes('git')) {
              return 'Running git command...';
            }
            return 'Executing command...';
          }

          if (toolName === 'Grep' || toolName === 'Glob') {
            return 'Searching files...';
          }

          if (toolName === 'ExitPlanMode') {
            return 'Waiting for plan approval';
          }

          if (toolName === 'AskUserQuestion') {
            return 'Waiting for user input';
          }

          return `Running ${toolName}...`;
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get path to session file
   */
  private getSessionFilePath(session: ClaudeSession): string {
    const encoded = this.encodePath(session.projectPath);
    return path.join(this.claudeDir, 'projects', encoded, `${session.id}.jsonl`);
  }

  /**
   * Encode project path (same as SessionService)
   */
  private encodePath(projectPath: string): string {
    return projectPath.replace(/\//g, '-').replace(/^-/, '');
  }

  /**
   * Truncate text intelligently at word boundaries
   */
  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }

    // Find last space before maxLength
    const truncated = text.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');

    if (lastSpace > maxLength * 0.8) {
      return truncated.substring(0, lastSpace) + '...';
    }

    return truncated + '...';
  }
}

// Singleton instance
let thumbnailGenerator: ThumbnailGenerator | null = null;

export function getThumbnailGenerator(): ThumbnailGenerator {
  if (!thumbnailGenerator) {
    thumbnailGenerator = new ThumbnailGenerator();
  }
  return thumbnailGenerator;
}
