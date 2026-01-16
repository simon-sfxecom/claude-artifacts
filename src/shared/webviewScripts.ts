/**
 * Shared JavaScript for webviews
 */

export const MERMAID_INIT = `
  mermaid.initialize({
    startOnLoad: true,
    theme: 'dark',
    securityLevel: 'loose',
    // Flowchart / Graph
    flowchart: {
      useMaxWidth: true,
      htmlLabels: true,
      curve: 'basis'
    },
    // Sequence Diagrams
    sequence: {
      useMaxWidth: true,
      diagramMarginX: 50,
      diagramMarginY: 10,
      actorMargin: 50,
      width: 150,
      height: 65,
      boxMargin: 10,
      boxTextMargin: 5,
      noteMargin: 10,
      messageMargin: 35,
      mirrorActors: true,
      showSequenceNumbers: false
    },
    // Gantt Charts
    gantt: {
      useMaxWidth: true,
      titleTopMargin: 25,
      barHeight: 20,
      barGap: 4,
      topPadding: 50,
      leftPadding: 75,
      gridLineStartPadding: 35,
      fontSize: 11,
      numberSectionStyles: 4
    },
    // Journey Diagrams
    journey: {
      useMaxWidth: true,
      diagramMarginX: 50,
      diagramMarginY: 10
    },
    // Git Graph
    gitGraph: {
      useMaxWidth: true,
      showBranches: true,
      showCommitLabel: true,
      mainBranchName: 'main'
    },
    // Pie Charts
    pie: {
      useMaxWidth: true,
      textPosition: 0.75
    },
    // ER Diagrams
    er: {
      useMaxWidth: true,
      entityPadding: 15,
      stroke: 'gray',
      fill: 'honeydew'
    },
    // State Diagrams
    state: {
      useMaxWidth: true,
      dividerMargin: 10,
      sizeUnit: 5,
      padding: 8,
      textHeight: 10,
      titleShift: -15,
      noteMargin: 10,
      forkWidth: 70,
      forkHeight: 7
    },
    // Class Diagrams
    class: {
      useMaxWidth: true
    },
    // Mindmap
    mindmap: {
      useMaxWidth: true,
      padding: 10
    },
    // Timeline
    timeline: {
      useMaxWidth: true
    },
    // Quadrant Chart
    quadrantChart: {
      useMaxWidth: true,
      chartWidth: 500,
      chartHeight: 500,
      titleFontSize: 20,
      titlePadding: 10,
      quadrantPadding: 5,
      xAxisLabelPadding: 10,
      yAxisLabelPadding: 10,
      xAxisLabelFontSize: 16,
      yAxisLabelFontSize: 16,
      quadrantLabelFontSize: 16,
      quadrantTextTopPadding: 5,
      pointTextPadding: 5,
      pointLabelFontSize: 12,
      pointRadius: 5
    },
    // Sankey Diagrams
    sankey: {
      useMaxWidth: true,
      width: 600,
      height: 400,
      linkColor: 'gradient',
      nodeAlignment: 'justify'
    },
    // XY Charts
    xyChart: {
      useMaxWidth: true,
      width: 700,
      height: 500,
      titleFontSize: 20,
      titlePadding: 10
    },
    // Block Diagrams
    block: {
      useMaxWidth: true,
      padding: 8
    },
    // Requirement Diagrams
    requirement: {
      useMaxWidth: true
    },
    // C4 Diagrams
    c4: {
      useMaxWidth: true,
      diagramMarginX: 50,
      diagramMarginY: 10
    }
  });
`;

export const UTILITY_FUNCTIONS = `
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
`;

export const ACTION_FUNCTIONS = `
  function openFile() {
    vscode.postMessage({ type: 'openFile' });
  }

  function approve() {
    vscode.postMessage({ type: 'approve' });
  }

  function approveManual() {
    vscode.postMessage({ type: 'approveManual' });
  }

  function sendFeedback() {
    vscode.postMessage({ type: 'sendFeedback' });
  }

  function sendMessage() {
    const input = document.getElementById('messageInput');
    const toggle = document.getElementById('planModeToggle');
    const text = input.value.trim();
    if (text) {
      const planMode = toggle ? toggle.checked : false;
      vscode.postMessage({ type: 'sendMessage', value: text, planMode: planMode });
      input.value = '';
    }
  }

  function handleKeypress(e) {
    if (e.key === 'Enter') {
      sendMessage();
    }
  }
`;

