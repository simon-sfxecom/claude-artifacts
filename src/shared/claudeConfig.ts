/**
 * Claude configuration utilities
 */

import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { PermissionMode, ClaudeSettings, ButtonLabel } from './types';

/**
 * Parse permission mode from settings content
 */
function parsePermissionMode(content: string): PermissionMode {
  try {
    const settings: ClaudeSettings = JSON.parse(content);
    const mode = settings.permissions?.defaultMode;

    if (mode === 'bypassPermissions') {
      return 'bypassPermissions';
    } else if (mode === 'plan') {
      return 'plan';
    } else if (mode === 'default' || !mode) {
      return 'default';
    }
  } catch {
    // JSON parse error
  }
  return 'unknown';
}

/**
 * Load permission mode from Claude settings (async)
 */
export async function loadPermissionModeAsync(): Promise<PermissionMode> {
  try {
    const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
    const content = await fsPromises.readFile(settingsPath, 'utf-8');
    return parsePermissionMode(content);
  } catch {
    return 'unknown';
  }
}

/**
 * Load permission mode from Claude settings (sync - for backwards compatibility)
 */
export function loadPermissionMode(): PermissionMode {
  try {
    const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
    if (fs.existsSync(settingsPath)) {
      const content = fs.readFileSync(settingsPath, 'utf-8');
      return parsePermissionMode(content);
    }
  } catch (error) {
    console.error('Failed to load Claude config:', error);
  }
  return 'unknown';
}

/**
 * Get button labels based on permission mode
 */
export function getApproveButtonLabel(mode: PermissionMode): ButtonLabel {
  switch (mode) {
    case 'bypassPermissions':
      return { text: 'Accept All', tooltip: 'Accept all edits (bypass permissions mode)' };
    case 'plan':
      return { text: 'Approve Plan', tooltip: 'Approve plan (plan mode - will still ask for permissions)' };
    case 'default':
      return { text: 'Approve', tooltip: 'Approve (will ask for permissions on each edit)' };
    default:
      return { text: 'Approve', tooltip: 'Approve plan (Option 1)' };
  }
}

/**
 * Get mode indicator text for badge display
 */
export function getModeIndicator(mode: PermissionMode): string {
  if (mode === 'unknown') return '';
  return mode === 'bypassPermissions' ? 'Bypass' : mode;
}
