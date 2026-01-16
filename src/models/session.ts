/**
 * Session and Project models for Claude Code data
 */

export interface ClaudeProject {
  /** Encoded path (e.g., "-Users-simonfestl-Documents-project") */
  encodedPath: string;
  /** Decoded filesystem path */
  path: string;
  /** Project name (last segment) */
  name: string;
  /** Sessions in this project */
  sessions: ClaudeSession[];
  /** Last activity timestamp */
  lastActivity: number;
}

export interface ClaudeSession {
  /** Session UUID */
  id: string;
  /** Project this session belongs to */
  projectPath: string;
  /** Last activity timestamp (Unix ms) */
  lastActivity: number;
  /** First activity timestamp (Unix ms) */
  createdAt: number;
  /** Display name/description from history */
  displayName: string;
  /** Session status */
  status: SessionStatus;
  /** Number of messages/interactions */
  messageCount: number;
  /** Associated plan file (if any) */
  planFile?: string;
  /** Associated worktree path (if any) */
  worktreePath?: string;
  /** Whether Claude is waiting for user input (e.g., AskUserQuestion) */
  inputRequired?: boolean;
  /** The tool waiting for input (e.g., "AskUserQuestion", "TodoWrite") */
  waitingTool?: string;
}

export type SessionStatus = 'active' | 'paused' | 'completed' | 'unknown';

export interface ClaudePlan {
  /** Filename (e.g., "async-tickling-snail.md") */
  filename: string;
  /** Full path to plan file */
  path: string;
  /** File modification time */
  mtime: Date;
  /** File size in bytes */
  size: number;
  /** Preview (first few lines) */
  preview?: string;
}

export interface HistoryEntry {
  /** Command/action display text */
  display: string;
  /** Timestamp in Unix milliseconds */
  timestamp: number;
  /** Project path */
  project: string;
  /** Session UUID */
  sessionId: string;
  /** Pasted content metadata */
  pastedContents?: Record<string, unknown>;
}

export interface TranscriptEntry {
  /** Entry type */
  type: 'user' | 'assistant' | 'tool_use' | 'tool_result' | 'summary' | 'unknown';
  /** ISO timestamp */
  timestamp?: string;
  /** Message content */
  content?: string;
  /** Tool name (for tool_use/tool_result) */
  tool_name?: string;
  /** Tool input parameters */
  tool_input?: Record<string, unknown>;
  /** Tool output/result */
  tool_output?: string;
  /** Summary text */
  summary?: string;
}

export interface SessionSummary {
  /** Session ID */
  sessionId: string;
  /** Total messages */
  messageCount: number;
  /** Tool calls made */
  toolCalls: ToolCallSummary[];
  /** Files modified */
  filesModified: string[];
  /** Duration in ms */
  duration: number;
  /** Generated summary text */
  summaryText?: string;
}

export interface ToolCallSummary {
  /** Tool name */
  tool: string;
  /** Number of times called */
  count: number;
  /** Files involved (if applicable) */
  files?: string[];
}

export interface Worktree {
  /** Worktree path */
  path: string;
  /** Branch name */
  branch: string;
  /** HEAD commit */
  head: string;
  /** Is this the main worktree? */
  isMain: boolean;
  /** Is the worktree locked? */
  isLocked: boolean;
  /** Lock reason (if locked) */
  lockReason?: string;
  /** Associated session ID (custom metadata) */
  sessionId?: string;
}
