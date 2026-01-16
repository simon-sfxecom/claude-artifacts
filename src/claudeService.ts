import * as vscode from 'vscode';

// Timing constants
const TERMINAL_FOCUS_DELAY_MS = 50;
const DECLINE_REASON_DELAY_MS = 500;

/**
 * Delay between sending a choice number and the feedback text to Claude.
 * Claude Code needs time to process the choice selection before accepting text input.
 */
export const CLAUDE_CHOICE_FEEDBACK_DELAY_MS = 300;

/**
 * Tracks which terminal belongs to which Claude session
 * Key: session ID (e.g., "toasty-colecashtari")
 * Value: Terminal instance
 */
const sessionTerminalMap: Map<string, vscode.Terminal> = new Map();

/**
 * Disposables for terminal close listeners - cleaned up on deactivate
 */
const terminalDisposables: vscode.Disposable[] = [];

/**
 * Register a terminal for a specific session
 */
export function registerSessionTerminal(sessionId: string, terminal: vscode.Terminal): void {
  sessionTerminalMap.set(sessionId, terminal);

  // Clean up when terminal closes
  const disposable = vscode.window.onDidCloseTerminal(closedTerminal => {
    if (closedTerminal === terminal) {
      sessionTerminalMap.delete(sessionId);
      const idx = terminalDisposables.indexOf(disposable);
      if (idx >= 0) terminalDisposables.splice(idx, 1);
      disposable.dispose();
    }
  });
  terminalDisposables.push(disposable);
}

/**
 * Get terminal for a specific session
 */
export function getSessionTerminal(sessionId: string): vscode.Terminal | undefined {
  const terminal = sessionTerminalMap.get(sessionId);
  if (!terminal) {
    return undefined;
  }
  // Verify terminal is still valid
  if (vscode.window.terminals.includes(terminal)) {
    return terminal;
  }
  // Clean up stale reference
  sessionTerminalMap.delete(sessionId);
  return undefined;
}

/**
 * Clean up all terminal tracking resources
 * Call this from extension deactivate
 */
export function disposeTerminalTracking(): void {
  terminalDisposables.forEach(d => d.dispose());
  terminalDisposables.length = 0;
  sessionTerminalMap.clear();
}

export class ClaudeService {
  private _outputChannel: vscode.OutputChannel;
  private _targetSessionId: string | undefined;

  constructor(sessionId?: string) {
    this._outputChannel = vscode.window.createOutputChannel('Claude Artifacts');
    this._targetSessionId = sessionId;
  }

  /**
   * Set the target session for this service instance
   */
  public setTargetSession(sessionId: string): void {
    this._targetSessionId = sessionId;
  }

  /**
   * Get the current target session ID
   */
  public getTargetSession(): string | undefined {
    return this._targetSessionId;
  }

  /**
   * Find Claude Code terminal for the target session
   * First tries the registered session terminal, then falls back to Claude-specific terminals only
   */
  private _findClaudeTerminal(): vscode.Terminal | undefined {
    // First: try to find terminal by session ID (registered via Resume Session)
    if (this._targetSessionId) {
      const sessionTerminal = getSessionTerminal(this._targetSessionId);
      if (sessionTerminal) {
        this._outputChannel.appendLine(`Found registered terminal for session: ${this._targetSessionId}`);
        return sessionTerminal;
      }

      // Try to find by terminal name containing session ID
      for (const terminal of vscode.window.terminals) {
        if (terminal.name.toLowerCase().includes(this._targetSessionId.toLowerCase())) {
          this._outputChannel.appendLine(`Found terminal by name match: ${terminal.name}`);
          // Register it for future use
          registerSessionTerminal(this._targetSessionId, terminal);
          return terminal;
        }
      }
    }

    // Fallback: find terminals that are likely running Claude
    // ONLY accept terminals with "claude" in the name - don't send to random shells!
    const terminals = vscode.window.terminals;

    for (const terminal of terminals) {
      const name = terminal.name.toLowerCase();

      // Only accept terminals explicitly named "claude" or similar
      if (name.includes('claude')) {
        this._outputChannel.appendLine(`Found Claude terminal: ${terminal.name}`);
        return terminal;
      }
    }

    // Also check for "node" which is how Claude Code appears sometimes
    // But only if it's the active terminal (user likely has it focused)
    const activeTerminal = vscode.window.activeTerminal;
    if (activeTerminal) {
      const name = activeTerminal.name.toLowerCase();
      if (name === 'node' || name.includes('claude')) {
        this._outputChannel.appendLine(`Using active terminal: ${activeTerminal.name}`);
        return activeTerminal;
      }
    }

    // Don't return random shells - this causes the bug where input goes to wrong terminal
    this._outputChannel.appendLine(`No Claude terminal found for session: ${this._targetSessionId || 'unknown'}`);
    return undefined;
  }

  /**
   * Send text to Claude Code terminal
   * Uses VS Code's sendSequence command for TUI compatibility
   */
  public async sendToTerminal(text: string): Promise<void> {
    this._outputChannel.appendLine(`\n--- Sending to Terminal ---`);
    this._outputChannel.appendLine(`Text: "${text}"`);

    // Just use sendRawSequence - it works!
    // Send text without Enter first, then Enter separately
    await this.sendRawSequence(text);
    await this._delay(TERMINAL_FOCUS_DELAY_MS);
    await this.sendRawSequence('\r');
  }

