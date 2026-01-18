# Claude Artifacts

[![CI](https://github.com/simon-sfxecom/claude-artifacts/actions/workflows/ci.yml/badge.svg)](https://github.com/simon-sfxecom/claude-artifacts/actions/workflows/ci.yml)
[![Release](https://github.com/simon-sfxecom/claude-artifacts/actions/workflows/release.yml/badge.svg)](https://github.com/simon-sfxecom/claude-artifacts/actions/workflows/release.yml)
[![Version](https://img.shields.io/github/v/release/simon-sfxecom/claude-artifacts?label=version)](https://github.com/simon-sfxecom/claude-artifacts/releases)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A VS Code extension for managing Claude Code sessions with Mission Control dashboard, embedded terminals, automatic screenshot capture, and rich media walkthroughs.

## ✨ Features

### 🎯 Mission Control Dashboard
- **Rich Card-Based UI**: Google Antigravity-inspired dashboard for managing all sessions
- **3-Column Layout**: Projects sidebar, session cards, and details panel
- **Real-Time Updates**: 2-second polling for live session status
- **Advanced Filtering**: Filter by status (Active/Paused/Completed), project, or search text
- **Quick Actions**: Resume, View Details, Summary, Approve - all from session cards
- **Keyboard Shortcut**: `Cmd+Shift+M` (Mac) or `Ctrl+Shift+M` (Windows/Linux)

### 💻 IDE View - Embedded Terminals
- **xterm.js Integration**: Full-featured terminal emulator in VS Code tabs
- **PTY Process Management**: Direct Claude CLI subprocess control via node-pty
- **Split View Layout**: Terminal + Live Plan Preview sidebar
- **Quick Actions**: Approve, Decline, Pause, Send Feedback buttons
- **Multi-Session Tabs**: Open multiple Claude sessions as independent tabs
- **Copy/Paste Support**: Full terminal features with 10,000 line scrollback

### 📸 Automatic Media Capture
- **Smart Screenshot Triggers**:
  - File modifications (Edit/Write tools)
  - Test execution (npm test, pytest, etc.)
  - Errors and failures
  - Plan approvals
  - Manual capture on demand
- **Cross-Platform Support**:
  - Linux: scrot, gnome-screenshot, ImageMagick
  - macOS: screencapture (native)
  - Windows: PowerShell
  - Fallback: screenshot-desktop package

### 🎥 Screen Recording
- **FFmpeg Integration**: High-quality VP9/WebM video recording
- **Platform-Specific Commands**: Optimized for Linux/macOS/Windows
- **Status Bar Indicator**: Live recording duration display
- **Quality Settings**: CRF 28 for optimal size/quality balance
- **Easy Control**: Start/Stop from context menu or status bar

### 🖼️ Rich Walkthrough Viewer
- **Timeline Navigation**: Visual event markers for all captures
- **Media Gallery**: Grid layout with lazy loading
- **Lightbox Viewer**: Click to expand images
- **Event Badges**: Color-coded markers (file edits, tests, errors, approvals)
- **Statistics Dashboard**: Total captures, screenshots, videos, comments
- **Comment System**: Add annotations to any media
- **Export Options**: PDF (coming soon) and Zip archive

### 📝 Session Management
- **Session Inbox**: View all Claude Code sessions across projects
- **Multi-Session Support**: Run multiple Claude sessions simultaneously
- **Input Required Indicator**: ⚠️ icon shows when Claude needs input
- **Live Status Updates**: See current tool execution in real-time
- **Resume Sessions**: Quick-resume any previous session

### 📋 Plan Preview
- **Live Plan Preview**: Real-time rendering of plan files
- **Mermaid Diagram Support**: Automatic rendering of all diagram types
- **Split View**: Open multiple plans in separate tabs
- **Interactive Comments**: Click sections to add feedback
- **Text Selection Comments**: Select any text to comment

## 🚀 Quick Start

### Installation

```bash
# Build the extension
npm install
npm run release

# Install in VS Code
code --install-extension claude-artifacts-*.vsix
```

### Optional: Video Recording Setup

For screen recording features, install FFmpeg:

**macOS:**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt install ffmpeg
```

**Windows:**
Download from [ffmpeg.org](https://ffmpeg.org/download.html) and add to PATH.

## 📖 Usage Guide

### Mission Control

1. Press `Cmd+Shift+M` (Mac) or `Ctrl+Shift+M` (Windows/Linux)
2. View all sessions in card format
3. Filter by status or search
4. Click cards for quick actions

### Open Session in Tab

1. Right-click any session in the Session Inbox
2. Select "Open Session in Tab"
3. Interactive terminal with live plan preview

### Automatic Screenshots

Screenshots are captured automatically during:
- File edits
- Test runs
- Errors
- Plan approvals

View captures: Right-click session → "View Session Summary"

### Screen Recording

1. Right-click session → "Start Screen Recording"
2. Perform your actions
3. Click status bar or right-click → "Stop Screen Recording"
4. View in walkthrough viewer

### Rich Walkthrough

1. Right-click session → "View Session Summary"
2. Browse timeline and media gallery
3. Click images for lightbox view
4. Add comments to any media
5. Export as Zip archive

## ⌨️ Keyboard Shortcuts

| Action | Mac | Windows/Linux |
|--------|-----|---------------|
| Mission Control | `Cmd+Shift+M` | `Ctrl+Shift+M` |
| Accept All (Bypass) | `Cmd+Shift+1` | `Ctrl+Shift+1` |
| Manual Approve | `Cmd+Shift+2` | `Ctrl+Shift+2` |
| Send Feedback | `Cmd+Shift+3` | `Ctrl+Shift+3` |

## 🏗️ Architecture

```
src/
├── extension.ts              # Extension entry point
├── models/
│   ├── session.ts            # Session/Project interfaces
│   └── missionControl.ts     # Mission Control data models
├── services/
│   ├── planService.ts        # Plan file watcher
│   ├── sessionService.ts     # Session data from ~/.claude/
│   ├── sessionAggregator.ts  # Session data enrichment
│   ├── thumbnailGenerator.ts # Preview generation
│   ├── ptyManager.ts         # PTY process management
│   ├── mediaCaptureService.ts # Screenshot capture
│   ├── sessionMonitor.ts     # Transcript monitoring
│   ├── videoRecordingService.ts # FFmpeg recording
│   ├── worktreeService.ts    # Git worktree support
│   └── walkthroughGenerator.ts # Summary generation
├── views/
│   ├── missionControlPanel.ts    # Mission Control dashboard
│   ├── claudeSessionPanel.ts     # Embedded terminal view
│   ├── walkthroughViewerPanel.ts # Rich media viewer
│   ├── sessionInboxProvider.ts   # Session tree view
│   ├── sessionDetailPanel.ts     # Session details
│   └── chatViewerPanel.ts        # Chat transcript viewer
└── shared/
    ├── missionControlWebview.ts  # Mission Control HTML/CSS
    ├── terminalWebview.ts        # Terminal view HTML/CSS
    ├── walkthroughWebview.ts     # Walkthrough HTML/CSS
    ├── styles.ts                 # Shared CSS
    ├── webviewScripts.ts         # Shared JavaScript
    └── formatters.ts             # Utilities
```

## 📦 Dependencies

### Runtime Dependencies
- `@anthropic-ai/claude-code`: Claude Code integration
- `marked`: Markdown rendering
- `node-pty`: Pseudo-terminal for subprocess management
- `@xterm/xterm`: Terminal emulator
- `@xterm/addon-fit`: Terminal auto-resize
- `@xterm/addon-webgl`: GPU-accelerated rendering
- `screenshot-desktop`: Fallback screenshot tool
- `archiver`: Zip archive creation

### Optional Dependencies
- `sharp`: Image processing (for thumbnails)

### External Tools (Optional)
- **FFmpeg**: For video recording
- **scrot/gnome-screenshot**: Linux screenshot tools (fallback to npm package if not installed)

## 🔧 Configuration

The extension works out-of-the-box with Claude Code. All data is stored in:
- Plans: `~/.claude/plans/*.md`
- Sessions: `~/.claude/projects/*/sessions/*.jsonl`
- Walkthroughs: `~/.claude/walkthroughs/{sessionId}/`

## 🐛 Known Issues

- Video recording requires FFmpeg installation
- Wayland support on Linux uses X11grab (may require X11 compatibility)
- macOS screen recording requires Screen Recording permission (System Preferences → Privacy)
- Plan sidebar in embedded terminal shows most recent plan (not session-specific yet)

## 🎯 Performance

- Mission Control updates every 2 seconds
- Session data cached with 5-second TTL
- PTY output buffer: 10,000 lines with line length limit (10K chars)
- Screenshot triggers use file hash checking to avoid duplicates
- Media gallery uses lazy loading for large collections

## 🔒 Security

- Session ID validation prevents shell injection
- Path validation for file operations
- HTML escaping prevents XSS
- CSP headers for all webviews
- No shell commands with user input

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development

```bash
# Clone and install
git clone https://github.com/simon-sfxecom/claude-artifacts.git
cd claude-artifacts
npm install

# Compile
npm run compile

# Run in development mode
# Press F5 in VS Code

# Build VSIX package
npx vsce package --allow-missing-repository
```

### Automated Builds & Releases

This project uses GitHub Actions for CI/CD:

**Continuous Integration** (`.github/workflows/ci.yml`):
- Runs on every push and pull request
- Tests on Node 18 and 20
- Compiles TypeScript
- Packages VSIX
- Verifies installation

**Release** (`.github/workflows/release.yml`):
- Triggers on git tags (`v*.*.*`) or manual dispatch
- Creates GitHub Release with VSIX asset
- Optionally publishes to VS Code Marketplace

**Create a release**:
```bash
# Bump version and create tag
npm version patch  # 0.1.5 → 0.1.6
# or: npm version minor/major

# Push with tags
git push --follow-tags

# GitHub Actions will automatically:
# 1. Build VSIX
# 2. Create GitHub Release
# 3. Upload VSIX to release
```

See [`.github/workflows/README.md`](.github/workflows/README.md) for details.

## 📄 License

MIT

## 🙏 Acknowledgments

- Inspired by Google Antigravity IDE
- Built on Claude Code by Anthropic
- Uses xterm.js for terminal emulation
- FFmpeg for video recording
