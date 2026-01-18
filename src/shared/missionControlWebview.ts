import { MissionControlState, SessionCard, ProjectGroup, FilterState } from '../models/missionControl';
import { getRelativeTime } from './formatters';

/**
 * Generate complete HTML for Mission Control panel
 */
export function getMissionControlHTML(
  state: MissionControlState,
  nonce: string,
  cspSource: string
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mission Control</title>
  <style>
    ${getMissionControlCSS()}
  </style>
</head>
<body>
  ${getTopBar(state)}
  <div class="mission-control">
    ${getProjectsSidebar(state.projects)}
    ${getSessionInbox(state.sessions, state.filters)}
    ${getDetailsPanel(state.activeSession)}
  </div>
  ${getBottomStatusBar(state)}
  <script nonce="${nonce}">
    ${getMissionControlJS()}
  </script>
</body>
</html>`;
}

/**
 * CSS styles for Mission Control
 */
function getMissionControlCSS(): string {
  return `
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      overflow: hidden;
    }

    .top-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      background: var(--vscode-titleBar-activeBackground);
      border-bottom: 1px solid var(--vscode-widget-border);
    }

    .top-bar h1 {
      font-size: 14px;
      font-weight: 600;
      margin: 0;
    }

    .top-bar-actions {
      display: flex;
      gap: 8px;
    }

    .btn {
      padding: 4px 12px;
      border: 1px solid var(--vscode-button-border, transparent);
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border-radius: 2px;
      cursor: pointer;
      font-size: 12px;
    }

    .btn:hover {
      background: var(--vscode-button-hoverBackground);
    }

    .mission-control {
      display: grid;
      grid-template-columns: 20% 50% 30%;
      gap: 1px;
      height: calc(100vh - 70px);
      background: var(--vscode-widget-border);
    }

    /* Projects Sidebar */
    .projects-sidebar {
      overflow-y: auto;
      background: var(--vscode-sideBar-background);
      padding: 12px;
    }

    .project-group {
      margin-bottom: 16px;
    }

    .project-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 8px;
      cursor: pointer;
      border-radius: 3px;
    }

    .project-header:hover {
      background: var(--vscode-list-hoverBackground);
    }

    .project-name {
      font-weight: 500;
      font-size: 13px;
    }

    .project-count {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }

    .project-sessions {
      margin-top: 4px;
      padding-left: 12px;
    }

    .project-session-item {
      padding: 4px 8px;
      font-size: 12px;
      cursor: pointer;
      border-radius: 3px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .project-session-item:hover {
      background: var(--vscode-list-hoverBackground);
    }

    .session-icon {
      font-size: 10px;
    }

    /* Session Inbox */
    .session-inbox {
      overflow-y: auto;
      background: var(--vscode-editor-background);
      padding: 12px;
    }

    .filter-bar {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
      padding: 8px;
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 3px;
    }

    .search-input {
      flex: 1;
      padding: 6px 8px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 2px;
      font-size: 13px;
    }

    .search-input::placeholder {
      color: var(--vscode-input-placeholderForeground);
    }

    .filter-select {
      padding: 6px 8px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 2px;
      font-size: 13px;
    }

    .session-cards {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .session-card {
      background: var(--vscode-editor-inactiveSelectionBackground);
      border: 1px solid var(--vscode-widget-border);
      border-radius: 6px;
      padding: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .session-card:hover {
      background: var(--vscode-list-hoverBackground);
      transform: translateY(-2px);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }

    .session-card.active {
      border-left: 4px solid var(--vscode-charts-blue);
    }

    .session-card.waiting {
      border-left: 4px solid var(--vscode-charts-yellow);
      animation: pulse 2s infinite;
    }

    .session-card.completed {
      border-left: 4px solid var(--vscode-charts-green);
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }

    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
    }

    .status-badge.active {
      background: var(--vscode-charts-blue);
      color: white;
    }

    .status-badge.waiting, .status-badge.input-required {
      background: var(--vscode-charts-yellow);
      color: black;
    }

    .status-badge.paused {
      background: var(--vscode-charts-orange);
      color: white;
    }

    .status-badge.completed {
      background: var(--vscode-charts-green);
      color: white;
    }

    .card-time {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }

    .card-title {
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 6px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .card-preview {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }

    .card-stats {
      display: flex;
      gap: 12px;
      margin-bottom: 8px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }

    .stat {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .card-actions {
      display: flex;
      gap: 6px;
    }

    .action-btn {
      flex: 1;
      padding: 4px 8px;
      border: 1px solid var(--vscode-button-border, transparent);
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border-radius: 2px;
      cursor: pointer;
      font-size: 11px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
    }

    .action-btn.primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }

    .action-btn:hover {
      background: var(--vscode-button-hoverBackground);
      color: var(--vscode-button-foreground);
    }

    /* Details Panel */
    .details-panel {
      overflow-y: auto;
      background: var(--vscode-sideBarSectionHeader-background);
      padding: 12px;
    }

    .details-header {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 12px;
    }

    .details-section {
      margin-bottom: 16px;
    }

    .details-label {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
    }

    .details-value {
      font-size: 13px;
    }

    .activity-timeline {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .activity-item {
      padding: 8px;
      background: var(--vscode-editor-inactiveSelectionBackground);
      border-radius: 3px;
      font-size: 12px;
    }

    .activity-time {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }

    /* Bottom Status Bar */
    .bottom-status-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4px 12px;
      background: var(--vscode-statusBar-background);
      border-top: 1px solid var(--vscode-widget-border);
      font-size: 12px;
    }

    .status-info {
      display: flex;
      gap: 16px;
    }

    .status-item {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    /* Empty state */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px;
      text-align: center;
      color: var(--vscode-descriptionForeground);
    }

    .empty-state-icon {
      font-size: 48px;
      margin-bottom: 16px;
      opacity: 0.5;
    }

    .empty-state-title {
      font-size: 16px;
      font-weight: 500;
      margin-bottom: 8px;
    }

    .empty-state-message {
      font-size: 13px;
    }

    /* Scrollbar styling */
    ::-webkit-scrollbar {
      width: 10px;
      height: 10px;
    }

    ::-webkit-scrollbar-track {
      background: var(--vscode-scrollbarSlider-background);
    }

    ::-webkit-scrollbar-thumb {
      background: var(--vscode-scrollbarSlider-hoverBackground);
      border-radius: 5px;
    }

    ::-webkit-scrollbar-thumb:hover {
      background: var(--vscode-scrollbarSlider-activeBackground);
    }
  `;
}

/**
 * Generate top bar HTML
 */
function getTopBar(state: MissionControlState): string {
  return `
    <div class="top-bar">
      <h1>Mission Control</h1>
      <div class="top-bar-actions">
        <button class="btn" onclick="refreshMissionControl()">
          Refresh
        </button>
      </div>
    </div>
  `;
}

/**
 * Generate projects sidebar HTML
 */
function getProjectsSidebar(projects: ProjectGroup[]): string {
  if (projects.length === 0) {
    return `
      <div class="projects-sidebar">
        <div class="empty-state">
          <div class="empty-state-icon">📁</div>
          <div class="empty-state-title">No Projects</div>
          <div class="empty-state-message">Start a Claude Code session to see projects here</div>
        </div>
      </div>
    `;
  }

  // Just use the first project as "current" - we don't have access to process.cwd() in webview
  const currentProject = projects[0];
  const otherProjects = projects.filter(p => p !== currentProject);

  return `
    <div class="projects-sidebar">
      ${currentProject ? `
        <div class="project-group">
          <div class="project-header">
            <div>
              <div class="project-name">Current Project</div>
              <div class="project-name">${escapeHtml(currentProject.project.name)}</div>
            </div>
            <div class="project-count">✓ ${currentProject.activeSessions}</div>
          </div>
          ${currentProject.activeSessions > 0 ? `
            <div class="project-sessions">
              ${currentProject.project.sessions.filter(s => s.status === 'active').slice(0, 5).map(s => `
                <div class="project-session-item" onclick="selectSession('${escapeHtml(s.id)}', '${escapeHtml(s.projectPath)}')">
                  <span class="session-icon">🔵</span>
                  <span>${escapeHtml(s.displayName || s.id.substring(0, 12))}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      ` : ''}

      ${otherProjects.length > 0 ? `
        <div class="project-group">
          <div class="project-header">
            <div class="project-name">Other Projects</div>
            <div class="project-count">(${otherProjects.length})</div>
          </div>
          <div class="project-sessions">
            ${otherProjects.slice(0, 5).map(p => `
              <div class="project-session-item">
                <span class="session-icon">📁</span>
                <span>${escapeHtml(p.project.name)}</span>
                <span class="project-count">${p.activeSessions}</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Generate session inbox HTML
 */
function getSessionInbox(sessions: SessionCard[], filters: FilterState): string {
  return `
    <div class="session-inbox">
      <div class="filter-bar">
        <input
          type="text"
          class="search-input"
          placeholder="Search sessions..."
          oninput="handleSearch(event)"
          value="${escapeHtml(filters.search || '')}"
        />
        <select class="filter-select" onchange="handleFilterStatus(event)">
          <option value="all">All Status</option>
          <option value="active" ${filters.status?.includes('active') ? 'selected' : ''}>Active</option>
          <option value="paused" ${filters.status?.includes('paused') ? 'selected' : ''}>Paused</option>
          <option value="completed" ${filters.status?.includes('completed') ? 'selected' : ''}>Completed</option>
        </select>
      </div>

      ${sessions.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">🤖</div>
          <div class="empty-state-title">No Sessions Found</div>
          <div class="empty-state-message">Start a Claude Code session or adjust your filters</div>
        </div>
      ` : `
        <div class="session-cards">
          ${sessions.map(card => generateSessionCardHTML(card)).join('')}
        </div>
      `}
    </div>
  `;
}

/**
 * Generate single session card HTML
 */
function generateSessionCardHTML(card: SessionCard): string {
  const session = card.session;
  const displayName = escapeHtml(session.displayName || session.id.substring(0, 20));
  const relativeTime = getRelativeTime(new Date(session.lastActivity));

  const statusClass = session.inputRequired ? 'waiting' :
                      session.status === 'active' ? 'active' :
                      session.status === 'completed' ? 'completed' : '';

  return `
    <div class="session-card ${statusClass}" data-session-id="${escapeHtml(session.id)}" data-project-path="${escapeHtml(session.projectPath)}" onclick="selectSession('${escapeHtml(session.id)}', '${escapeHtml(session.projectPath)}')">
      <div class="card-header">
        <span class="status-badge ${card.visualState.badge.text.toLowerCase().replace(' ', '-')}">
          <span>${card.visualState.badge.icon}</span>
          <span>${card.visualState.badge.text}</span>
        </span>
        <span class="card-time">${relativeTime}</span>
      </div>

      <div class="card-title">${displayName}</div>

      ${card.preview.currentActivity ? `
        <div class="card-preview">${escapeHtml(card.preview.currentActivity)}</div>
      ` : card.preview.lastMessage ? `
        <div class="card-preview">${escapeHtml(card.preview.lastMessage)}</div>
      ` : ''}

      <div class="card-stats">
        <span class="stat" title="Messages">
          💬 ${card.stats.messageCount}
        </span>
        <span class="stat" title="Tool Calls">
          🔧 ${card.stats.toolCalls}
        </span>
        <span class="stat" title="Files Modified">
          📝 ${card.stats.filesModified}
        </span>
      </div>

      <div class="card-actions">
        ${card.actions.map(action => `
          <button class="action-btn ${action.id === 'resume' ? 'primary' : ''}"
                  onclick="event.stopPropagation(); handleAction('${escapeHtml(action.handler)}', '${escapeHtml(session.id)}', '${escapeHtml(session.projectPath)}')">
            ${escapeHtml(action.label)}
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

/**
 * Generate details panel HTML
 */
function getDetailsPanel(activeSession?: SessionCard): string {
  if (!activeSession) {
    return `
      <div class="details-panel">
        <div class="empty-state">
          <div class="empty-state-icon">👈</div>
          <div class="empty-state-title">No Session Selected</div>
          <div class="empty-state-message">Select a session to view details</div>
        </div>
      </div>
    `;
  }

  const session = activeSession.session;
  const stats = activeSession.stats;

  return `
    <div class="details-panel">
      <div class="details-header">${escapeHtml(session.displayName || session.id)}</div>

      <div class="details-section">
        <div class="details-label">Status</div>
        <div class="details-value">
          <span class="status-badge ${activeSession.visualState.badge.text.toLowerCase().replace(' ', '-')}">
            ${activeSession.visualState.badge.icon} ${activeSession.visualState.badge.text}
          </span>
        </div>
      </div>

      <div class="details-section">
        <div class="details-label">Statistics</div>
        <div class="details-value">
          <div class="card-stats">
            <div class="stat">💬 ${stats.messageCount} messages</div>
            <div class="stat">🔧 ${stats.toolCalls} tools</div>
            <div class="stat">📝 ${stats.filesModified} files</div>
          </div>
        </div>
      </div>

      <div class="details-section">
        <div class="details-label">Current Activity</div>
        <div class="details-value">${escapeHtml(activeSession.preview.currentActivity || 'No activity')}</div>
      </div>

      <div class="details-section">
        <div class="details-label">Project</div>
        <div class="details-value">${escapeHtml(session.projectPath)}</div>
      </div>

      <div class="details-section">
        <button class="btn" style="width: 100%; margin-bottom: 8px;" onclick="handleAction('claudeArtifacts.openChat', '${escapeHtml(session.id)}', '${escapeHtml(session.projectPath)}')">
          View Chat Transcript
        </button>
        <button class="btn" style="width: 100%;" onclick="handleAction('claudeArtifacts.resumeSession', '${escapeHtml(session.id)}', '${escapeHtml(session.projectPath)}')">
          Resume Session
        </button>
      </div>
    </div>
  `;
}

/**
 * Generate bottom status bar HTML
 */
function getBottomStatusBar(state: MissionControlState): string {
  const activeSessions = state.sessions.filter(s => s.session.status === 'active').length;
  const totalSessions = state.sessions.length;

  return `
    <div class="bottom-status-bar">
      <div class="status-info">
        <div class="status-item">
          <span>⚡</span>
          <span>${activeSessions} active session${activeSessions !== 1 ? 's' : ''}</span>
        </div>
        <div class="status-item">
          <span>📊</span>
          <span>${totalSessions} total</span>
        </div>
        <div class="status-item">
          <span>🔄</span>
          <span>Auto-refresh: ON</span>
        </div>
      </div>
      <div class="status-info">
        <div class="status-item">
          <span>⏱️</span>
          <span id="lastUpdate">Last update: now</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Generate JavaScript for Mission Control
 */
function getMissionControlJS(): string {
  return `
    const vscode = acquireVsCodeApi();

    function selectSession(sessionId, projectPath) {
      vscode.postMessage({
        type: 'selectSession',
        payload: { sessionId, projectPath }
      });
    }

    function handleAction(handler, sessionId, projectPath) {
      vscode.postMessage({
        type: 'executeCommand',
        payload: { handler, sessionId, projectPath }
      });
    }

    function handleSearch(event) {
      const search = event.target.value;
      vscode.postMessage({
        type: 'applyFilters',
        payload: { search }
      });
    }

    function handleFilterStatus(event) {
      const status = event.target.value;
      vscode.postMessage({
        type: 'applyFilters',
        payload: { status: status === 'all' ? [] : [status] }
      });
    }

    function refreshMissionControl() {
      vscode.postMessage({
        type: 'refresh'
      });
    }

    // Update "last update" time every 2 seconds
    setInterval(() => {
      const elem = document.getElementById('lastUpdate');
      if (elem) {
        const match = elem.textContent.match(/Last update: (\\d+)s ago/);
        const seconds = match ? parseInt(match[1]) + 2 : 2;
        elem.textContent = 'Last update: ' + seconds + 's ago';
      }
    }, 2000);
  `;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = { textContent: text } as any;
  const escaped = div.textContent
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  return escaped;
}