export const COMMENT_FUNCTIONS = `
  function renderComments() {
    const list = document.getElementById('commentsList');
    if (!list) return;

    // Detect if we're in panel mode (has comments-sidebar) or sidebar mode
    const isPanel = document.querySelector('.comments-sidebar') !== null;

    if (comments.length === 0) {
      list.innerHTML = isPanel
        ? '<div class="no-comments">No comments yet. Click on a heading to add one.</div>'
        : '';
      return;
    }

    if (isPanel) {
      // Panel mode: card-style comments
      list.innerHTML = comments.map(c => \`
        <div class="comment-card">
          <div class="comment-meta">\${c.sectionTitle || 'Line ' + c.lineNumber}</div>
          <div class="comment-text">\${escapeHtml(c.text)}</div>
          <div class="comment-actions">
            <button class="comment-action-btn" onclick="deleteComment('\${c.id}')" title="Delete">✕</button>
          </div>
        </div>
      \`).join('');
    } else {
      // Sidebar mode: compact comments
      list.innerHTML = comments.map(c => \`
        <div class="comment-item">
          <div class="comment-meta">
            <span>\${c.sectionTitle ? c.sectionTitle : 'Line ' + c.lineNumber}</span>
            <span class="comment-delete" onclick="deleteComment('\${c.id}')">✕</span>
          </div>
          <div>\${escapeHtml(c.text)}</div>
        </div>
      \`).join('');
    }
  }

  function deleteComment(id) {
    vscode.postMessage({ type: 'deleteComment', commentId: id });
  }

  function setupCommentHandlers() {
    const content = document.getElementById('contentArea') || document.getElementById('content');
    if (!content) return;

    let elementIndex = 0;

    // Setup headings (h1, h2, h3)
    const headings = content.querySelectorAll('h1, h2, h3');
    headings.forEach((heading) => {
      heading.classList.add('section-line');
      const idx = ++elementIndex;
      heading.onclick = () => {
        currentLineNumber = idx;
        currentSectionTitle = heading.textContent || '';
        document.getElementById('modalSubtitle').textContent = 'Section: ' + currentSectionTitle;
        document.getElementById('commentModal').classList.add('active');
        document.getElementById('commentInput').focus();
      };
    });

    // Setup code blocks (pre elements)
    const codeBlocks = content.querySelectorAll('pre');
    codeBlocks.forEach((pre, codeIndex) => {
      // Wrap in a commentable container if not already wrapped
      if (!pre.parentElement?.classList.contains('commentable-code')) {
        const wrapper = document.createElement('div');
        wrapper.className = 'commentable-code section-line';
        pre.parentNode.insertBefore(wrapper, pre);
        wrapper.appendChild(pre);

        // Add comment button overlay
        const btn = document.createElement('button');
        btn.className = 'code-comment-btn';
        btn.innerHTML = '+';
        btn.title = 'Add comment to this code block';
        wrapper.appendChild(btn);

        const idx = ++elementIndex;
        const codeContent = pre.textContent || '';
        const codePreview = codeContent.substring(0, 50).trim() + (codeContent.length > 50 ? '...' : '');
        const langClass = pre.querySelector('code')?.className || '';
        const lang = langClass.replace('language-', '') || 'code';

        btn.onclick = (e) => {
          e.stopPropagation();
          currentLineNumber = idx;
          currentSectionTitle = 'Code Block (' + lang + '): ' + codePreview;
          document.getElementById('modalSubtitle').textContent = 'Code Block #' + (codeIndex + 1);
          document.getElementById('commentModal').classList.add('active');
          document.getElementById('commentInput').focus();
        };
      }
    });

    // Setup Mermaid diagrams
    const mermaidDiagrams = content.querySelectorAll('.mermaid');
    mermaidDiagrams.forEach((diagram, diagramIndex) => {
      // Wrap in a commentable container if not already wrapped
      if (!diagram.parentElement?.classList.contains('commentable-mermaid')) {
        const wrapper = document.createElement('div');
        wrapper.className = 'commentable-mermaid section-line';
        diagram.parentNode.insertBefore(wrapper, diagram);
        wrapper.appendChild(diagram);

        // Add comment button overlay
        const btn = document.createElement('button');
        btn.className = 'mermaid-comment-btn';
        btn.innerHTML = '+';
        btn.title = 'Add comment to this diagram';
        wrapper.appendChild(btn);

        const idx = ++elementIndex;

        btn.onclick = (e) => {
          e.stopPropagation();
          currentLineNumber = idx;
          currentSectionTitle = 'Mermaid Diagram #' + (diagramIndex + 1);
          document.getElementById('modalSubtitle').textContent = 'Diagram #' + (diagramIndex + 1);
          document.getElementById('commentModal').classList.add('active');
          document.getElementById('commentInput').focus();
        };
      }
    });
  }

  function closeModal() {
    document.getElementById('commentModal').classList.remove('active');
    document.getElementById('commentInput').value = '';
  }

  function submitComment() {
    const text = document.getElementById('commentInput').value.trim();
    if (text) {
      vscode.postMessage({
        type: 'addComment',
        value: text,
        lineNumber: currentLineNumber,
        sectionTitle: currentSectionTitle
      });
      closeModal();
    }
  }

  // Close modal on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modal = document.getElementById('commentModal');
      if (modal && modal.classList.contains('active')) {
        closeModal();
      }
    }
  });
`;

