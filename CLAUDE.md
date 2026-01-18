# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a VS Code extension that provides real-time preview and management of Claude Code sessions. It integrates with Claude Code's plan system (`~/.claude/plans/`), session data (`~/.claude/projects/`), and terminal interactions to provide a rich UI for managing multiple Claude sessions.

## Key Development Commands

```bash
# Build TypeScript
npm run compile

# Watch mode for development
npm run watch

# Lint code
npm run lint

# Package extension
npx vsce package

# Version and package (auto-increments version)
npm run release        # Patch (0.1.0 → 0.1.1)
npm run release:minor  # Minor (0.1.0 → 0.2.0)
npm run release:major  # Major (0.1.0 → 1.0.0)
```

## Testing

Press **F5** in VS Code to launch the Extension Development Host. The extension activates on startup (`onStartupFinished`).

## Architecture Overview

### Core Components

**Extension Entry (`extension.ts`)**
- Activates providers and services
- Registers commands and keybindings
- Manages status bar and global state

**Services Layer (`src/services/`)**
- `sessionService.ts` - Reads session data from `~/.claude/projects/`, parses history and transcripts
- `planService.ts` - File watcher for `~/.claude/plans/*.md`, detects plan updates, auto-registers terminals
- `worktreeService.ts` - Git worktree integration for multi-session isolation
- `walkthroughGenerator.ts` - Generates session summaries with screenshots

**Views Layer (`src/views/`)**
- `sessionInboxProvider.ts` - Tree view provider for Sessions panel (shows active/recent sessions)
- `sessionDetailPanel.ts` - Webview for detailed session info
- `chatViewerPanel.ts` - Webview for viewing chat transcripts

**Webview Providers**
- `artifactViewProvider.ts` - Sidebar webview for Plan Preview (renders markdown + Mermaid)
- `artifactPanel.ts` - Tab panel for full-screen plan view

**Terminal Integration (`claudeService.ts`)**
- Tracks which terminal belongs to which Claude session
- Routes commands to specific terminals
- Handles multi-session support

**Shared Utilities (`src/shared/`)**
- `htmlTemplates.ts` - Webview HTML generation
- `webviewScripts.ts` - Client-side JavaScript for webviews
- `messageHandler.ts` - Webview ↔ extension messaging
- `styles.ts` - CSS for webviews
- `formatters.ts` - Date/time formatting
- `claudeConfig.ts` - Claude Code config parsing

### Data Flow

1. **Plan Updates**: `planService` watches `~/.claude/plans/*.md` → triggers webview update in `artifactViewProvider` and `artifactPanel`
2. **Session Management**: `sessionService` reads from `~/.claude/projects/` → provides data to `sessionInboxProvider` tree view
3. **Terminal Routing**: When resuming a session, `claudeService` registers the terminal with the session ID, allowing targeted command execution

### Claude Code Integration

The extension relies on Claude Code's filesystem structure:
- `~/.claude/plans/` - Plan markdown files (watched for changes)
- `~/.claude/projects/<encoded-path>/<session-id>/` - Session directories
  - `history.jsonl` - Session history entries
  - `transcript.jsonl` - Full conversation transcript
- `~/.claude/history.jsonl` - Global history index

### Webview Communication

Webviews use postMessage protocol defined in `messageHandler.ts`:
- Extension → Webview: `WebviewOutgoingMessage` types (updateContent, updateComments, etc.)
- Webview → Extension: `WebviewMessage` types (addComment, approve, sendFeedback, etc.)

### Security Notes

- Session IDs are validated with `isValidSessionId()` to prevent shell injection
- Plan file paths are restricted to `~/.claude/plans/` directory
- Terminal commands are executed through VS Code's terminal API

## Git Workflow

**CRITICAL**: Never push directly to `main` branch. Always use Pull Requests.

```bash
git checkout -b feature/my-feature
# ... make changes ...
git add .
git commit -m "feat: description"
git push -u origin feature/my-feature
gh pr create --title "Title" --body "Description"
```

## Extension Contribution Points

### Commands
- Plan actions: `approve`, `approveManual`, `sendFeedback`
- Session actions: `resumeSession`, `viewWalkthrough`, `saveWalkthrough`, `openChat`
- Worktree: `newWorktreeSession`, `listWorktrees`, `removeWorktree`

### Keybindings
- `Cmd+Shift+1` / `Ctrl+Shift+1` - Approve Plan (Bypass)
- `Cmd+Shift+2` / `Ctrl+Shift+2` - Approve Plan (Manual)
- `Cmd+Shift+3` / `Ctrl+Shift+3` - Send Feedback

### Views
- `claudeArtifacts.sessionInbox` - Tree view (Sessions panel)
- `claudeArtifacts.artifactView` - Webview view (Plan Preview panel)

## Common Patterns

### Adding a New Command

1. Register in `package.json` under `contributes.commands`
2. Register handler in `extension.ts` with `vscode.commands.registerCommand`
3. Add to appropriate menu in `package.json` (`menus` section)

### Adding Webview Features

1. Update message types in `shared/types.ts`
2. Add handler in `shared/messageHandler.ts`
3. Add client-side logic in `shared/webviewScripts.ts`
4. Update HTML generation in `shared/htmlTemplates.ts` if needed

### Working with Sessions

Use `SessionService` to read session data:
```typescript
const sessionService = getSessionService();
const projects = await sessionService.getProjects();
const transcript = await sessionService.getTranscript(session);
```

## TypeScript Configuration

- Target: ES2020
- Module: CommonJS
- Output: `out/` directory
- Strict mode enabled
