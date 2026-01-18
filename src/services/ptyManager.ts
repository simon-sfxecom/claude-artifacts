import * as pty from 'node-pty';
import * as os from 'os';

/**
 * PTY session information
 */
export interface PTYSession {
  sessionId: string;
  ptyProcess: pty.IPty;
  pid: number;
  cwd: string;
  createdAt: number;
  outputBuffer: string[];
  listeners: Set<(data: string) => void>;
}

/**
 * PTY Manager - Manages Claude CLI pseudo-terminal processes
 *
 * This service spawns and manages Claude CLI sessions as PTY processes,
 * enabling full terminal emulation in webviews via xterm.js.
 */
export class PTYManager {
  private sessions: Map<string, PTYSession> = new Map();
  private readonly MAX_BUFFER_SIZE = 10000; // lines
  private readonly MAX_LINE_LENGTH = 10000; // characters per line
  private readonly CLEANUP_TIMEOUT = 5000; // 5 seconds

  /**
   * Spawn a Claude CLI session via node-pty
   */
  spawn(sessionId: string, cwd: string, args: string[] = []): PTYSession {
    // Validate session ID to prevent shell injection
    if (!this.isValidSessionId(sessionId)) {
      throw new Error('Invalid session ID format');
    }

    // Check if session already exists
    if (this.sessions.has(sessionId)) {
      throw new Error(`PTY session ${sessionId} already exists`);
    }

    // Determine shell
    const shell = os.platform() === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/bash';

    // Spawn PTY process
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 30,
      cwd,
      env: process.env as { [key: string]: string }
    });

    // Create session object
    const session: PTYSession = {
      sessionId,
      ptyProcess,
      pid: ptyProcess.pid,
      cwd,
      createdAt: Date.now(),
      outputBuffer: [],
      listeners: new Set()
    };

    // Handle PTY output
    ptyProcess.onData((data: string) => {
      // Truncate very long lines to prevent memory issues
      let processedData = data;
      if (data.length > this.MAX_LINE_LENGTH) {
        processedData = data.substring(0, this.MAX_LINE_LENGTH) + '\n[... line truncated]\n';
      }

      // Add to buffer with size limit
      session.outputBuffer.push(processedData);
      if (session.outputBuffer.length > this.MAX_BUFFER_SIZE) {
        session.outputBuffer.shift();
      }

      // Notify all listeners
      session.listeners.forEach(listener => listener(processedData));
    });

    // Handle PTY exit
    ptyProcess.onExit(({ exitCode, signal }) => {
      console.log(`PTY session ${sessionId} exited with code ${exitCode}, signal ${signal}`);
      // Clean up after delay
      setTimeout(() => this.dispose(sessionId), this.CLEANUP_TIMEOUT);
    });

    // Store session
    this.sessions.set(sessionId, session);

    // Send initial command to resume Claude session
    if (args.length > 0) {
      const command = `claude ${args.join(' ')}\n`;
      ptyProcess.write(command);
    }

    return session;
  }

  /**
   * Start a new Claude session in PTY
   */
  newSession(sessionId: string, cwd: string): PTYSession {
    return this.spawn(sessionId, cwd, []); // No args = new session
  }

  /**
   * Resume a Claude session in PTY
   */
  resumeSession(sessionId: string, cwd: string): PTYSession {
    return this.spawn(sessionId, cwd, ['--resume', sessionId]);
  }

  /**
   * Write input to PTY session
   */
  write(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`PTY session ${sessionId} not found`);
    }
    session.ptyProcess.write(data);
  }

  /**
   * Resize PTY terminal
   */
  resize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`PTY session ${sessionId} not found`);
    }
    session.ptyProcess.resize(cols, rows);
  }

  /**
   * Add output listener
   */
  addListener(sessionId: string, listener: (data: string) => void): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`PTY session ${sessionId} not found`);
    }
    session.listeners.add(listener);
  }

  /**
   * Remove output listener
   */
  removeListener(sessionId: string, listener: (data: string) => void): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.listeners.delete(listener);
    }
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): PTYSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all active sessions
   */
  getAllSessions(): PTYSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get output buffer for session
   */
  getOutputBuffer(sessionId: string): string[] {
    const session = this.sessions.get(sessionId);
    return session ? [...session.outputBuffer] : [];
  }

  /**
   * Kill PTY process
   */
  kill(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      try {
        session.ptyProcess.kill();
      } catch (error) {
        console.error(`Failed to kill PTY session ${sessionId}:`, error);
      }
    }
  }

  /**
   * Dispose PTY session and clean up resources
   */
  dispose(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      // Kill process if still running
      try {
        session.ptyProcess.kill();
      } catch (error) {
        // Process may already be dead
      }

      // Clear listeners
      session.listeners.clear();

      // Remove from map
      this.sessions.delete(sessionId);
    }
  }

  /**
   * Dispose all sessions
   */
  disposeAll(): void {
    const sessionIds = Array.from(this.sessions.keys());
    sessionIds.forEach(id => this.dispose(id));
  }

  /**
   * Validate session ID format
   * Claude session IDs are alphanumeric with underscores/hyphens
   * Max length 128 to prevent buffer issues
   */
  private isValidSessionId(id: string): boolean {
    return id.length > 0 && id.length <= 128 && /^[a-zA-Z0-9_-]+$/.test(id);
  }
}

// Singleton instance
let ptyManager: PTYManager | null = null;

export function getPTYManager(): PTYManager {
  if (!ptyManager) {
    ptyManager = new PTYManager();
  }
  return ptyManager;
}

export function disposePTYManager(): void {
  if (ptyManager) {
    ptyManager.disposeAll();
    ptyManager = null;
  }
}
