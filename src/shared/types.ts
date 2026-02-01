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
  | { type: 'openFullscreen' }
  | { type: 'approveBypassClear' }  // Option 1: Bypass and Clear Context
  | { type: 'approve' }              // Option 2: Bypass
  | { type: 'approveManual' }        // Option 3: Manual Edit/Accept
  | { type: 'sendFeedback' }         // Option 4: Feedback
  | { type: 'addComment'; value: string; lineNumber: number; sectionTitle?: string }
  | { type: 'deleteComment'; commentId: string }
  | { type: 'sendMessage'; value: string; planMode?: boolean };

/**
 * Outgoing messages from Extension to Webview
 */
export type WebviewOutgoingMessage =
  | { type: 'updateComments'; comments: Comment[] }
  | { type: 'setApprovalState'; approved: boolean; mode: 'bypassClear' | 'bypass' | 'manual' | null };
