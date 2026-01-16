# Claude Code Project Rules

## Git Workflow

**IMPORTANT: Never push directly to `main` branch!**

Always create a Pull Request for any changes:

1. Create a new branch for your changes
2. Commit your work to the branch
3. Push the branch and create a PR
4. Wait for review/approval before merging

```bash
# Example workflow
git checkout -b feature/my-feature
# ... make changes ...
git add .
git commit -m "Add feature X"
git push -u origin feature/my-feature
gh pr create --title "Add feature X" --body "Description..."
```

## Project Structure

```
src/
├── extension.ts           # Main extension entry point
├── artifactViewProvider.ts # Sidebar webview provider
├── artifactPanel.ts       # Tab panel for artifacts
├── planWatcher.ts         # File watcher for plan files
├── models/                # TypeScript interfaces
├── services/              # Business logic (session, worktree, walkthrough)
├── views/                 # UI providers (session inbox, detail panel)
└── shared/                # Shared utilities
```

## Development

```bash
npm run compile    # Build TypeScript
npm run watch      # Watch mode
npx vsce package   # Build VSIX
```

## Testing

Press F5 in VS Code to launch Extension Development Host.
