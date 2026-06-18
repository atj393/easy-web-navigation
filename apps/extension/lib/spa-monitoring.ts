/**
 * SPA route-change detection for monitoring mode.
 *
 * Single-page apps change the URL and content without a full navigation. When
 * monitoring is active, this helper notices those route changes (via the
 * History API + popstate/hashchange) and schedules a throttled refresh so the
 * scan and visual helpers can be re-applied.
 *
 * Design constraints:
 *  - READ-ONLY: it observes navigation signals only; it never mutates page
 *    nodes. (History wrapping calls the original through and adds no behavior.)
 *  - Throttled: bursts of signals collapse into a single trailing refresh.
 *  - No continuous scanning, no heavy always-on MutationObserver.
 *  - Cleanup-safe: stop() restores wrapped History methods (best-effort) and a
 *    de-activation flag makes any leftover wrapper a pure pass-through.
 *  - Defensive: errors in the page's History or listeners never propagate.
 *
 * Dependencies (history / target / getLocation) are injectable so the helper is
 * unit-testable without a real browser.
 */

/** Default quiet-period before a route change triggers a refresh. */
export const DEFAULT_SPA_REFRESH_DELAY_MS = 400;

/** A subset of `Location` used to compute a route snapshot. */
export interface RouteLike {
  pathname?: string;
  search?: string;
  hash?: string;
}

type HistoryMethod = (...args: unknown[]) => unknown;

interface HistoryLike {
  pushState: HistoryMethod;
  replaceState: HistoryMethod;
}

interface EventTargetLike {
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

export interface SpaRouteMonitorOptions {
  /** Called (throttled) when a real route change is detected. */
  onRouteChange: () => void;
  /** Quiet-period before the refresh fires. Defaults to 400ms. */
  delayMs?: number;
  /** Returns the current location/route. Defaults to `globalThis.location`. */
  getLocation?: () => RouteLike | string | null | undefined;
  /** History object to wrap. Defaults to `globalThis.history`. */
  history?: HistoryLike;
  /** Event target for popstate/hashchange. Defaults to `globalThis`. */
  target?: EventTargetLike;
}

export interface SpaRouteMonitor {
  start(): void;
  stop(): void;
  isActive(): boolean;
}

/** Marker placed on our History wrappers to avoid double-wrapping. */
interface Marked {
  __ewnWrapped?: boolean;
}

/** Normalize a location (or string) into a comparable route string. */
export function normalizeRouteSnapshot(location: RouteLike | string | null | undefined): string {
  if (typeof location === "string") return location;
  if (!location) return "";
  const pathname = location.pathname ?? "";
  const search = location.search ?? "";
  const hash = location.hash ?? "";
  return `${pathname}${search}${hash}`;
}

/** Whether two route snapshots differ. */
export function hasRouteChanged(previous: string, next: string): boolean {
  return previous !== next;
}

/**
 * Trailing debounce: each `schedule()` resets the timer so a burst of route
 * signals results in a single `callback()` after `delayMs` of quiet.
 */
export function createThrottledRouteRefresh(
  callback: () => void,
  delayMs: number = DEFAULT_SPA_REFRESH_DELAY_MS,
): { schedule: () => void; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    schedule() {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        callback();
      }, delayMs);
    },
    cancel() {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}

/**
 * Create a route monitor. It is inert until `start()` and fully detaches on
 * `stop()`. Safe to construct even outside a browser (uses injected defaults).
 */
export function createSpaRouteMonitor(options: SpaRouteMonitorOptions): SpaRouteMonitor {
  const delayMs = options.delayMs ?? DEFAULT_SPA_REFRESH_DELAY_MS;
  const getLocation =
    options.getLocation ?? (() => (globalThis as { location?: RouteLike }).location ?? null);
  const history = options.history ?? (globalThis as { history?: HistoryLike }).history;
  const target = options.target ?? (globalThis as unknown as EventTargetLike);

  let active = false;
  let current = "";
  let originalPush: HistoryMethod | null = null;
  let originalReplace: HistoryMethod | null = null;

  const check = (): void => {
    const next = normalizeRouteSnapshot(getLocation());
    if (!hasRouteChanged(current, next)) return;
    current = next;
    try {
      options.onRouteChange();
    } catch {
      /* never let a refresh error propagate into the page */
    }
  };

  const throttle = createThrottledRouteRefresh(check, delayMs);
  const onSignal = (): void => throttle.schedule();

  function wrap(method: "pushState" | "replaceState"): HistoryMethod | null {
    if (!history) return null;
    const existing = history[method] as HistoryMethod & Marked;
    if (typeof existing !== "function" || existing.__ewnWrapped) return null;
    const original = existing;
    const wrapped = function (this: unknown, ...args: unknown[]): unknown {
      const result = original.apply(this, args);
      if (active) throttle.schedule();
      return result;
    } as HistoryMethod & Marked;
    wrapped.__ewnWrapped = true;
    history[method] = wrapped;
    return original;
  }

  function restore(method: "pushState" | "replaceState", original: HistoryMethod | null): void {
    if (!history || !original) return;
    const cur = history[method] as HistoryMethod & Marked;
    // Only restore if our wrapper is still the installed one.
    if (cur && cur.__ewnWrapped) history[method] = original;
  }

  return {
    start() {
      if (active) return;
      active = true;
      current = normalizeRouteSnapshot(getLocation());
      try {
        originalPush = wrap("pushState");
        originalReplace = wrap("replaceState");
      } catch {
        /* history not wrappable on this page */
      }
      try {
        target.addEventListener("popstate", onSignal);
        target.addEventListener("hashchange", onSignal);
      } catch {
        /* target without event support */
      }
    },
    stop() {
      if (!active) return;
      active = false;
      throttle.cancel();
      try {
        restore("pushState", originalPush);
        restore("replaceState", originalReplace);
      } catch {
        /* ignore */
      }
      originalPush = null;
      originalReplace = null;
      try {
        target.removeEventListener("popstate", onSignal);
        target.removeEventListener("hashchange", onSignal);
      } catch {
        /* ignore */
      }
    },
    isActive() {
      return active;
    },
  };
}
