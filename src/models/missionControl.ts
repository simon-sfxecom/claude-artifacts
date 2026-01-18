import { ClaudeSession, ClaudeProject } from './session';

/**
 * Mission Control Data Models
 *
 * These interfaces define the structure for the Mission Control dashboard,
 * inspired by Google Antigravity's agent management interface.
 */

/**
 * Session card with enriched preview and stats data
 */
export interface SessionCard {
  session: ClaudeSession;
  preview: SessionPreview;
  stats: SessionStats;
  actions: SessionAction[];
  visualState: VisualState;
}

/**
 * Preview data for a session card
 */
export interface SessionPreview {
  currentPlan?: string;
  lastMessage?: string;
  thumbnail?: string;
  currentActivity?: string;
}

/**
 * Statistics for a session
 */
export interface SessionStats {
  messageCount: number;
  toolCalls: number;
  filesModified: number;
  duration: number;
  startTime: number;
  lastActivity: number;
}

/**
 * Action button for session card
 */
export interface SessionAction {
  id: string;
  label: string;
  icon: string;
  enabled: boolean;
  handler: string;
}

/**
 * Visual state for session card
 */
export interface VisualState {
  badge: StatusBadge;
  progressBar?: ProgressBar;
  highlight?: 'attention' | 'success' | 'warning' | 'error';
  pinned?: boolean;
}

/**
 * Status badge configuration
 */
export interface StatusBadge {
  text: string;
  color: string;
  icon: string;
  pulse?: boolean;
}

/**
 * Progress bar configuration
 */
export interface ProgressBar {
  current: number;
  total: number;
  label?: string;
}

/**
 * Complete Mission Control state
 */
export interface MissionControlState {
  projects: ProjectGroup[];
  sessions: SessionCard[];
  activeSession?: SessionCard;
  filters: FilterState;
  sortBy: SortBy;
  viewMode: ViewMode;
}

/**
 * Project group for sidebar
 */
export interface ProjectGroup {
  project: ClaudeProject;
  expanded: boolean;
  activeSessions: number;
  totalSessions: number;
}

/**
 * Filter state
 */
export interface FilterState {
  status: SessionStatus[];
  projects: string[];
  dateRange?: DateRange;
  search?: string;
  tags?: string[];
}

/**
 * Session status type
 */
export type SessionStatus = 'active' | 'paused' | 'completed';

/**
 * Sort criteria
 */
export type SortBy = 'activity' | 'created' | 'name' | 'status' | 'project';

/**
 * View mode
 */
export type ViewMode = 'cards' | 'list' | 'board';

/**
 * Date range for filtering
 */
export interface DateRange {
  from: Date;
  to: Date;
}

/**
 * Message types for webview communication
 */
export interface MissionControlMessage {
  type: 'stateUpdate' | 'selectSession' | 'resumeSession' | 'viewSession' |
        'viewSummary' | 'applyFilters' | 'updateSort' | 'refresh';
  payload?: any;
}
