import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  normalizeRouteSnapshot,
  hasRouteChanged,
  createThrottledRouteRefresh,
  createSpaRouteMonitor,
  DEFAULT_SPA_REFRESH_DELAY_MS,
} from "./spa-monitoring";

describe("normalizeRouteSnapshot", () => {
  it("passes strings through", () => {
    expect(normalizeRouteSnapshot("/a?b#c")).toBe("/a?b#c");
  });

  it("composes pathname + search + hash", () => {
    expect(normalizeRouteSnapshot({ pathname: "/p", search: "?q=1", hash: "#h" })).toBe("/p?q=1#h");
  });

  it("is defensive about missing fields and null", () => {
    expect(normalizeRouteSnapshot({ pathname: "/p" })).toBe("/p");
    expect(normalizeRouteSnapshot(null)).toBe("");
    expect(normalizeRouteSnapshot(undefined)).toBe("");
  });
});

describe("hasRouteChanged", () => {
  it("compares snapshots", () => {
    expect(hasRouteChanged("/a", "/b")).toBe(true);
    expect(hasRouteChanged("/a", "/a")).toBe(false);
  });
});

describe("createThrottledRouteRefresh", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("fires once after the delay for a burst of schedules", () => {
    const cb = vi.fn();
    const t = createThrottledRouteRefresh(cb, 400);
    t.schedule();
    t.schedule();
    t.schedule();
    expect(cb).not.toHaveBeenCalled();
    vi.advanceTimersByTime(400);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("cancel prevents the pending callback", () => {
    const cb = vi.fn();
    const t = createThrottledRouteRefresh(cb, 400);
    t.schedule();
    t.cancel();
    vi.advanceTimersByTime(1000);
    expect(cb).not.toHaveBeenCalled();
  });
});

/** Minimal fake History whose push/replace update a controllable location. */
function makeFakeEnv(initial = "/start") {
  let route = initial;
  const listeners: Record<string, Array<() => void>> = {};
  const history = {
    pushState(_data: unknown, _title: unknown, url?: unknown) {
      if (typeof url === "string") route = url;
    },
    replaceState(_data: unknown, _title: unknown, url?: unknown) {
      if (typeof url === "string") route = url;
    },
  };
  const target = {
    addEventListener(type: string, listener: () => void) {
      (listeners[type] ??= []).push(listener);
    },
    removeEventListener(type: string, listener: () => void) {
      listeners[type] = (listeners[type] ?? []).filter((l) => l !== listener);
    },
  };
  return {
    history,
    target,
    getLocation: () => route,
    setRoute: (r: string) => {
      route = r;
    },
    fire: (type: string) => (listeners[type] ?? []).forEach((l) => l()),
    listenerCount: (type: string) => (listeners[type] ?? []).length,
  };
}

describe("createSpaRouteMonitor", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("refreshes after pushState changes the route", () => {
    const env = makeFakeEnv("/a");
    const onRouteChange = vi.fn();
    const monitor = createSpaRouteMonitor({ onRouteChange, ...env });
    monitor.start();

    env.history.pushState(null, "", "/b");
    vi.advanceTimersByTime(DEFAULT_SPA_REFRESH_DELAY_MS);
    expect(onRouteChange).toHaveBeenCalledTimes(1);
    monitor.stop();
  });

  it("refreshes after replaceState changes the route", () => {
    const env = makeFakeEnv("/a");
    const onRouteChange = vi.fn();
    const monitor = createSpaRouteMonitor({ onRouteChange, ...env });
    monitor.start();

    env.history.replaceState(null, "", "/c");
    vi.advanceTimersByTime(DEFAULT_SPA_REFRESH_DELAY_MS);
    expect(onRouteChange).toHaveBeenCalledTimes(1);
    monitor.stop();
  });

  it("handles popstate and hashchange signals", () => {
    const env = makeFakeEnv("/a");
    const onRouteChange = vi.fn();
    const monitor = createSpaRouteMonitor({ onRouteChange, ...env });
    monitor.start();

    env.setRoute("/a#section");
    env.fire("hashchange");
    vi.advanceTimersByTime(DEFAULT_SPA_REFRESH_DELAY_MS);
    expect(onRouteChange).toHaveBeenCalledTimes(1);

    env.setRoute("/back");
    env.fire("popstate");
    vi.advanceTimersByTime(DEFAULT_SPA_REFRESH_DELAY_MS);
    expect(onRouteChange).toHaveBeenCalledTimes(2);
    monitor.stop();
  });

  it("does not refresh when the route is unchanged", () => {
    const env = makeFakeEnv("/a");
    const onRouteChange = vi.fn();
    const monitor = createSpaRouteMonitor({ onRouteChange, ...env });
    monitor.start();

    env.history.pushState(null, "", "/a"); // same route
    vi.advanceTimersByTime(DEFAULT_SPA_REFRESH_DELAY_MS);
    expect(onRouteChange).not.toHaveBeenCalled();
    monitor.stop();
  });

  it("throttles a burst into a single refresh", () => {
    const env = makeFakeEnv("/a");
    const onRouteChange = vi.fn();
    const monitor = createSpaRouteMonitor({ onRouteChange, ...env });
    monitor.start();

    env.history.pushState(null, "", "/b");
    env.history.pushState(null, "", "/c");
    env.history.pushState(null, "", "/d");
    vi.advanceTimersByTime(DEFAULT_SPA_REFRESH_DELAY_MS);
    expect(onRouteChange).toHaveBeenCalledTimes(1);
    monitor.stop();
  });

  it("stop() prevents later refreshes and restores history", () => {
    const env = makeFakeEnv("/a");
    const original = env.history.pushState;
    const onRouteChange = vi.fn();
    const monitor = createSpaRouteMonitor({ onRouteChange, ...env });

    monitor.start();
    expect(env.history.pushState).not.toBe(original); // wrapped
    monitor.stop();
    expect(env.history.pushState).toBe(original); // restored
    expect(env.listenerCount("popstate")).toBe(0);

    env.history.pushState(null, "", "/z");
    vi.advanceTimersByTime(1000);
    expect(onRouteChange).not.toHaveBeenCalled();
  });

  it("does not double-wrap history across two monitors", () => {
    const env = makeFakeEnv("/a");
    const m1 = createSpaRouteMonitor({ onRouteChange: vi.fn(), ...env });
    m1.start();
    const wrappedOnce = env.history.pushState;
    const m2 = createSpaRouteMonitor({ onRouteChange: vi.fn(), ...env });
    m2.start();
    expect(env.history.pushState).toBe(wrappedOnce); // unchanged by second monitor
    m2.stop();
    m1.stop();
  });

  it("start() is idempotent", () => {
    const env = makeFakeEnv("/a");
    const monitor = createSpaRouteMonitor({ onRouteChange: vi.fn(), ...env });
    monitor.start();
    monitor.start();
    expect(env.listenerCount("popstate")).toBe(1);
    monitor.stop();
  });
});
