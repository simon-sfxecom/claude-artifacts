import * as vscode from 'vscode';
import { ClaudeService } from '../claudeService';
import { Comment, WebviewMessage, WebviewOutgoingMessage, PermissionMode } from './types';
import { generateCommentId } from './formatters';
import { formatCommentsForClaude } from './formatters';
import { loadPermissionMode } from './claudeConfig';

/**
 * Context interface for webview providers
 * Provides access to webview and state management
 */
export interface WebviewContext {
  postMessage(message: WebviewOutgoingMessage): void;
  getFilePath(): string;
  openFile(viewColumn?: vscode.ViewColumn): Promise<void>;
}

/**
 * Shared state for artifact providers
 * Manages comments, approval state, and Claude service
 */
export class ArtifactState {
  private _comments: Comment[] = [];
  private _planApproved: boolean = false;
  private _approvalMode: 'bypass' | 'manual' | null = null;
  private _claudeService: ClaudeService;
  private _permissionMode: PermissionMode;
  private _sessionId: string | undefined;

  constructor(sessionId?: string) {
    this._sessionId = sessionId;
    this._claudeService = new ClaudeService(sessionId);
    this._permissionMode = loadPermissionMode();
  }

  /**
   * Set the target session ID (extracted from plan filename)
   */
  setSessionId(sessionId: string): void {
    this._sessionId = sessionId;
    this._claudeService.setTargetSession(sessionId);
  }

  get sessionId(): string | undefined {
    return this._sessionId;
  }

  get comments(): Comment[] {
    return this._comments;
  }

  get planApproved(): boolean {
    return this._planApproved;
  }

  get approvalMode(): 'bypass' | 'manual' | null {
    return this._approvalMode;
  }

  get permissionMode(): PermissionMode {
    return this._permissionMode;
  }

  get claudeService(): ClaudeService {
    return this._claudeService;
  }

  /**
   * Reset state when content changes
   */
  resetForNewContent(): void {
    this._comments = [];
    this._planApproved = false;
    this._approvalMode = null;
  }

  /**
   * Add a comment
   */
  addComment(lineNumber: number, text: string, sectionTitle?: string): Comment {
    const comment: Comment = {
      id: generateCommentId(),
      lineNumber,
      sectionTitle: sectionTitle || '',
      text
    };
    this._comments.push(comment);
    return comment;
  }

  /**
   * Delete a comment by ID
   */
  deleteComment(commentId: string): void {
    this._comments = this._comments.filter(c => c.id !== commentId);
  }

  /**
   * Clear all comments and return the count
   */
  clearComments(): number {
    const count = this._comments.length;
    this._comments = [];
    return count;
  }

  /**
   * Set approval state
   */
  setApproved(mode: 'bypass' | 'manual'): void {
    this._planApproved = true;
    this._approvalMode = mode;
  }

  /**
   * Get formatted comments for Claude
   */
  getFormattedComments(): string {
    return formatCommentsForClaude(this._comments);
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this._claudeService.dispose();
  }
}

/**
 * Handle webview messages with shared logic
 * Returns actions to take (for provider-specific responses)
 */
export async function handleWebviewMessage(
  data: WebviewMessage,
  state: ArtifactState,
  context: WebviewContext
): Promise<{ updateComments?: boolean; updateApproval?: boolean }> {
  const result: { updateComments?: boolean; updateApproval?: boolean } = {};

  switch (data.type) {
    case 'openFile':
      await context.openFile();
      break;

    case 'approve':
      await state.claudeService.sendChoice(1);
      state.setApproved('bypass');
      result.updateApproval = true;
      vscode.window.showInformationMessage('Plan approved (bypass permissions)');
      break;

    case 'approveManual':
      await state.claudeService.sendChoice(2);
      state.setApproved('manual');
      result.updateApproval = true;
      vscode.window.showInformationMessage('Plan approved (manual edits)');
      break;

    case 'sendFeedback':
      if (state.comments.length === 0) {
        vscode.window.showWarningMessage('No comments to send. Add comments first!');
        return result;
      }
      const feedback = state.getFormattedComments();
      const commentCount = state.clearComments();
      await state.claudeService.sendChoiceWithFeedback(3, feedback);
      result.updateComments = true;
      vscode.window.showInformationMessage(`Sent ${commentCount} comment(s) to Claude`);
      break;

    case 'addComment':
      state.addComment(data.lineNumber, data.value, data.sectionTitle);
      result.updateComments = true;
      break;

    case 'deleteComment':
      state.deleteComment(data.commentId);
      result.updateComments = true;
      break;

    case 'sendMessage':
      if (data.planMode) {
        await state.claudeService.sendChoiceWithFeedback(3, data.value);
      } else {
        await state.claudeService.sendFeedback(data.value);
      }
      vscode.window.showInformationMessage('Sent to Claude');
      break;
  }

  return result;
}
