# Claude Artifacts

A VS Code extension for managing Claude Code sessions with live plan preview, multi-session support, and interactive feedback.

## Features

### Session Management
- **Session Inbox**: View all Claude Code sessions across projects
- **Multi-Session Support**: Run multiple Claude sessions simultaneously with proper terminal routing
- **Input Required Indicator**: ⚠️ icon shows when Claude is waiting for your input
- **Live Status Updates**: See current tool execution and activity in real-time
- **Resume Sessions**: Quick-resume any previous session

### Plan Preview
- **Live Plan Preview**: Real-time rendering of Claude Code plan files (`~/.claude/plans/`)
- **Mermaid Diagram Support**: Automatic rendering of all Mermaid diagram types
- **Split View**: Open multiple plans in separate tabs for comparison
- **Interactive Comments**: Click on headings, code blocks, or diagrams to add feedback
- **Text Selection Comments**: Select any text to add a comment

### Quick Actions
- **Approve Plans**: Bypass or manual mode directly from the sidebar
- **Send Feedback**: Collect comments and send to Claude
- **Keyboard Shortcuts**: Fast workflow with `Cmd+Shift+1/2/3`

## Screenshots

The extension adds a sidebar with two views:

**Sessions Panel:**
- Active sessions with live status (⚡ running tool, ⚠️ input required)
- Recent sessions grouped by project
- Quick actions: Resume, View Chat, Session Summary

**Plan Preview:**
- Rendered markdown with Mermaid diagrams
- Clickable sections for comments
- Action buttons for approval/feedback

## Usage

### Session Management

1. Open the **Claude Artifacts** sidebar (robot icon in activity bar)
2. View your active and recent sessions
3. Look for ⚠️ icon to see which sessions need input
4. Click **Resume** to continue a session in a new terminal

### Plan Review

1. Run `/plan` in Claude Code to create a plan file
2. The extension automatically displays the latest plan
3. Click on sections to add feedback comments
4. Use the action buttons:
   - **Accept All**: Approve with bypass permissions
   - **Manual**: Approve with manual edit review
   - **Feedback**: Send comments to Claude

### Keyboard Shortcuts

| Action | Mac | Windows/Linux |
|--------|-----|---------------|
| Accept All (Bypass) | `Cmd+Shift+1` | `Ctrl+Shift+1` |
| Manual Approve | `Cmd+Shift+2` | `Ctrl+Shift+2` |
| Send Feedback | `Cmd+Shift+3` | `Ctrl+Shift+3` |

## Installation

### From VSIX

```bash
# Build the extension
npm install
npm run release

# Install in VS Code
code --install-extension claude-artifacts-*.vsix
```

### From Source

```bash
git clone https://github.com/simon-sfxecom/claude-artifacts.git
cd claude-artifacts
npm install
npm run compile

# Press F5 in VS Code to run in development mode
```

### Auto-Versioning

```bash
npm run release        # Patch version (0.1.0 → 0.1.1)
npm run release:minor  # Minor version (0.1.0 → 0.2.0)
npm run release:major  # Major version (0.1.0 → 1.0.0)
```

## Requirements

- VS Code 1.74.0 or higher
- Claude Code CLI installed

## Known Issues

- Input required detection (⚠️) may not always trigger reliably
- Terminal auto-registration only works for terminals named "claude" or "node"

## Architecture

```
src/
├── extension.ts              # Extension entry point
├── artifactViewProvider.ts   # Sidebar webview provider
├── artifactPanel.ts          # Full-screen panel view
├── claudeService.ts          # Terminal communication
├── models/
│   └── session.ts            # Session/Project interfaces
├── services/
│   ├── planService.ts        # Plan file watcher
│   ├── sessionService.ts     # Session data from ~/.claude/
│   ├── worktreeService.ts    # Git worktree support
│   └── walkthroughGenerator.ts
├── views/
│   ├── sessionInboxProvider.ts  # Session tree view
│   ├── sessionDetailPanel.ts    # Session details webview
│   └── chatViewerPanel.ts       # Chat transcript viewer
└── shared/
    ├── styles.ts             # CSS styles
    ├── webviewScripts.ts     # Webview JavaScript
    ├── messageHandler.ts     # Webview message handling
    └── formatters.ts         # Time/text formatters
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
