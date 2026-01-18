# Changelog

All notable changes to the Claude Artifacts extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.5] - 2026-01-18

### Changed
- **UI Improvements**: Enhanced split view layout (70% terminal, 30% sidebar)
- Improved terminal/sidebar proportions for better Antigravity-style experience
- More compact header with icon
- Professional sidebar header styling

## [0.1.4] - 2026-01-18

### Added
- **New Chat in UI Tab**: "New Chat" button now opens in embedded terminal UI instead of native terminal
- Auto-sends `claude` command when starting new sessions
- PTYManager.newSession() method for fresh Claude sessions

### Changed
- New sessions now use the rich xterm.js UI wrapper by default
- Improved session detection logic (new vs. existing)

## [0.1.3] - 2026-01-18

### Changed
- **UI Flow**: Made "Open Session in Tab" the default action (inline button)
- Moved "Resume Session" to context menu as fallback
- Prioritizes embedded terminal UI over native terminal

## [0.1.2] - 2026-01-17

### Added
- ✅ **Phase 1: Mission Control Dashboard**
  - 3-column layout (Projects | Session Cards | Details)
  - Real-time session updates (2-second polling)
  - Status badges: 🔵 Active, ⚠️ Waiting, ✅ Completed
  - Search and filtering (by status, project, text)
  - Session statistics (messages, tool calls, files modified)
  - Quick actions (Resume, View, Summary, Approve)
  - Command: `claudeArtifacts.showMissionControl`
  - Keybinding: `Cmd+Shift+M` / `Ctrl+Shift+M`

- ✅ **Phase 2: IDE View Integration**
  - Embedded xterm.js terminal in VS Code tabs
  - node-pty for Claude CLI subprocess management
  - Split view: Terminal (70%) + Plan sidebar (30%)
  - Real-time plan updates in sidebar
  - Quick action buttons (Approve, Decline, Feedback)
  - Multi-session support (independent PTY per tab)
  - 10,000-line scrollback buffer
  - 10K character line length limit (prevents memory issues)
  - Command: `claudeArtifacts.openSessionInTab`

- ✅ **Phase 3: Enhanced Walkthrough**
  - Automatic screenshot capture on:
    - File modifications (Edit, Write tools)
    - Test execution (Bash with test keywords)
    - Errors (tool_result with error status)
    - Plan approvals (ExitPlanMode)
    - Manual capture command
  - Platform-specific screenshot tools:
    - Linux: scrot, gnome-screenshot, ImageMagick
    - macOS: screencapture (native)
    - Windows: PowerShell + .NET
    - Fallback: screenshot-desktop npm package
  - Video recording with FFmpeg (user-controlled start/stop)
  - Rich walkthrough viewer:
    - Timeline navigation with event markers
    - Media gallery (2-3 column grid with lazy loading)
    - Lightbox image viewer
    - Video player with controls
    - Comment system (position-based for images, timestamp for videos)
    - Export to Zip archive
    - Statistics dashboard
  - SHA256 hash-based file integrity checking
  - Storage: `~/.claude/walkthroughs/{sessionId}/`
  - Commands: `claudeArtifacts.viewWalkthrough`, `claudeArtifacts.captureScreenshot`, `claudeArtifacts.startRecording`, `claudeArtifacts.stopRecording`

### Fixed
- Session monitoring file integrity with SHA256 hashing
- PTY line length limits (10K characters with truncation)
- Screenshot capture error handling with platform-specific guidance

### Dependencies
- Added: `node-pty@^1.0.0`
- Added: `@xterm/xterm@^5.5.0`
- Added: `@xterm/addon-fit@^0.10.0`
- Added: `@xterm/addon-webgl@^0.18.0`
- Added: `screenshot-desktop@^1.15.3`
- Added: `archiver@^7.0.1`
- Added: `sharp@^0.33.0` (optional)

## [0.1.1] - 2026-01-16

### Added
- Session Inbox view with tree structure
- Basic session management
- Plan file watching

## [0.1.0] - 2026-01-15

### Added
- Initial release
- Live preview of Claude Code plan files
- Mermaid diagram support
- Basic artifact viewing in sidebar and tabs