  private _delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Approve the current plan - sends "y" or "yes" which Claude understands
   */
  public async approvePlan(): Promise<void> {
    // In plan mode, "y" or "yes" approves the plan
    await this.sendToTerminal('y');
  }

  /**
   * Decline the current plan with optional reason
   */
  public async declinePlan(reason?: string): Promise<void> {
    await this.sendToTerminal('n');
    if (reason) {
      await this._delay(500);
      await this.sendToTerminal(reason);
    }
  }

  /**
   * Ask Claude for clarification - just sends the question
   */
  public async askForClarification(question: string): Promise<void> {
    await this.sendToTerminal(question);
  }

  /**
   * Send a general message/feedback to Claude
   */
  public async sendFeedback(feedback: string): Promise<void> {
    await this.sendToTerminal(feedback);
  }

  /**
   * Send a numbered choice (1, 2, 3, etc.) - useful for plan mode options
   */
  public async sendChoice(choice: number): Promise<void> {
    await this.sendToTerminal(choice.toString());
  }

  /**
   * Send a choice followed by feedback text with appropriate delay.
   * Combines sendChoice and sendFeedback with the necessary delay between them.
   */
  public async sendChoiceWithFeedback(choice: number, feedback: string): Promise<void> {
    await this.sendChoice(choice);
    await this._delay(CLAUDE_CHOICE_FEEDBACK_DELAY_MS);
    await this.sendFeedback(feedback);
  }

  /**
   * Quick actions for common responses
   */
  public async sendYes(): Promise<void> {
    await this.sendToTerminal('y');
  }

  public async sendNo(): Promise<void> {
    await this.sendToTerminal('n');
  }

  /**
   * Send arrow key - for testing TUI interaction
   * Arrow keys are ANSI escape sequences
   */
  public async sendArrowUp(): Promise<void> {
    await this.sendRawSequence('\x1b[A'); // ESC [ A
  }

  public async sendArrowDown(): Promise<void> {
    await this.sendRawSequence('\x1b[B'); // ESC [ B
  }

  public async sendEnter(): Promise<void> {
    await this.sendRawSequence('\r'); // Carriage return
  }

  /**
   * Send raw escape sequence directly to terminal
   */
  public async sendRawSequence(sequence: string): Promise<void> {
    this._outputChannel.appendLine(`\n--- Sending Raw Sequence ---`);
    this._outputChannel.appendLine(`Session: ${this._targetSessionId || 'none'}`);
    this._outputChannel.appendLine(`Sequence: ${JSON.stringify(sequence)}`);

    // First try to find the correct Claude terminal
    let terminal = this._findClaudeTerminal();

    // If no Claude terminal found, use the active terminal if user has one focused
    // This allows sending to a manually started Claude session
    if (!terminal) {
      const activeTerminal = vscode.window.activeTerminal;
      if (activeTerminal) {
        this._outputChannel.appendLine(`Using active terminal: ${activeTerminal.name}`);
        terminal = activeTerminal;

        // Register it for this session so future sends go to the same terminal
        if (this._targetSessionId) {
          registerSessionTerminal(this._targetSessionId, activeTerminal);
        }
      }
    }

    if (!terminal) {
      const sessionInfo = this._targetSessionId
        ? `"${this._targetSessionId}"`
        : 'this session';
      throw new Error(
        `No terminal found for ${sessionInfo}. ` +
        'Start the session via "Resume Session" button in the Sessions panel, ' +
        'so the extension can track which terminal belongs to which plan.'
      );
    }

    this._outputChannel.appendLine(`Using terminal: ${terminal.name}`);

    // Focus terminal first to ensure it's active
    terminal.show(true);
    await this._delay(TERMINAL_FOCUS_DELAY_MS);

    // Use terminal.sendText() for direct sending to specific terminal
    // This avoids race conditions with workbench.action.terminal.sendSequence
    // which sends to the currently focused terminal (could change between find and send)
    this._outputChannel.appendLine(`Sending via terminal.sendText()`);

    // For raw sequences like escape codes, we need to handle them specially
    // terminal.sendText() adds a newline by default, so we use addNewLine: false for raw sequences
    const isRawEscapeSequence = sequence.startsWith('\x1b') || sequence === '\r';

    if (isRawEscapeSequence) {
      // For escape sequences, we still need sendSequence as sendText doesn't handle them well
      // But we've already focused the correct terminal above
      await vscode.commands.executeCommand('workbench.action.terminal.sendSequence', {
        text: sequence
      });
    } else {
      // For regular text, use sendText which is more reliable
      terminal.sendText(sequence, false);
    }

    this._outputChannel.appendLine(`✓ Sent to ${terminal.name}`);
  }

  /**
   * List available terminals for debugging
   */
  public listTerminals(): string[] {
    return vscode.window.terminals.map(t => t.name);
  }

  /**
   * Show output channel
   */
  public showOutput(): void {
    this._outputChannel.show();
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this._outputChannel.dispose();
  }
}
