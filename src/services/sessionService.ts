/**
 * Service for reading Claude Code session data from ~/.claude/
 */

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import {
  ClaudeProject,
  ClaudeSession,
  ClaudePlan,
  HistoryEntry,
  TranscriptEntry,
  SessionStatus
} from '../models/session';

export class SessionService {
  private readonly claudeDir: string;
  private historyCache: HistoryEntry[] | null = null;
  private historyCacheTime: number = 0;
  private readonly CACHE_TTL = 5000; // 5 seconds

  constructor() {
    this.claudeDir = path.join(os.homedir(), '.claude');
  }

  /**
   * Get all projects with their sessions
   */
  async getProjects(): Promise<ClaudeProject[]> {
    const projectsDir = path.join(this.claudeDir, 'projects');

    try {
      await fs.access(projectsDir);
    } catch {
      return [];
    }

    const entries = await fs.readdir(projectsDir, { withFileTypes: true });
    const projects: ClaudeProject[] = [];
    const history = await this.getHistory();

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const encodedPath = entry.name;
      // Try to find the real path from history, fall back to simple decode
      const realPath = this.findRealPath(encodedPath, history);
      const decodedPath = realPath || this.decodePath(encodedPath);
      const projectName = path.basename(decodedPath);

      const sessions = await this.getSessionsForProject(encodedPath, history, decodedPath);

      if (sessions.length === 0) continue;

      const lastActivity = Math.max(...sessions.map(s => s.lastActivity));

      projects.push({
        encodedPath,
        path: decodedPath,
        name: projectName,
        sessions,
        lastActivity
      });
    }

