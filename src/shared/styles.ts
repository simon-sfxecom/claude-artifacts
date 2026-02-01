/**
 * Shared CSS styles for webviews
 */

export const CSS_VARIABLES = `
  :root {
    --font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
    --foreground: var(--vscode-foreground, #cccccc);
    --background: var(--vscode-editor-background, #1e1e1e);
    --sidebar-bg: var(--vscode-sideBar-background, #252526);
    --link-color: var(--vscode-textLink-foreground, #3794ff);
    --border-color: var(--vscode-panel-border, #454545);
    --code-bg: var(--vscode-textCodeBlock-background, #1e1e1e);
    --heading-color: var(--vscode-symbolIcon-classForeground, #ee9d28);
    --muted: var(--vscode-descriptionForeground, #858585);
    --button-bg: var(--vscode-button-background, #0e639c);
    --button-fg: var(--vscode-button-foreground, #ffffff);
    --input-bg: var(--vscode-input-background, #3c3c3c);
    --input-border: var(--vscode-input-border, #454545);
    --success: #4ec9b0;
    --warning: #cca700;
    --danger: #f14c4c;
  }

  * { box-sizing: border-box; }
`;

export const MODE_BADGE_CSS = `
  .mode-badge {
    font-size: 9px;
    color: var(--success);
    background: rgba(78, 201, 176, 0.15);
    padding: 2px 6px;
    border-radius: 3px;
    text-transform: uppercase;
    font-weight: 500;
  }
`;

export const SESSION_INFO_CSS = `
  .session-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 12px;
    background: var(--input-bg);
    border-bottom: 1px solid var(--border-color);
    font-size: 11px;
    flex-shrink: 0;
  }

  .session-info-left {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    flex: 1;
  }

  .session-info-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .session-label {
    color: var(--muted);
  }

  .session-id {
    font-family: var(--vscode-editor-font-family, monospace);
    font-weight: 500;
    color: var(--foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .session-project {
    color: var(--muted);
    font-size: 10px;
  }

  .session-project::before {
    content: "•";
    margin-right: 6px;
  }

  .session-activity {
    color: var(--muted);
    font-size: 10px;
  }

  .connection-status {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 3px;
    font-weight: 500;
  }

  .connection-status.connected {
    color: var(--success);
    background: rgba(78, 201, 176, 0.15);
  }

  .connection-status.disconnected {
    color: var(--warning);
    background: rgba(204, 167, 0, 0.15);
  }
`;

export const ACTION_BUTTON_CSS = `
  .action-btn {
    padding: 8px 12px;
    border: none;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }

  .action-btn svg {
    width: 14px;
    height: 14px;
  }

  .action-btn.primary {
    background: var(--success);
    color: #000;
  }

  .action-btn.primary.clear {
    background: #3794ff;
    color: #fff;
  }

  .action-btn.primary:hover {
    filter: brightness(1.1);
  }

  .action-btn.secondary {
    background: var(--input-bg);
    color: var(--foreground);
    border: 1px solid var(--border-color);
  }

  .action-btn.secondary:hover {
    background: var(--border-color);
  }

  .action-btn.feedback {
    background: var(--input-bg);
    color: var(--foreground);
    border: 1px solid var(--border-color);
  }

  .action-btn.feedback.has-comments {
    background: var(--warning);
    color: #000;
    border-color: var(--warning);
  }

  .action-btn.feedback:hover {
    filter: brightness(1.1);
  }

  .badge {
    background: rgba(0,0,0,0.3);
    padding: 2px 6px;
    border-radius: 10px;
    font-size: 10px;
  }

  .action-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .action-btn.loading {
    opacity: 0.7;
    pointer-events: none;
  }

  .action-btn.loading::after {
    content: '...';
    animation: ellipsis 1s infinite;
  }

  @keyframes ellipsis {
    0% { content: '.'; }
    33% { content: '..'; }
    66% { content: '...'; }
  }
`;

export const MODAL_CSS = `
  .modal-overlay {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 100;
    align-items: center;
    justify-content: center;
  }

  .modal-overlay.active {
    display: flex;
  }

  .modal {
    background: var(--sidebar-bg);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 16px;
    width: 90%;
    max-width: 300px;
  }

  .modal-title {
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 8px;
  }

  .modal-subtitle {
    font-size: 11px;
    color: var(--muted);
    margin-bottom: 12px;
  }

  .modal-input {
    width: 100%;
    padding: 8px;
    background: var(--input-bg);
    border: 1px solid var(--input-border);
    border-radius: 4px;
    color: var(--foreground);
    font-size: 12px;
    resize: vertical;
    min-height: 60px;
  }

  .modal-input:focus {
    outline: none;
    border-color: var(--link-color);
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 12px;
  }

  .modal-btn {
    padding: 6px 12px;
    border: none;
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
  }

  .modal-btn.cancel {
    background: transparent;
    color: var(--muted);
  }

  .modal-btn.submit {
    background: var(--button-bg);
    color: var(--button-fg);
  }
`;

export const COMMENT_CSS = `
  .comment-item {
    background: var(--input-bg);
    border-radius: 4px;
    padding: 8px;
    margin-bottom: 6px;
    font-size: 11px;
  }

  .comment-meta {
    font-size: 10px;
    color: var(--muted);
    margin-bottom: 4px;
    display: flex;
    justify-content: space-between;
  }

  .comment-delete {
    color: var(--danger);
    cursor: pointer;
    opacity: 0.7;
  }

  .comment-delete:hover {
    opacity: 1;
  }
`;

