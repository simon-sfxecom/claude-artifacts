import { marked } from 'marked';

// Configure marked for our use case
marked.setOptions({
  gfm: true,
  breaks: true
});

// Custom renderer to handle mermaid code blocks
const renderer = new marked.Renderer();

renderer.code = function(code: string, language: string | undefined): string {
  // Handle mermaid diagrams
  if (language === 'mermaid') {
    return `<div class="mermaid">${escapeHtml(code)}</div>`;
  }

  // Handle ASCII art / diagrams in plain code blocks
  if (!language || language === 'text' || language === 'ascii') {
    return `<pre><code>${escapeHtml(code)}</code></pre>`;
  }

  // Default code block with language class for potential syntax highlighting
  const escapedLang = escapeHtml(language);
  return `<pre><code class="language-${escapedLang}">${escapeHtml(code)}</code></pre>`;
};

// Task list support
renderer.listitem = function(text: string): string {
  if (text.startsWith('<input')) {
    return `<li class="task-list-item">${text}</li>\n`;
  }
  return `<li>${text}</li>\n`;
};

// Handle checkboxes in task lists
renderer.checkbox = function(checked: boolean): string {
  return `<input type="checkbox" ${checked ? 'checked' : ''} disabled> `;
};

marked.use({ renderer });

/**
 * Sanitize HTML by removing dangerous tags and attributes
 * This is a lightweight sanitizer for plan files (which are relatively trusted)
 */
function sanitizeHtml(html: string): string {
  // Remove script tags and their content
  html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove style tags and their content (can be used for CSS injection)
  html = html.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Remove on* event handlers (onclick, onerror, onload, etc.)
  html = html.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');
  html = html.replace(/\s+on\w+\s*=\s*[^\s>]+/gi, '');

  // Remove javascript: URLs
  html = html.replace(/href\s*=\s*["']?\s*javascript:[^"'\s>]*/gi, 'href="#"');
  html = html.replace(/src\s*=\s*["']?\s*javascript:[^"'\s>]*/gi, 'src=""');

  // Remove data: URLs in src (can be used for XSS)
  html = html.replace(/src\s*=\s*["']?\s*data:[^"'\s>]*/gi, 'src=""');

  // Remove iframe, object, embed tags
  html = html.replace(/<(iframe|object|embed|form|base|meta|link)\b[^>]*>/gi, '');
  html = html.replace(/<\/(iframe|object|embed|form|base|meta|link)>/gi, '');

  return html;
}

export function renderMarkdown(markdown: string): string {
  try {
    const html = marked.parse(markdown) as string;
    // Sanitize the output to prevent XSS
    return sanitizeHtml(html);
  } catch (error) {
    console.error('Error rendering markdown:', error);
    return `<pre>${escapeHtml(markdown)}</pre>`;
  }
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}
