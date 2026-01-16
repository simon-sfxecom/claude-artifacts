/**
 * Shared formatting utilities
 */

import { Comment } from './types';

/**
 * Counter for generating unique comment IDs
 */
let commentIdCounter = 0;

/**
 * Generate a unique comment ID
 * Uses timestamp + counter to prevent collisions even with rapid clicks
 */
export function generateCommentId(): string {
  return `comment-${Date.now()}-${++commentIdCounter}`;
}

/**
 * Get relative time string from date
 */
export function getRelativeTime(date: Date | null): string {
  if (!date) return '';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${diffDays}d ago`;
}

/**
 * Format comments for sending to Claude
 */
export function formatCommentsForClaude(comments: Comment[]): string {
  if (comments.length === 0) return '';

  let feedback = 'I have the following feedback on your plan:\n\n';

  for (const comment of comments) {
    if (comment.sectionTitle) {
      feedback += `**Section "${comment.sectionTitle}" (around line ${comment.lineNumber}):**\n`;
    } else {
      feedback += `**Line ${comment.lineNumber}:**\n`;
    }
    feedback += `${comment.text}\n\n`;
  }

  return feedback;
}
