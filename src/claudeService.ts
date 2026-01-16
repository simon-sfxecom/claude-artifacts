import * as vscode from 'vscode';

/**
 * Delay between sending a choice number and the feedback text to Claude.
 * Claude Code needs time to process the choice selection before accepting text input.
 */
export const CLAUDE_CHOICE_FEEDBACK_DELAY_MS = 300;

export class ClaudeService {
  private _outputChannel: vscode.OutputChannel;

  constructor() {
    this._outputChannel = vscode.window.createOutputChannel('Claude Artifacts');
  }

  /**
   * Find active Claude Code terminal
   * Claude Code runs as a node process, so terminals named "node" are valid
   * We just need to exclude the Extension Development Host debug terminal
   */
  private _findClaudeTerminal(): vscode.Terminal | undefined {
    const terminals = vscode.window.terminals;

    // Look for terminals - Claude Code shows up as "node"
    // We want to find a terminal that's running Claude, not the extension debug process
    for (const terminal of terminals) {
      const name = terminal.name.toLowerCase();

      // Skip extension development terminals
      if (name.includes('extension development') || name.includes('debug console')) {
        continue;
      }

      // Accept shell terminals and node (which is Claude Code)
      if (
        name.includes('claude') ||
        name === 'node' ||
        name === 'bash' ||
        name === 'zsh' ||
        name === 'fish' ||
        name === 'sh' ||
        name === 'pwsh' ||
        name === 'powershell' ||
        name.includes('task')
      ) {
        return terminal;
      }
    }

    // Fallback: return any terminal that's not a debug terminal
    for (const terminal of terminals) {
      const name = terminal.name.toLowerCase();
      if (!name.includes('extension') && !name.includes('debug')) {
        return terminal;
      }
    }

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
    await this._delay(50);
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
    this._outputChannel.appendLine(`Sequence: ${JSON.stringify(sequence)}`);

    let terminal = vscode.window.activeTerminal;
    if (!terminal) {
      terminal = this._findClaudeTerminal();
    }

    if (!terminal) {
      const availableTerminals = this.listTerminals();
      throw new Error(
        'No Claude Code terminal found. ' +
        'Please ensure Claude Code is running in a terminal.' +
        (availableTerminals.length > 0
          ? ` Available terminals: ${availableTerminals.join(', ')}`
          : ' No terminals are open.')
      );
    }

    // Focus terminal
    terminal.show(true);
    await this._delay(50);

    // Try multiple methods
    this._outputChannel.appendLine(`Method 1: sendSequence command`);
    await vscode.commands.executeCommand('workbench.action.terminal.sendSequence', {
      text: sequence
    });

    this._outputChannel.appendLine(`✓ Sent`);
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
