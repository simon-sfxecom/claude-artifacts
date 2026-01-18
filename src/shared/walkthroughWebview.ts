import { ClaudeSession } from '../models/session';
import { MediaEntry } from '../services/mediaCaptureService';

interface MediaWithUri extends MediaEntry {
  webviewUri: string;
}

/**
 * Generate HTML for Walkthrough Viewer webview
 */
export function getWalkthroughHTML(
  session: ClaudeSession,
  media: MediaWithUri[],
  nonce: string,
  cspSource: string
): string {
  const displayName = session.displayName || session.id;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} data:; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>Walkthrough: ${escapeHtml(displayName)}</title>
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
      padding: 12px 16px;
      background-color: var(--vscode-titleBar-activeBackground);
      border-bottom: 1px solid var(--vscode-panel-border);
    }

    .header-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--vscode-titleBar-activeForeground);
    }

    .header-actions {
      display: flex;
      gap: 8px;
    }

    .header-button {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 6px 12px;
      border-radius: 2px;
      cursor: pointer;
      font-size: 12px;
      font-family: var(--vscode-font-family);
    }

    .header-button:hover {
      background: var(--vscode-button-hoverBackground);
    }

    .timeline {
      padding: 16px;
      background-color: var(--vscode-sideBar-background);
      border-bottom: 1px solid var(--vscode-panel-border);
      overflow-x: auto;
    }

    .timeline-track {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 100%;
      padding: 8px 0;
    }

    .timeline-marker {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      cursor: pointer;
      transition: transform 0.2s;
      flex-shrink: 0;
    }

    .timeline-marker:hover {
      transform: scale(1.3);
    }

    .timeline-marker.file-modified {
      background: var(--vscode-charts-blue);
    }

    .timeline-marker.test-run {
      background: var(--vscode-charts-green);
    }

    .timeline-marker.error {
      background: var(--vscode-charts-red);
    }

    .timeline-marker.plan-approved {
      background: var(--vscode-charts-purple);
    }

    .timeline-marker.manual {
      background: var(--vscode-charts-yellow);
    }

    .content {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
    }

    .stats {
      display: flex;
      gap: 24px;
      margin-bottom: 24px;
      padding: 16px;
      background-color: var(--vscode-sideBar-background);
      border-radius: 4px;
    }

    .stat {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .stat-value {
      font-size: 24px;
      font-weight: 600;
      color: var(--vscode-charts-blue);
    }

    .stat-label {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }

    .media-gallery {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
    }

    .media-card {
      background-color: var(--vscode-sideBar-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      overflow: hidden;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .media-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    }

    .media-thumbnail {
      width: 100%;
      height: 180px;
      object-fit: cover;
      background-color: var(--vscode-editor-background);
    }

    .media-info {
      padding: 12px;
    }

    .media-title {
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .media-meta {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .media-badge {
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 10px;
      font-weight: 600;
    }

    .badge-file-modified { background: var(--vscode-charts-blue); color: white; }
    .badge-test-run { background: var(--vscode-charts-green); color: white; }
    .badge-error { background: var(--vscode-charts-red); color: white; }
    .badge-plan-approved { background: var(--vscode-charts-purple); color: white; }
    .badge-manual { background: var(--vscode-charts-yellow); color: black; }

    .media-actions {
      display: flex;
      gap: 8px;
      padding: 8px 12px;
      border-top: 1px solid var(--vscode-panel-border);
    }

    .action-btn {
      flex: 1;
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      padding: 4px 8px;
      border-radius: 2px;
      cursor: pointer;
      font-size: 11px;
    }

    .action-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    .lightbox {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.9);
      z-index: 1000;
      align-items: center;
      justify-content: center;
    }

    .lightbox.active {
      display: flex;
    }

    .lightbox-content {
      max-width: 90%;
      max-height: 90%;
      position: relative;
    }

    .lightbox-image {
      max-width: 100%;
      max-height: 80vh;
      object-fit: contain;
    }

    .lightbox-close {
      position: absolute;
      top: -40px;
      right: 0;
      background: none;
      border: none;
      color: white;
      font-size: 32px;
      cursor: pointer;
      padding: 0;
      width: 40px;
      height: 40px;
    }

    .lightbox-annotation {
      position: absolute;
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      padding: 8px;
      border-radius: 4px;
      min-width: 200px;
      max-width: 300px;
    }

    .annotation-input {
      width: 100%;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      padding: 4px;
      font-family: var(--vscode-font-family);
      font-size: 12px;
      margin-bottom: 8px;
    }

    .annotation-buttons {
      display: flex;
      gap: 4px;
    }

    .annotation-btn {
      flex: 1;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 4px 8px;
      border-radius: 2px;
      cursor: pointer;
      font-size: 11px;
    }

    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: var(--vscode-descriptionForeground);
    }

    .empty-state-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-title">Walkthrough: ${escapeHtml(displayName)}</div>
    <div class="header-actions">
      <button class="header-button" id="refreshButton">🔄 Refresh</button>
      <button class="header-button" id="exportPdfButton">📄 Export PDF</button>
      <button class="header-button" id="exportZipButton">📦 Export Zip</button>
    </div>
  </div>

  ${media.length > 0 ? `
  <div class="timeline">
    <div class="timeline-track" id="timelineTrack">
      ${media.map(m => `
        <div class="timeline-marker ${m.eventType}"
             data-media-id="${m.id}"
             title="${escapeHtml(m.eventType)} - ${new Date(m.timestamp).toLocaleString()}">
        </div>
      `).join('')}
    </div>
  </div>

  <div class="content">
    <div class="stats">
      <div class="stat">
        <div class="stat-value">${media.length}</div>
        <div class="stat-label">Total Captures</div>
      </div>
      <div class="stat">
        <div class="stat-value">${media.filter(m => m.type === 'screenshot').length}</div>
        <div class="stat-label">Screenshots</div>
      </div>
      <div class="stat">
        <div class="stat-value">${media.filter(m => m.type === 'video').length}</div>
        <div class="stat-label">Videos</div>
      </div>
      <div class="stat">
        <div class="stat-value">${media.reduce((sum, m) => sum + (m.comments?.length || 0), 0)}</div>
        <div class="stat-label">Comments</div>
      </div>
    </div>

    <div class="media-gallery" id="mediaGallery">
      ${media.map(m => renderMediaCard(m)).join('')}
    </div>
  </div>
  ` : `
  <div class="content">
    <div class="empty-state">
      <div class="empty-state-icon">📷</div>
      <h3>No Media Captured Yet</h3>
      <p>Screenshots and videos will appear here as they are captured during the session.</p>
    </div>
  </div>
  `}

  <div class="lightbox" id="lightbox">
    <div class="lightbox-content" id="lightboxContent">
      <button class="lightbox-close" id="lightboxClose">×</button>
      <img class="lightbox-image" id="lightboxImage" />
    </div>
  </div>

  <script nonce="${nonce}">
    (function() {
      const vscode = acquireVsCodeApi();

      // Button handlers
      document.getElementById('refreshButton')?.addEventListener('click', () => {
        vscode.postMessage({ type: 'refresh' });
      });

      document.getElementById('exportPdfButton')?.addEventListener('click', () => {
        vscode.postMessage({ type: 'exportPDF' });
      });

      document.getElementById('exportZipButton')?.addEventListener('click', () => {
        vscode.postMessage({ type: 'exportZip' });
      });

      // Timeline marker clicks
      document.querySelectorAll('.timeline-marker').forEach(marker => {
        marker.addEventListener('click', () => {
          const mediaId = marker.getAttribute('data-media-id');
          const card = document.querySelector(\`[data-media-id="\${mediaId}"]\`);
          if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        });
      });

      // Media card clicks
      document.querySelectorAll('.media-card').forEach(card => {
        card.addEventListener('click', (e) => {
          if (e.target.classList.contains('action-btn')) return;
          const imgSrc = card.querySelector('.media-thumbnail')?.getAttribute('src');
          if (imgSrc) {
            openLightbox(imgSrc);
          }
        });
      });

      // Lightbox
      function openLightbox(src) {
        const lightbox = document.getElementById('lightbox');
        const image = document.getElementById('lightboxImage');
        image.src = src;
        lightbox.classList.add('active');
      }

      function closeLightbox() {
        const lightbox = document.getElementById('lightbox');
        lightbox.classList.remove('active');
      }

      document.getElementById('lightboxClose')?.addEventListener('click', closeLightbox);
      document.getElementById('lightbox')?.addEventListener('click', (e) => {
        if (e.target.id === 'lightbox') {
          closeLightbox();
        }
      });

      // Annotation buttons
      document.querySelectorAll('.action-btn[data-action="comment"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const mediaId = btn.closest('.media-card').getAttribute('data-media-id');
          const text = prompt('Add a comment:');
          if (text) {
            vscode.postMessage({ type: 'addComment', mediaId, text });
          }
        });
      });

      document.querySelectorAll('.action-btn[data-action="delete"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const mediaId = btn.closest('.media-card').getAttribute('data-media-id');
          if (confirm('Delete this media?')) {
            vscode.postMessage({ type: 'deleteMedia', mediaId });
          }
        });
      });
    })();
  </script>
</body>
</html>`;
}

/**
 * Render a media card
 */
function renderMediaCard(media: MediaWithUri): string {
  const date = new Date(media.timestamp).toLocaleString();
  const badgeClass = `badge-${media.eventType}`;

  return `
    <div class="media-card" data-media-id="${media.id}">
      <img class="media-thumbnail" src="${media.webviewUri}" alt="${escapeHtml(media.eventType)}" />
      <div class="media-info">
        <div class="media-title">${escapeHtml(media.eventType.replace(/-/g, ' '))}</div>
        <div class="media-meta">
          <span>${date}</span>
          <span class="media-badge ${badgeClass}">${escapeHtml(media.eventType)}</span>
        </div>
        ${media.metadata?.fileName ? `<div style="font-size: 11px; margin-top: 4px; color: var(--vscode-descriptionForeground);">${escapeHtml(media.metadata.fileName)}</div>` : ''}
        ${media.comments && media.comments.length > 0 ? `<div style="font-size: 11px; margin-top: 4px; color: var(--vscode-charts-blue);">💬 ${media.comments.length} comment${media.comments.length > 1 ? 's' : ''}</div>` : ''}
      </div>
      <div class="media-actions">
        <button class="action-btn" data-action="comment">💬 Comment</button>
        <button class="action-btn" data-action="delete">🗑️ Delete</button>
      </div>
    </div>
  `;
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
