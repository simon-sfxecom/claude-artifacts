# GitHub Actions Workflows

This directory contains automated workflows for the Claude Artifacts extension.

## Workflows

### CI (`ci.yml`)

**Triggers**: Push to `main`/`develop` branches, Pull Requests

**Jobs**:
1. **Type Check & Lint**
   - TypeScript type checking (`tsc --noEmit`)
   - Strict mode check (optional, shows warnings)
   - ESLint validation
   - Unused exports check (via ts-prune)
   - **Blocks build if types are invalid**

2. **Build & Package** (Matrix: Node 18, 20)
   - Install dependencies
   - TypeScript type check
   - Code formatting check (Prettier, if configured)
   - Lint code
   - Compile TypeScript
   - Package VSIX
   - Upload artifacts
   - **Runs only if type-check passes**

3. **Validate**
   - Download VSIX
   - Install VS Code CLI
   - Install extension
   - Verify installation

**Purpose**: Ensures code quality, type safety, and successful builds on every push/PR.

**Badge**: [![CI](https://github.com/simon-sfxecom/claude-artifacts/actions/workflows/ci.yml/badge.svg)](https://github.com/simon-sfxecom/claude-artifacts/actions/workflows/ci.yml)

---

### Release (`release.yml`)

**Triggers**:
- Git tags matching `v*.*.*` (e.g., `v0.1.5`)
- Manual workflow dispatch with version input

**Steps**:
1. Install dependencies
2. Compile TypeScript
3. Run tests (optional)
4. Package VSIX
5. Create GitHub Release
6. Upload VSIX as release asset
7. Publish to VS Code Marketplace (if `VSCE_PAT` secret is set)

**Usage**:

**Option 1: Git Tag (Automatic)**
```bash
# Bump version in package.json
npm version patch  # or minor, major

# Push with tags
git push --follow-tags

# GitHub Actions will automatically create a release
```

**Option 2: Manual Trigger**
1. Go to Actions tab on GitHub
2. Select "Release Extension" workflow
3. Click "Run workflow"
4. Enter version (e.g., `0.1.5`)
5. Click "Run workflow"

---

## Secrets

To publish to VS Code Marketplace, add this secret to your GitHub repository:

### `VSCE_PAT`

Personal Access Token for publishing to VS Code Marketplace.

**How to create**:
1. Go to https://dev.azure.com/
2. Create a Personal Access Token with **Marketplace (Manage)** scope
3. Add as GitHub Secret: Settings → Secrets → Actions → New repository secret
4. Name: `VSCE_PAT`
5. Value: Your token

**Note**: Publishing is optional. If the secret is not set, the workflow will skip publishing and only create a GitHub Release.

---

## Local Testing

### Quick Quality Check

Run all CI checks locally before pushing:

```bash
# Run all checks (type-check, lint, compile)
npm run ci

# Or run individually:
npm run type-check        # TypeScript type checking
npm run type-check:strict # Strict mode (optional)
npm run lint              # ESLint
npm run compile           # Build
```

### Full Build & Package

Test the complete build pipeline:

```bash
# Install dependencies
npm ci

# Run quality checks
npm run ci

# Package VSIX
npx vsce package --allow-missing-repository

# Install locally
code --install-extension claude-artifacts-*.vsix
```

### Testing with code-server

If testing with code-server, use environment variables for credentials:

```bash
# Set password via environment variable
export CODE_SERVER_PASSWORD="your-password-here"

# Use in scripts
const password = process.env.CODE_SERVER_PASSWORD || 'default-password';
```

**Never commit hardcoded credentials to the repository.**

---

## Troubleshooting

### Build Fails on CI

- Check TypeScript compilation errors in workflow logs
- Ensure all dependencies are in `package.json`
- Run `npm ci && npm run compile` locally first

### Release Fails

- Ensure version in `package.json` matches the tag
- Check that tag follows `v*.*.*` format
- Verify `GITHUB_TOKEN` permissions (automatically provided)

### Marketplace Publishing Fails

- Verify `VSCE_PAT` secret is set correctly
- Check token has **Marketplace (Manage)** scope
- Ensure publisher name matches in `package.json`

---

## Version Bumping

Use npm version commands to automatically update `package.json`:

```bash
# Patch version (0.1.5 → 0.1.6)
npm version patch

# Minor version (0.1.5 → 0.2.0)
npm version minor

# Major version (0.1.5 → 1.0.0)
npm version major
```

These commands:
1. Update version in `package.json`
2. Create a git commit
3. Create a git tag

Then push:
```bash
git push --follow-tags
```

The release workflow will automatically trigger.
