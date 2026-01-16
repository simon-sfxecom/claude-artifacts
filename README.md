# Claude Artifacts

A VS Code extension for live preview of Claude Code plan files with interactive feedback capabilities.

## Features

- **Live Plan Preview**: Real-time rendering of Claude Code plan files (`~/.claude/plans/`)
- **Mermaid Diagram Support**: Automatic rendering of Mermaid diagrams in plans
- **Interactive Comments**: Click on headings, code blocks, or diagrams to add feedback
- **Quick Actions**: Approve plans with bypass or manual mode directly from the sidebar
- **Keyboard Shortcuts**: Fast workflow with `Cmd+Shift+1/2/3` (Mac) or `Ctrl+Shift+1/2/3` (Windows/Linux)

## Screenshots

The extension adds a sidebar view for plan preview:

- Headings are clickable for adding comments
- Code blocks show a `+` button on hover for comments
- Mermaid diagrams are also commentable
- Feedback badge shows pending comment count

## Usage

1. Run `/plan` in Claude Code to create a plan file
2. The extension automatically detects and displays the latest plan
3. Click on sections to add feedback comments
4. Use the action buttons to approve or send feedback:
   - **Accept All**: Approve with bypass permissions (sends "1")
   - **Manual**: Approve with manual edit review (sends "2")
   - **Feedback**: Send comments to Claude (sends "3" + formatted comments)

### Keyboard Shortcuts

| Action | Mac | Windows/Linux |
|--------|-----|---------------|
| Accept All (Bypass) | `Cmd+Shift+1` | `Ctrl+Shift+1` |
| Manual Approve | `Cmd+Shift+2` | `Ctrl+Shift+2` |
| Send Feedback | `Cmd+Shift+3` | `Ctrl+Shift+3` |

## Installation

### From Source

```bash
# Clone the repository
git clone https://github.com/sfx2k/claude-artifacts.git
cd claude-artifacts

# Install dependencies
npm install

# Compile
npm run compile

# Open in VS Code and press F5 to run
```

### Package as VSIX

```bash
npm install -g @vscode/vsce
vsce package
```

Then install the `.vsix` file in VS Code.

## Requirements

- VS Code 1.74.0 or higher
- Claude Code CLI (for creating plan files)

## Extension Settings

This extension currently has no configurable settings. It automatically detects Claude's permission mode from `~/.claude/settings.json`.

## Architecture

```
src/
├── extension.ts           # Extension entry point
├── artifactViewProvider.ts # Sidebar webview provider
├── artifactPanel.ts       # Full-screen panel view
├── planWatcher.ts         # File system watcher for plan files
├── renderer.ts            # Markdown/Mermaid rendering
├── claudeService.ts       # Communication with Claude Code
└── shared/                # Shared utilities
    ├── types.ts
    ├── claudeConfig.ts
    ├── formatters.ts
    ├── messageHandler.ts
    ├── styles.ts
    ├── webviewScripts.ts
    └── htmlTemplates.ts
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