export const INPUT_CSS = `
  .message-input {
    flex: 1;
    padding: 6px 10px;
    background: var(--input-bg);
    border: 1px solid var(--input-border);
    border-radius: 4px;
    color: var(--foreground);
    font-size: 12px;
  }

  .message-input:focus {
    outline: none;
    border-color: var(--link-color);
  }

  .send-btn {
    padding: 6px 12px;
    background: var(--button-bg);
    color: var(--button-fg);
    border: none;
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
  }

  .send-btn:hover {
    filter: brightness(1.15);
  }
`;

export const HEADER_CSS = `
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 4px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    color: var(--muted);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .icon-btn:hover {
    background: var(--input-bg);
    border-color: var(--border-color);
    color: var(--foreground);
  }

  .icon-btn svg {
    width: 14px;
    height: 14px;
  }

  .filename {
    font-size: 11px;
    color: var(--muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .filename:hover {
    color: var(--link-color);
  }

  .filename svg {
    width: 12px;
    height: 12px;
    flex-shrink: 0;
  }

  .time-ago {
    font-size: 10px;
    color: var(--muted);
    opacity: 0.7;
    white-space: nowrap;
  }

  .source-badge {
    font-size: 9px;
    padding: 2px 6px;
    border-radius: 3px;
    /* Claude brand purple - intentionally hardcoded for consistent branding */
    background: #a855f722;
    color: #a855f7;
    border: 1px solid #a855f744;
    font-weight: 500;
    white-space: nowrap;
    flex-shrink: 0;
  }
`;

export const MARKDOWN_CSS = `
  h1, h2, h3, h4, h5, h6 {
    color: var(--heading-color);
    margin-top: 14px;
    margin-bottom: 6px;
    font-weight: 600;
  }

  h1 { font-size: 1.3em; border-bottom: 1px solid var(--border-color); padding-bottom: 4px; }
  h2 { font-size: 1.15em; }
  h3 { font-size: 1.05em; }

  p { margin: 6px 0; }
  a { color: var(--link-color); text-decoration: none; }
  a:hover { text-decoration: underline; }

  code {
    font-family: var(--vscode-editor-font-family, 'Consolas', monospace);
    font-size: 11px;
    background-color: var(--code-bg);
    padding: 2px 4px;
    border-radius: 3px;
  }

  pre {
    background-color: var(--code-bg);
    padding: 10px;
    border-radius: 4px;
    overflow-x: auto;
    margin: 10px 0;
    font-size: 11px;
  }

  pre code { padding: 0; background: none; }

  blockquote {
    border-left: 3px solid var(--link-color);
    margin: 10px 0;
    padding-left: 10px;
    color: var(--muted);
  }

  table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 11px; }
  th, td { border: 1px solid var(--border-color); padding: 5px 8px; text-align: left; }
  th { background-color: var(--code-bg); font-weight: 600; }

  ul, ol { padding-left: 18px; margin: 6px 0; }
  li { margin: 3px 0; }

  .mermaid {
    background-color: var(--code-bg);
    padding: 12px;
    border-radius: 4px;
    margin: 10px 0;
    text-align: center;
  }

  hr { border: none; border-top: 1px solid var(--border-color); margin: 12px 0; }

  /* Commentable Code Blocks */
  .commentable-code {
    position: relative;
    margin: 10px 0;
  }

  .commentable-code pre {
    margin: 0;
  }

  .commentable-code:hover {
    outline: 2px solid var(--link-color);
    outline-offset: 2px;
    border-radius: 4px;
  }

  .code-comment-btn {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 22px;
    height: 22px;
    background: var(--button-bg);
    color: var(--button-fg);
    border: none;
    border-radius: 4px;
    font-size: 14px;
    font-weight: bold;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
  }

  .commentable-code:hover .code-comment-btn {
    opacity: 1;
  }

  .code-comment-btn:hover {
    filter: brightness(1.2);
  }

  /* Commentable Mermaid Diagrams */
  .commentable-mermaid {
    position: relative;
    margin: 10px 0;
  }

  .commentable-mermaid .mermaid {
    margin: 0;
  }

  .commentable-mermaid:hover {
    outline: 2px solid var(--success);
    outline-offset: 2px;
    border-radius: 4px;
  }

  .mermaid-comment-btn {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 22px;
    height: 22px;
    background: var(--success);
    color: #000;
    border: none;
    border-radius: 4px;
    font-size: 14px;
    font-weight: bold;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
  }

  .commentable-mermaid:hover .mermaid-comment-btn {
    opacity: 1;
  }

  .mermaid-comment-btn:hover {
    filter: brightness(1.2);
  }

  /* Text Selection Popup */
  .selection-popup {
    position: absolute;
    z-index: 100;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.15s, visibility 0.15s;
    pointer-events: none;
  }

  .selection-popup.active {
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
  }

  .selection-popup-btn {
    background: var(--button-bg);
    color: var(--button-fg);
    border: none;
    border-radius: 6px;
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    white-space: nowrap;
  }

  .selection-popup-btn:hover {
    filter: brightness(1.2);
  }
`;

export const LOADING_CSS = `
  .loading-overlay {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 200;
    align-items: center;
    justify-content: center;
    flex-direction: column;
  }

  .loading-overlay.active {
    display: flex;
  }

  .loading-spinner {
    width: 30px;
    height: 30px;
    border: 3px solid var(--border-color);
    border-top-color: var(--link-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .loading-text {
    margin-top: 12px;
    color: var(--foreground);
    font-size: 13px;
  }
`;
