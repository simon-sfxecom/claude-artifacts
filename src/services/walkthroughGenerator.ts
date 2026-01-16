/**
 * Service for generating session walkthrough/summary artifacts
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getSessionService } from './sessionService';
import { TranscriptEntry, SessionSummary, ToolCallSummary } from '../models/session';

const execAsync = promisify(exec);

export class WalkthroughGenerator {
  private sessionService = getSessionService();

  /**
   * Generate a walkthrough summary for a session
   */
  async generateWalkthrough(sessionId: string, projectPath: string): Promise<SessionSummary> {
    const entries = await this.sessionService.getSessionDetails(sessionId, projectPath);

    const toolCalls = this.analyzeToolCalls(entries);
    const filesModified = this.extractModifiedFiles(entries);
    const duration = this.calculateDuration(entries);
    const messageCount = entries.filter(e => e.type === 'user' || e.type === 'assistant').length;

    const summary: SessionSummary = {
      sessionId,
      messageCount,
      toolCalls,
      filesModified,
      duration,
      summaryText: await this.generateSummaryText(entries, toolCalls, filesModified)
    };

    return summary;
  }

  /**
   * Analyze tool calls in the session
   */
  private analyzeToolCalls(entries: TranscriptEntry[]): ToolCallSummary[] {
    const toolMap = new Map<string, { count: number; files: Set<string> }>();

    for (const entry of entries) {
      if (entry.type === 'tool_use' && entry.tool_name) {
        const existing = toolMap.get(entry.tool_name) || { count: 0, files: new Set() };
        existing.count++;

        // Extract file paths from tool input
        const input = entry.tool_input;
        if (input) {
          if (typeof input.file_path === 'string') {
            existing.files.add(input.file_path);
          }
          if (typeof input.path === 'string') {
            existing.files.add(input.path);
          }
        }

        toolMap.set(entry.tool_name, existing);
      }
    }

    return Array.from(toolMap.entries()).map(([tool, data]) => ({
      tool,
      count: data.count,
      files: data.files.size > 0 ? Array.from(data.files) : undefined
    })).sort((a, b) => b.count - a.count);
  }

  /**
   * Extract modified files from tool calls
   */
  private extractModifiedFiles(entries: TranscriptEntry[]): string[] {
    const files = new Set<string>();
    const writeTools = ['Write', 'Edit', 'NotebookEdit'];

    for (const entry of entries) {
      if (entry.type === 'tool_use' && entry.tool_name && writeTools.includes(entry.tool_name)) {
        const input = entry.tool_input;
        if (input) {
          if (typeof input.file_path === 'string') {
            files.add(input.file_path);
          }
          if (typeof input.path === 'string') {
            files.add(input.path);
          }
        }
      }
    }

    return Array.from(files);
  }

  /**
   * Calculate session duration from timestamps
   */
  private calculateDuration(entries: TranscriptEntry[]): number {
    const timestamps = entries
      .filter(e => e.timestamp)
      .map(e => new Date(e.timestamp!).getTime())
      .filter(t => !isNaN(t));

    if (timestamps.length < 2) return 0;

    return Math.max(...timestamps) - Math.min(...timestamps);
  }

  /**
   * Generate human-readable summary text
   */
  private async generateSummaryText(
    entries: TranscriptEntry[],
    toolCalls: ToolCallSummary[],
    filesModified: string[]
  ): Promise<string> {
    const lines: string[] = [];

    // Header
    lines.push('# Session Summary\n');

    // Overview
    const userMessages = entries.filter(e => e.type === 'user').length;
    const assistantMessages = entries.filter(e => e.type === 'assistant').length;
    const totalToolCalls = toolCalls.reduce((sum, t) => sum + t.count, 0);

    lines.push('## Overview\n');
    lines.push(`- **User messages:** ${userMessages}`);
    lines.push(`- **Assistant responses:** ${assistantMessages}`);
    lines.push(`- **Tool calls:** ${totalToolCalls}`);
    lines.push(`- **Files modified:** ${filesModified.length}`);
    lines.push('');

    // Tool Usage
    if (toolCalls.length > 0) {
      lines.push('## Tool Usage\n');
      lines.push('| Tool | Count |');
      lines.push('|------|-------|');
      for (const tc of toolCalls.slice(0, 10)) {
        lines.push(`| ${tc.tool} | ${tc.count} |`);
      }
      lines.push('');
    }

    // Modified Files
    if (filesModified.length > 0) {
      lines.push('## Modified Files\n');
      for (const file of filesModified.slice(0, 20)) {
        const basename = path.basename(file);
        lines.push(`- \`${basename}\``);
      }
      if (filesModified.length > 20) {
        lines.push(`- *...and ${filesModified.length - 20} more*`);
      }
      lines.push('');
    }

    // Try to get git diff summary
    const diffSummary = await this.getGitDiffSummary();
    if (diffSummary) {
      lines.push('## Git Changes\n');
      lines.push('```');
      lines.push(diffSummary);
      lines.push('```');
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Get a summary of git changes
   */
  private async getGitDiffSummary(): Promise<string | null> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) return null;

    try {
      const { stdout } = await execAsync('git diff --stat HEAD~1..HEAD 2>/dev/null || git diff --stat', {
        cwd: workspaceRoot,
        timeout: 5000
      });
      return stdout.trim() || null;
    } catch {
      return null;
    }
  }

  /**
   * Show walkthrough in a new editor
   */
  async showWalkthrough(sessionId: string, projectPath: string): Promise<void> {
    const summary = await this.generateWalkthrough(sessionId, projectPath);

    if (!summary.summaryText) {
      vscode.window.showInformationMessage('No summary available for this session');
      return;
    }

    // Create a virtual document
    const doc = await vscode.workspace.openTextDocument({
      content: summary.summaryText,
      language: 'markdown'
    });

    await vscode.window.showTextDocument(doc, { preview: true });

    // Optionally show markdown preview
    await vscode.commands.executeCommand('markdown.showPreview');
  }

  /**
   * Save walkthrough to a file
   */
  async saveWalkthrough(sessionId: string, projectPath: string): Promise<string | null> {
    const summary = await this.generateWalkthrough(sessionId, projectPath);

    if (!summary.summaryText) {
      return null;
    }

    const claudeDir = this.sessionService.getClaudeDir();
    const walkthroughsDir = path.join(claudeDir, 'walkthroughs');

    try {
      await fs.mkdir(walkthroughsDir, { recursive: true });

      const filename = `walkthrough-${sessionId.slice(0, 8)}-${Date.now()}.md`;
      const filePath = path.join(walkthroughsDir, filename);

      await fs.writeFile(filePath, summary.summaryText, 'utf-8');

      return filePath;
    } catch (error) {
      console.error('Failed to save walkthrough:', error);
      return null;
    }
  }
}

// Singleton instance
let walkthroughGeneratorInstance: WalkthroughGenerator | null = null;

export function getWalkthroughGenerator(): WalkthroughGenerator {
  if (!walkthroughGeneratorInstance) {
    walkthroughGeneratorInstance = new WalkthroughGenerator();
  }
  return walkthroughGeneratorInstance;
}
