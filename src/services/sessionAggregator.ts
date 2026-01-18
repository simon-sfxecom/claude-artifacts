import { getSessionService } from './sessionService';
import { getThumbnailGenerator } from './thumbnailGenerator';
import { getWalkthroughGenerator } from './walkthroughGenerator';
import {
  SessionCard,
  SessionPreview,
  SessionStats,
  SessionAction,
  VisualState,
  StatusBadge,
  FilterState,
  SortBy
} from '../models/missionControl';
import { ClaudeSession } from '../models/session';

/**
 * Service for aggregating and enriching session data for Mission Control
 */
export class SessionAggregator {
  private cache: Map<string, SessionCard> = new Map();
  private cacheTime: Map<string, number> = new Map();
  private readonly CACHE_TTL = 5000; // 5 seconds

  /**
   * Get all session cards with optional filtering and sorting
   */
  async getSessionCards(filter?: FilterState, sortBy?: SortBy): Promise<SessionCard[]> {
    const sessionService = getSessionService();
    const projects = await sessionService.getProjects();

    const cards: SessionCard[] = [];

    for (const project of projects) {
      for (const session of project.sessions) {
        const card = await this.getSessionCard(session);
        cards.push(card);
      }
    }

    // Apply filters
    let filtered = cards;
    if (filter) {
      filtered = this.applyFilters(cards, filter);
    }

    // Apply sorting
    if (sortBy) {
      filtered = this.sortCards(filtered, sortBy);
    } else {
      // Default sort by activity
      filtered = this.sortCards(filtered, 'activity');
    }

    return filtered;
  }

  /**
   * Get enriched session card for a specific session
   */
  async getSessionCard(session: ClaudeSession): Promise<SessionCard> {
    const cacheKey = `${session.projectPath}:${session.id}`;

    // Check cache
    const cached = this.cache.get(cacheKey);
    const cacheTime = this.cacheTime.get(cacheKey) || 0;

    if (cached && Date.now() - cacheTime < this.CACHE_TTL) {
      return cached;
    }

    // Build new card
    const [preview, stats, actions, visualState] = await Promise.all([
      this.buildPreview(session),
      this.buildStats(session),
      this.buildActions(session),
      this.buildVisualState(session)
    ]);

    const card: SessionCard = {
      session,
      preview,
      stats,
      actions,
      visualState
    };

    // Cache it
    this.cache.set(cacheKey, card);
    this.cacheTime.set(cacheKey, Date.now());

    return card;
  }

  /**
   * Build preview data for session
   */
  private async buildPreview(session: ClaudeSession): Promise<SessionPreview> {
    const thumbnailGen = getThumbnailGenerator();

    const currentActivity = await thumbnailGen.generateActivitySummary(session);

    // Try to get last message from session
    let lastMessage = '';
    try {
      const sessionService = getSessionService();
      const transcript = await sessionService.getSessionDetails(session.id, session.projectPath);
      if (transcript.length > 0) {
        // Find last assistant message
        for (let i = transcript.length - 1; i >= 0; i--) {
          const entry = transcript[i];
          if (entry.type === 'assistant' && entry.content) {
            lastMessage = thumbnailGen.generateMessagePreview(entry.content);
            break;
          }
        }
      }
    } catch (error) {
      // Ignore errors
    }

    return {
      currentActivity,
      lastMessage
    };
  }

  /**
   * Build statistics for session
   */
  private async buildStats(session: ClaudeSession): Promise<SessionStats> {
    const walkthroughGen = getWalkthroughGenerator();

    try {
      const summary = await walkthroughGen.generateWalkthrough(session.id, session.projectPath);

      return {
        messageCount: summary.messageCount,
        toolCalls: summary.toolCalls.reduce((sum: number, tool: any) => sum + tool.count, 0),
        filesModified: summary.filesModified.length,
        duration: summary.duration,
        startTime: session.createdAt || Date.now(),
        lastActivity: session.lastActivity
      };
    } catch (error) {
      // Fallback stats
      return {
        messageCount: session.messageCount || 0,
        toolCalls: 0,
        filesModified: 0,
        duration: Date.now() - (session.createdAt || Date.now()),
        startTime: session.createdAt || Date.now(),
        lastActivity: session.lastActivity
      };
    }
  }

  /**
   * Build action buttons for session
   */
  private buildActions(session: ClaudeSession): SessionAction[] {
    const actions: SessionAction[] = [];

    // Resume action (always available)
    actions.push({
      id: 'resume',
      label: 'Resume',
      icon: 'debug-start',
      enabled: true,
      handler: 'claudeArtifacts.resumeSession'
    });

    // View details action
    actions.push({
      id: 'view',
      label: 'View',
      icon: 'eye',
      enabled: true,
      handler: 'claudeArtifacts.showSessionDetails'
    });

    // Summary action
    actions.push({
      id: 'summary',
      label: 'Summary',
      icon: 'book',
      enabled: true,
      handler: 'claudeArtifacts.viewWalkthrough'
    });

    // Approve action (only if waiting for approval)
    if (session.inputRequired || session.waitingTool === 'ExitPlanMode') {
      actions.push({
        id: 'approve',
        label: 'Approve',
        icon: 'check',
        enabled: true,
        handler: 'claudeArtifacts.approve'
      });
    }

    return actions;
  }

