/**
 * @keywise/focus-overlay
 *
 * Phase 0A: skeleton for an optional, user-initiated visual focus helper.
 *
 * Design constraint: the overlay is a passive visual aid. It must not steal
 * focus, must not change tab order, and uses restrained styling so it does
 * not fight the page's own focus indicators. Aggressive visuals are out of
 * scope for Phase 0A.
 */

export interface FocusOverlayOptions {
  /** Document the overlay attaches to. Defaults to the ambient document. */
  doc?: Document;
}

export class FocusOverlayController {
  private mounted = false;
  private readonly doc: Document | undefined;

  constructor(options: FocusOverlayOptions = {}) {
    this.doc = options.doc ?? globalThis.document;
  }

  /** Attach the overlay container. No-op rendering in Phase 0A. */
  mount(): void {
    if (this.mounted) return;
    this.mounted = true;
  }

  /** Detach the overlay and release any references. */
  unmount(): void {
    this.mounted = false;
  }

  isMounted(): boolean {
    return this.mounted;
  }

  /**
   * Reposition the overlay to track a given element.
   * Phase 0A: bounds computation and rendering are not implemented.
   */
  updateForElement(_el: Element | null): void {
    if (!this.mounted) return;
    // Intentionally left as a placeholder. See docs/limitations.md.
    void this.doc;
  }
}