export const MERMAID_RENDER = `
  document.querySelectorAll('.mermaid').forEach(el => {
    mermaid.init(undefined, el);
  });
`;

/**
 * Message handler for incremental updates from Extension
 */
export const MESSAGE_HANDLER = `
  window.addEventListener('message', event => {
    const message = event.data;
    switch(message.type) {
      case 'updateComments':
        comments = message.comments;
        renderComments();
        updateFeedbackButton();
        updateCommentsSection();
        break;
      case 'setApprovalState':
        setApprovalState(message.approved, message.mode);
        break;
    }
  });

  function updateFeedbackButton() {
    const btn = document.querySelector('.action-btn.feedback');
    const badge = btn?.querySelector('.badge');

    if (comments.length > 0) {
      btn?.classList.add('has-comments');
      btn?.style.setProperty('background', 'var(--warning)');
      btn?.style.setProperty('color', '#000');
      btn?.style.setProperty('border-color', 'var(--warning)');
      if (badge) {
        badge.textContent = comments.length;
      } else if (btn) {
        const newBadge = document.createElement('span');
        newBadge.className = 'badge';
        newBadge.textContent = comments.length;
        btn.appendChild(newBadge);
      }
    } else {
      btn?.classList.remove('has-comments');
      btn?.style.removeProperty('background');
      btn?.style.removeProperty('color');
      btn?.style.removeProperty('border-color');
      badge?.remove();
    }
  }

  function updateCommentsSection() {
    const section = document.querySelector('.comments-section');
    if (section) {
      section.style.display = comments.length > 0 ? 'block' : 'none';
    }
  }

  function setApprovalState(approved, mode) {
    const banner = document.getElementById('approvalBanner');
    const actionBar = document.querySelector('.action-bar, .action-buttons');
    const modeText = document.getElementById('approvalModeText');

    if (approved) {
      if (banner) {
        banner.style.display = 'flex';
      }
      if (actionBar) {
        actionBar.classList.add('approved');
        actionBar.querySelectorAll('button').forEach(btn => btn.disabled = true);
      }
      if (modeText) {
        modeText.textContent = mode === 'bypass' ? 'Bypass Mode' : 'Manual Mode';
      }
    } else {
      if (banner) {
        banner.style.display = 'none';
      }
      if (actionBar) {
        actionBar.classList.remove('approved');
        actionBar.querySelectorAll('button').forEach(btn => btn.disabled = false);
      }
    }
  }
`;