  /**
   * Build visual state for session card
   */
  private buildVisualState(session: ClaudeSession): VisualState {
    const badge = this.buildStatusBadge(session);

    return {
      badge,
      highlight: session.inputRequired ? 'attention' : undefined
    };
  }

  /**
   * Build status badge
   */
  private buildStatusBadge(session: ClaudeSession): StatusBadge {
    if (session.inputRequired || session.waitingTool === 'AskUserQuestion') {
      return {
        text: 'Input Required',
        color: 'var(--vscode-charts-yellow)',
        icon: '⚠️',
        pulse: true
      };
    }

    if (session.status === 'active') {
      return {
        text: 'Active',
        color: 'var(--vscode-charts-blue)',
        icon: '🔵',
        pulse: true
      };
    }

    if (session.status === 'paused') {
      return {
        text: 'Paused',
        color: 'var(--vscode-charts-orange)',
        icon: '⏸️',
        pulse: false
      };
    }

    return {
      text: 'Completed',
      color: 'var(--vscode-charts-green)',
      icon: '✅',
      pulse: false
    };
  }

  /**
   * Apply filters to session cards
   */
  private applyFilters(cards: SessionCard[], filter: FilterState): SessionCard[] {
    let filtered = cards;

    // Filter by status
    if (filter.status && filter.status.length > 0) {
      filtered = filtered.filter(card => {
        const status = card.session.status;
        // Only match valid statuses
        if (status === 'active' || status === 'paused' || status === 'completed') {
          return filter.status.includes(status);
        }
        return false;
      });
    }

    // Filter by project
    if (filter.projects && filter.projects.length > 0) {
      filtered = filtered.filter(card =>
        filter.projects.includes(card.session.projectPath)
      );
    }

    // Filter by search
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      filtered = filtered.filter(card => {
        const sessionName = (card.session.displayName || card.session.id).toLowerCase();
        const projectPath = card.session.projectPath.toLowerCase();
        const lastMessage = (card.preview.lastMessage || '').toLowerCase();
        const activity = (card.preview.currentActivity || '').toLowerCase();

        return sessionName.includes(searchLower) ||
               projectPath.includes(searchLower) ||
               lastMessage.includes(searchLower) ||
               activity.includes(searchLower);
      });
    }

    // Filter by date range
    if (filter.dateRange) {
      const fromTime = filter.dateRange.from.getTime();
      const toTime = filter.dateRange.to.getTime();

      filtered = filtered.filter(card =>
        card.session.lastActivity >= fromTime &&
        card.session.lastActivity <= toTime
      );
    }

    return filtered;
  }

  /**
   * Sort session cards
   */
  private sortCards(cards: SessionCard[], sortBy: SortBy): SessionCard[] {
    const sorted = [...cards];

    switch (sortBy) {
      case 'activity':
        sorted.sort((a, b) => b.session.lastActivity - a.session.lastActivity);
        break;

      case 'created':
        sorted.sort((a, b) => (b.session.createdAt || 0) - (a.session.createdAt || 0));
        break;

      case 'name':
        sorted.sort((a, b) => {
          const aName = a.session.displayName || a.session.id;
          const bName = b.session.displayName || b.session.id;
          return aName.localeCompare(bName);
        });
        break;

      case 'status':
        const statusOrder: Record<string, number> = { active: 0, paused: 1, completed: 2, unknown: 3 };
        sorted.sort((a, b) => {
          const aOrder = statusOrder[a.session.status] ?? 3;
          const bOrder = statusOrder[b.session.status] ?? 3;
          return aOrder - bOrder;
        });
        break;

      case 'project':
        sorted.sort((a, b) =>
          a.session.projectPath.localeCompare(b.session.projectPath)
        );
        break;
    }

    return sorted;
  }

  /**
   * Invalidate cache for specific session or all
   */
  invalidate(sessionId?: string, projectPath?: string): void {
    if (sessionId && projectPath) {
      const cacheKey = `${projectPath}:${sessionId}`;
      this.cache.delete(cacheKey);
      this.cacheTime.delete(cacheKey);
    } else {
      this.cache.clear();
      this.cacheTime.clear();
    }
  }
}

// Singleton instance
let sessionAggregator: SessionAggregator | null = null;

export function getSessionAggregator(): SessionAggregator {
  if (!sessionAggregator) {
    sessionAggregator = new SessionAggregator();
  }
  return sessionAggregator;
}
