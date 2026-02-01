/**
 * Shared module exports
 */

// Types
export * from './types';

// Config utilities
export { loadPermissionMode, loadPermissionModeAsync, getApproveButtonLabel, getModeIndicator } from './claudeConfig';

// Formatters
export { generateCommentId, getRelativeTime, formatCommentsForClaude } from './formatters';

// Message Handler
export { ArtifactState, WebviewContext, handleWebviewMessage } from './messageHandler';

// Styles
export {
  CSS_VARIABLES,
  MODE_BADGE_CSS,
  SESSION_INFO_CSS,
  ACTION_BUTTON_CSS,
  MODAL_CSS,
  COMMENT_CSS,
  INPUT_CSS,
  MARKDOWN_CSS,
  LOADING_CSS,
  HEADER_CSS
} from './styles';

// Webview Scripts
export {
  MERMAID_INIT,
  UTILITY_FUNCTIONS,
  ACTION_FUNCTIONS,
  COMMENT_FUNCTIONS,
  MERMAID_RENDER,
  MESSAGE_HANDLER
} from './webviewScripts';

// HTML Templates
export {
  ICONS,
  generateApprovalBanner,
  generateSessionInfoHeader,
  SessionDisplayInfo,
  generateSidebarActionButtons,
  generatePanelActionButtons,
  generateCommentModal,
  generateBottomBar,
  generateEmptyState,
  generateScriptInit,
  generateScriptFooter,
  generateLoadingOverlay
} from './htmlTemplates';
