/**
 * Shared types for Claude Artifacts extension
 */

export interface Comment {
  id: string;
  lineNumber: number;
  sectionTitle: string;
  text: string;
}

export type PermissionMode = 'bypassPermissions' | 'default' | 'plan' | 'unknown';

export interface ClaudeSettings {
  permissions?: {
    defaultMode?: string;
  };
}

export interface ButtonLabel {
  text: string;
  tooltip: string;
}

/**
 * Incoming messages from Webview to Extension
 * Using discriminated union for type-safety
 */
export type WebviewMessage =
  | { type: 'openFile' }
  | { type: 'approve' }
  | { type: 'approveManual' }
  | { type: 'sendFeedback' }
  | { type: 'addComment'; value: string; lineNumber: number; sectionTitle?: string }
  | { type: 'deleteComment'; commentId: string }
  | { type: 'sendMessage'; value: string; planMode?: boolean };

/**
 * Outgoing messages from Extension to Webview
 */
export type WebviewOutgoingMessage =
  | { type: 'updateComments'; comments: Comment[] }
  | { type: 'setApprovalState'; approved: boolean; mode: 'bypass' | 'manual' | null };
