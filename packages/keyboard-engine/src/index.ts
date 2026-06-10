/**
 * @keywise/keyboard-engine
 *
 * Phase 0A: skeletons only. These classes describe how KeyWise Web will
 * observe keyboard interaction in later phases.
 *
 * Design constraint: KeyWise Web does NOT override global keyboard behavior.
 * It observes focus movement and records tab order; it never hijacks Tab,
 * arrow keys, or shortcuts away from the page or the user's screen reader.
 */

/** Observes which element currently holds focus. No-op until started. */
export class FocusTracker {
  private active = false;

  start(): void {
    // Phase 0A: intentionally does not attach listeners.
    this.active = true;
  }

  stop(): void {
    this.active = false;
  }

  isActive(): boolean {
    return this.active;
  }

  /** The element believed to currently have focus, if known. */
  getCurrentElement(): Element | null {
    return null;
  }
}

/** A single recorded step along the keyboard tab path. */
export interface TabPathStep {
  index: number;
  selector: string;
  preview: string;
}

/** Records the order in which elements receive focus while tabbing. */
export class TabPathRecorder {
  private steps: TabPathStep[] = [];

  reset(): void {
    this.steps = [];
  }

  /** Append a step. Real recording is wired up in a later phase. */
  record(step: TabPathStep): void {
    this.steps.push(step);
  }

  getPath(): readonly TabPathStep[] {
    return this.steps;
  }
}

/**
 * High-level controller that will coordinate optional, user-initiated
 * keyboard assistance. In Phase 0A it only tracks enabled state.
 */
export class KeyboardAssistController {
  private enabled = false;
  readonly focusTracker = new FocusTracker();
  readonly tabPath = new TabPathRecorder();

  enable(): void {
    this.enabled = true;
    this.focusTracker.start();
  }

  disable(): void {
    this.enabled = false;
    this.focusTracker.stop();
    this.tabPath.reset();
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}