    // Sort by last activity (most recent first)
    return projects.sort((a, b) => b.lastActivity - a.lastActivity);
  }

  /**
   * Get sessions for a specific project
   */
  private async getSessionsForProject(
    encodedPath: string,
    history: HistoryEntry[],
    realPath: string
  ): Promise<ClaudeSession[]> {
    const projectDir = path.join(this.claudeDir, 'projects', encodedPath);

    try {
      const files = await fs.readdir(projectDir);
      const sessions: ClaudeSession[] = [];
      const decodedPath = realPath;

      // Get history entries for this project
      const projectHistory = history.filter(h => h.project === decodedPath);
      const sessionHistoryMap = new Map<string, HistoryEntry[]>();

      for (const entry of projectHistory) {
        const existing = sessionHistoryMap.get(entry.sessionId) || [];
        existing.push(entry);
        sessionHistoryMap.set(entry.sessionId, existing);
      }

      for (const file of files) {
        if (!file.endsWith('.jsonl')) continue;

        const sessionId = file.replace('.jsonl', '');
        const filePath = path.join(projectDir, file);
        const stats = await fs.stat(filePath);

        // Get history for this session
        const sessionHistory = sessionHistoryMap.get(sessionId) || [];
        const timestamps = sessionHistory.map(h => h.timestamp);

        const lastActivity = timestamps.length > 0
          ? Math.max(...timestamps)
          : stats.mtimeMs;
        const createdAt = timestamps.length > 0
          ? Math.min(...timestamps)
          : stats.birthtimeMs;

        // Get display name from most recent history entry
        const latestEntry = sessionHistory
          .sort((a, b) => b.timestamp - a.timestamp)[0];
        const displayName = latestEntry?.display || `Session ${sessionId.slice(0, 8)}`;

        // Determine status
        const status = this.determineSessionStatus(lastActivity, sessionHistory);

        sessions.push({
          id: sessionId,
          projectPath: decodedPath,
          lastActivity,
          createdAt,
          displayName,
          status,
          messageCount: sessionHistory.length
        });
      }

      // Sort by last activity (most recent first)
      return sessions.sort((a, b) => b.lastActivity - a.lastActivity);
    } catch {
      return [];
    }
  }

  /**
   * Determine session status based on activity
   */
  private determineSessionStatus(
    lastActivity: number,
    history: HistoryEntry[]
  ): SessionStatus {
    const now = Date.now();
    const hourAgo = now - (60 * 60 * 1000);
    const dayAgo = now - (24 * 60 * 60 * 1000);

    if (lastActivity > hourAgo) {
      return 'active';
    } else if (lastActivity > dayAgo) {
      return 'paused';
    } else {
      return 'completed';
    }
  }

  /**
   * Get session details including transcript
   */
  async getSessionDetails(sessionId: string, projectPath: string): Promise<TranscriptEntry[]> {
    const encodedPath = this.encodePath(projectPath);
    const sessionFile = path.join(this.claudeDir, 'projects', encodedPath, `${sessionId}.jsonl`);

    try {
      const content = await fs.readFile(sessionFile, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);

      return lines.map(line => {
        try {
          return JSON.parse(line) as TranscriptEntry;
        } catch {
          return { type: 'unknown' as const } as TranscriptEntry;
        }
      });
    } catch {
      return [];
    }
  }

  /**
   * Get all plan files
   */
  async getPlans(): Promise<ClaudePlan[]> {
    const plansDir = path.join(this.claudeDir, 'plans');

    try {
      await fs.access(plansDir);
    } catch {
      return [];
    }

    const files = await fs.readdir(plansDir);
    const plans: ClaudePlan[] = [];

    for (const file of files) {
      if (!file.endsWith('.md')) continue;

      const filePath = path.join(plansDir, file);
      const stats = await fs.stat(filePath);

      // Get preview (first 3 lines)
      let preview: string | undefined;
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n').slice(0, 5);
        preview = lines.join('\n').trim();
      } catch {
        // Ignore preview errors
      }

      plans.push({
        filename: file,
        path: filePath,
        mtime: stats.mtime,
        size: stats.size,
        preview
      });
    }

    // Sort by modification time (most recent first)
    return plans.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
  }

  /**
   * Get recent plans (last N)
   */
  async getRecentPlans(limit: number = 5): Promise<ClaudePlan[]> {
    const plans = await this.getPlans();
    return plans.slice(0, limit);
  }

  /**
   * Get history entries with caching
   */
  private async getHistory(): Promise<HistoryEntry[]> {
    const now = Date.now();

    if (this.historyCache && (now - this.historyCacheTime) < this.CACHE_TTL) {
      return this.historyCache;
    }

    const historyFile = path.join(this.claudeDir, 'history.jsonl');

    try {
      const content = await fs.readFile(historyFile, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);

      this.historyCache = lines.map(line => {
        try {
          return JSON.parse(line) as HistoryEntry;
        } catch {
          return null;
        }
      }).filter((entry): entry is HistoryEntry => entry !== null);

      this.historyCacheTime = now;
      return this.historyCache;
    } catch {
      return [];
    }
  }

  /**
   * Invalidate history cache
   */
  invalidateCache(): void {
    this.historyCache = null;
    this.historyCacheTime = 0;
  }

  /**
   * Decode path from Claude format (e.g., "-Users-simonfestl" -> "/Users/simonfestl")
   *
   * Claude encodes paths by replacing / with -. This is problematic for paths
   * containing hyphens. We try to find the most specific existing path.
   */
  private decodePath(encoded: string): string {
    if (!encoded.startsWith('-')) {
      return encoded;
    }

    // Simple case: replace all dashes with slashes
    const simpleDecode = '/' + encoded.slice(1).replace(/-/g, '/');

    // For display purposes, we use the simple decode
    // The actual path matching happens via the history.jsonl which contains real paths
    return simpleDecode;
  }

  /**
   * Encode path to Claude format (e.g., "/Users/simonfestl" -> "-Users-simonfestl")
   */
  private encodePath(decodedPath: string): string {
    return decodedPath.replace(/\//g, '-');
  }

  /**
   * Try to find the real path from history entries
   */
  private findRealPath(encodedPath: string, history: HistoryEntry[]): string | null {
    // Look for a history entry that, when encoded, matches our encoded path
    for (const entry of history) {
      if (this.encodePath(entry.project) === encodedPath) {
        return entry.project;
      }
    }
    return null;
  }

  /**
   * Get the Claude directory path
   */
  getClaudeDir(): string {
    return this.claudeDir;
  }
}

// Singleton instance
let sessionServiceInstance: SessionService | null = null;

export function getSessionService(): SessionService {
  if (!sessionServiceInstance) {
    sessionServiceInstance = new SessionService();
  }
  return sessionServiceInstance;
}
