/**
 * Shared HTML template components for webviews
 */

import { ButtonLabel } from './types';

/**
 * SVG Icons used across templates
 */
export const ICONS = {
  checkmark: `<svg viewBox="0 0 16 16" fill="currentColor">
    <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
  </svg>`,
  pencil: `<svg viewBox="0 0 16 16" fill="currentColor">
    <path d="M12.146 1.146a.5.5 0 01.708 0l2 2a.5.5 0 010 .708l-9.5 9.5a.5.5 0 01-.168.11l-5 2a.5.5 0 01-.65-.65l2-5a.5.5 0 01.11-.168l9.5-9.5z"/>
  </svg>`,
  comment: `<svg viewBox="0 0 16 16" fill="currentColor">
    <path d="M14 1a1 1 0 011 1v8a1 1 0 01-1 1h-2.5a2 2 0 00-1.6.8L8 14.333 6.1 11.8a2 2 0 00-1.6-.8H2a1 1 0 01-1-1V2a1 1 0 011-1h12z"/>
  </svg>`,
  clock: `<svg viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 3.5a.5.5 0 00-1 0V9a.5.5 0 00.252.434l3.5 2a.5.5 0 00.496-.868L8 8.71V3.5z"/>
    <path d="M8 16A8 8 0 108 0a8 8 0 000 16zm7-8A7 7 0 111 8a7 7 0 0114 0z"/>
  </svg>`,
  file: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>`,
  openFile: `<svg viewBox="0 0 16 16" fill="currentColor">
    <path d="M13.5 3H10V2h3.5A1.5 1.5 0 0115 3.5v10a1.5 1.5 0 01-1.5 1.5h-10A1.5 1.5 0 012 13.5V10h1v3.5a.5.5 0 00.5.5h10a.5.5 0 00.5-.5v-10a.5.5 0 00-.5-.5z"/>
    <path d="M1 4h7.793l-1.147 1.146.708.708L10.707 3.5 8.354 1.146l-.708.708L8.793 3H1v1z"/>
  </svg>`,
  fullscreen: `<svg viewBox="0 0 16 16" fill="currentColor">
    <path d="M3 3h4v1H4v3H3V3zm6 0h4v4h-1V4H9V3zM3 9h1v3h3v1H3V9zm9 0h4v4h-1v-3h-3V9z"/>
  </svg>`
};

/**
 * Generate approval banner HTML
 */
export function generateApprovalBanner(isApproved: boolean, approvalModeText: string): string {
  return `
  <div class="approval-banner" id="approvalBanner" style="display: ${isApproved ? 'flex' : 'none'}">
    ${ICONS.checkmark}
    <span class="approval-banner-text">Plan Approved</span>
    <span class="approval-banner-mode" id="approvalModeText">${approvalModeText}</span>
  </div>`;
}

/**
 * Generate action buttons HTML for sidebar
 */
export function generateSidebarActionButtons(
  approveBtn: ButtonLabel,
  hasComments: boolean,
  commentCount: number,
  isApproved: boolean
): string {
  const disabledAttr = isApproved ? ' disabled' : '';

  return `
  <div class="action-bar${isApproved ? ' approved' : ''}">
    <button class="action-btn primary" onclick="approve()" title="${approveBtn.tooltip}"${disabledAttr}>
      ${ICONS.checkmark}
      ${approveBtn.text}
    </button>
    <button class="action-btn secondary" onclick="approveManual()" title="Yes, manually approve edits (Option 2)"${disabledAttr}>
      ${ICONS.pencil}
      Manual
    </button>
    <button class="action-btn feedback" onclick="sendFeedback()" title="Send comments to Claude (Option 3)"${disabledAttr}>
      ${ICONS.comment}
      Feedback
      ${hasComments ? `<span class="badge">${commentCount}</span>` : ''}
    </button>
  </div>`;
}

/**
 * Generate action buttons HTML for panel toolbar
 */
export function generatePanelActionButtons(
  approveBtn: ButtonLabel,
  hasComments: boolean,
  commentCount: number,
  isApproved: boolean
): string {
  const disabledAttr = isApproved ? ' disabled' : '';

  return `
  <div class="action-buttons${isApproved ? ' approved' : ''}">
    <button class="action-btn primary" onclick="approve()" title="${approveBtn.tooltip}"${disabledAttr}>
      ${ICONS.checkmark}
      ${approveBtn.text}
    </button>
    <button class="action-btn secondary" onclick="approveManual()" title="Yes, manually approve edits (Option 2)"${disabledAttr}>
      ${ICONS.pencil}
      Manual
    </button>
    <button class="action-btn feedback ${hasComments ? 'has-comments' : ''}" onclick="sendFeedback()" title="Send comments to Claude (Option 3)"${disabledAttr}>
      ${ICONS.comment}
      Feedback
      ${hasComments ? `<span class="badge">${commentCount}</span>` : ''}
    </button>
  </div>`;
}

/**
 * Generate comment modal HTML
 */
export function generateCommentModal(variant: 'sidebar' | 'panel' = 'sidebar'): string {
  const cancelClass = variant === 'panel' ? 'modal-btn modal-btn-cancel' : 'modal-btn cancel';
  const submitClass = variant === 'panel' ? 'modal-btn modal-btn-submit' : 'modal-btn submit';

  return `
  <div class="modal-overlay" id="commentModal">
    <div class="modal">
      <div class="modal-title">Add Comment</div>
      <div class="modal-subtitle" id="modalSubtitle">Section: ...</div>
      <textarea class="modal-input" id="commentInput" placeholder="What feedback do you have?"></textarea>
      <div class="modal-actions">
        <button class="${cancelClass}" onclick="closeModal()">Cancel</button>
        <button class="${submitClass}" onclick="submitComment()">Add</button>
      </div>
    </div>
  </div>`;
}

/**
 * Generate bottom bar with quick message input
 */
export function generateBottomBar(variant: 'sidebar' | 'panel' = 'sidebar'): string {
  const btnClass = variant === 'panel' ? 'submit-btn' : 'send-btn';

  return `
  <div class="bottom-bar">
    <div class="bottom-bar-row">
      <input type="text" class="message-input" id="messageInput" placeholder="Quick message to Claude..." onkeypress="handleKeypress(event)">
      <button class="${btnClass}" onclick="sendMessage()">Send</button>
    </div>
    <div class="mode-toggle">
      <div class="mode-toggle-row">
        <input type="checkbox" id="planModeToggle" checked>
        <label for="planModeToggle">Plan Selection Mode</label>
      </div>
      <span class="mode-toggle-hint">On: Select feedback option first | Off: Direct message</span>
    </div>
  </div>`;
}

/**
 * Generate empty state HTML
 */
export function generateEmptyState(variant: 'sidebar' | 'panel' = 'sidebar'): string {
  const message = variant === 'panel' ? 'No artifact loaded' : 'No plan file active';
  const fontSize = variant === 'panel' ? '12px' : '11px';
  const marginTop = variant === 'panel' ? '8px' : '4px';

  return `
  <div class="empty-state">
    ${ICONS.file}
    <div>${message}</div>
    <div style="font-size: ${fontSize}; margin-top: ${marginTop};">Run <code>/plan</code> in Claude Code</div>
  </div>`;
}

/**
 * Generate script initialization
 */
export function generateScriptInit(commentsJson: string): string {
  return `
    const vscode = acquireVsCodeApi();
    let comments = ${commentsJson};
    let currentLineNumber = 0;
    let currentSectionTitle = '';`;
}

/**
 * Generate script footer (initialization calls)
 */
export function generateScriptFooter(): string {
  return `
    // Initialize
    renderComments();
    setupCommentHandlers();`;
}

/**
 * Generate loading overlay HTML (panel only)
 */
export function generateLoadingOverlay(): string {
  return `
  <div class="loading-overlay" id="loadingOverlay">
    <div class="loading-spinner"></div>
    <div class="loading-text">Processing...</div>
  </div>`;
}
