import { Plan } from '../services/planService';

/**
 * Generate HTML for Claude Session Terminal webview
 */
export function getTerminalWebviewHTML(
  sessionId: string,
  sessionName: string,
  cspSource: string,
  nonce: string,
  xtermCssUri: string,
  xtermJsUri: string,
  xtermAddonFitUri: string,
  xtermAddonWebglUri: string
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${cspSource};">
  <title>Claude: ${escapeHtml(sessionName)}</title>
  <link rel="stylesheet" href="${xtermCssUri}" />
  <style nonce="${nonce}">
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 12px;
      background-color: var(--vscode-tab-activeBackground);
      border-bottom: 2px solid var(--vscode-panel-border);
      min-height: 35px;
    }

    .header-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--vscode-tab-activeForeground);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .header-title::before {
      content: '▸';
      color: var(--vscode-icon-foreground);
      font-weight: bold;
    }

    .header-actions {
      display: flex;
      gap: 8px;
    }

    .header-button {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 4px 12px;
      border-radius: 2px;
      cursor: pointer;
      font-size: 12px;
      font-family: var(--vscode-font-family);
    }

    .header-button:hover {
      background: var(--vscode-button-hoverBackground);
    }

    .content {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    .terminal-container {
      flex: 0 0 70%;
      position: relative;
      background-color: #000;
    }

    #terminal {
      width: 100%;
      height: 100%;
      padding: 8px;
    }

    .sidebar {
      flex: 0 0 30%;
      min-width: 300px;
      max-width: 500px;
      border-left: 1px solid var(--vscode-panel-border);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background-color: var(--vscode-sideBar-background);
    }

    .sidebar-header {
      padding: 12px 16px;
      border-bottom: 1px solid var(--vscode-panel-border);
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--vscode-descriptionForeground);
      background-color: var(--vscode-sideBarSectionHeader-background);
    }

    .plan-preview {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      font-size: 13px;
      line-height: 1.6;
      white-space: pre-wrap;
      font-family: var(--vscode-editor-font-family);
    }

    .sidebar-actions {
      padding: 12px;
      border-top: 1px solid var(--vscode-panel-border);
      display: flex;
      gap: 8px;
    }

    .action-button {
      flex: 1;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 8px;
      border-radius: 2px;
      cursor: pointer;
      font-size: 12px;
      font-family: var(--vscode-font-family);
    }

    .action-button:hover {
      background: var(--vscode-button-hoverBackground);
    }

    .action-button.secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }

    .action-button.secondary:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    .no-plan {
      color: var(--vscode-descriptionForeground);
      font-style: italic;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-title">Claude: ${escapeHtml(sessionName)}</div>
    <div class="header-actions">
      <button class="header-button" id="pauseButton">Pause</button>
      <button class="header-button" id="feedbackButton">Send Feedback</button>
    </div>
  </div>

  <div class="content">
    <div class="terminal-container">
      <div id="terminal"></div>
    </div>

    <div class="sidebar">
      <div class="sidebar-header">Plan Preview</div>
      <div class="plan-preview" id="planPreview">
        <div class="no-plan">No plan available yet</div>
      </div>
      <div class="sidebar-actions">
        <button class="action-button" id="approveButton" style="display: none;">Approve</button>
        <button class="action-button secondary" id="declineButton" style="display: none;">Decline</button>
      </div>
    </div>
  </div>

  <script src="${xtermJsUri}" nonce="${nonce}"></script>
  <script src="${xtermAddonFitUri}" nonce="${nonce}"></script>
  <script src="${xtermAddonWebglUri}" nonce="${nonce}"></script>
  <script nonce="${nonce}">
    (function() {
      const vscode = acquireVsCodeApi();
      const sessionId = '${sessionId}';

      // Initialize xterm.js
      const term = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        theme: {
          background: '#000000',
          foreground: '#ffffff'
        },
        scrollback: 10000
      });

      // Load addons
      const fitAddon = new FitAddon.FitAddon();
      const webglAddon = new WebglAddon.WebglAddon();

      term.loadAddon(fitAddon);
      try {
        term.loadAddon(webglAddon);
      } catch (e) {
        console.warn('WebGL addon failed to load, falling back to canvas renderer', e);
      }

      // Open terminal
      term.open(document.getElementById('terminal'));
      fitAddon.fit();

      // Handle terminal input
      term.onData(data => {
        vscode.postMessage({
          type: 'terminalInput',
          data: data
        });
      });

      // Handle window resize
      window.addEventListener('resize', () => {
        fitAddon.fit();
        vscode.postMessage({
          type: 'terminalResize',
          cols: term.cols,
          rows: term.rows
        });
      });

      // Handle messages from extension
      window.addEventListener('message', event => {
        const message = event.data;

        switch (message.type) {
          case 'terminalOutput':
            term.write(message.data);
            break;

          case 'planUpdate':
            updatePlanPreview(message.content);
            updateActionButtons(message.needsApproval);
            break;

          case 'clear':
            term.clear();
            break;
        }
      });

      // Button handlers
      document.getElementById('pauseButton').addEventListener('click', () => {
        vscode.postMessage({ type: 'pause' });
      });

      document.getElementById('feedbackButton').addEventListener('click', () => {
        vscode.postMessage({ type: 'sendFeedback' });
      });

      document.getElementById('approveButton').addEventListener('click', () => {
        vscode.postMessage({ type: 'approve' });
      });

      document.getElementById('declineButton').addEventListener('click', () => {
        vscode.postMessage({ type: 'decline' });
      });

      // Update plan preview (safe text rendering)
      function updatePlanPreview(content) {
        const previewEl = document.getElementById('planPreview');

        // Clear existing content
        while (previewEl.firstChild) {
          previewEl.removeChild(previewEl.firstChild);
        }

        if (!content) {
          const noPlanel = document.createElement('div');
          noPlanel.className = 'no-plan';
          noPlanel.textContent = 'No plan available yet';
          previewEl.appendChild(noPlanel);
          return;
        }

        // Display as plain text (safe from XSS)
        previewEl.textContent = content;
      }

      // Update action buttons visibility
      function updateActionButtons(needsApproval) {
        const approveBtn = document.getElementById('approveButton');
        const declineBtn = document.getElementById('declineButton');

        if (needsApproval) {
          approveBtn.style.display = 'block';
          declineBtn.style.display = 'block';
        } else {
          approveBtn.style.display = 'none';
          declineBtn.style.display = 'none';
        }
      }

      // Notify extension that webview is ready
      vscode.postMessage({ type: 'ready' });
    })();
  </script>
</body>
</html>`;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
