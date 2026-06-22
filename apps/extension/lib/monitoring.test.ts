import { describe, it, expect } from "vitest";
import {
  DEFAULT_MONITORING,
  DEFAULT_TAB_PATH_MAX_ITEMS,
  TAB_PATH_MAX_ITEMS_VALUES,
  type MonitoringSettings,
  type TabPathSummary,
} from "@easy-web-navigation/shared-types";
import {
  isSupportedPageUrl,
  originPatternFromUrl,
  hostPermissionsForScope,
  scopeNeedsPermission,
  scopeLabel,
  scopeChoiceLabel,
  automaticCheckingStatusLabel,
  scopeExplanation,
  CURRENT_TAB_KEEP_CHECKING_HINT,
  keyboardPathSummaryText,
  normalizeTabPathMaxItems,
  mergeMonitoringSettings,
  updateMonitoringHelperPreference,
  createApplyMonitoringPayload,
  shouldAutoApplyHelpers,
  ALL_SITES_ORIGINS,
} from "./monitoring";

describe("isSupportedPageUrl", () => {
  it("accepts http and https pages", () => {
    expect(isSupportedPageUrl("https://example.com/page")).toBe(true);
    expect(isSupportedPageUrl("http://localhost:4321/x.html")).toBe(true);
  });

  it("rejects restricted and privileged schemes", () => {
    for (const url of [
      "chrome://extensions",
      "edge://settings",
      "about:blank",
      "moz-extension://abc/page.html",
      "chrome-extension://abc/popup.html",
      "devtools://devtools/bundled/x.html",
      "view-source:https://example.com",
      "file:///C:/x.html",
      "data:text/html,hi",
      "javascript:void(0)",
    ]) {
      expect(isSupportedPageUrl(url)).toBe(false);
    }
  });

  it("rejects empty / invalid input without throwing", () => {
    expect(isSupportedPageUrl(null)).toBe(false);
    expect(isSupportedPageUrl(undefined)).toBe(false);
    expect(isSupportedPageUrl("")).toBe(false);
    expect(isSupportedPageUrl("not a url")).toBe(false);
  });
});

describe("originPatternFromUrl", () => {
  it("builds a host match pattern", () => {
    expect(originPatternFromUrl("https://example.com/a/b?c=1")).toBe("https://example.com/*");
    expect(originPatternFromUrl("http://localhost:4321/x")).toBe("http://localhost:4321/*");
  });

  it("returns null for unsupported URLs", () => {
    expect(originPatternFromUrl("chrome://x")).toBeNull();
    expect(originPatternFromUrl(undefined)).toBeNull();
  });
});

describe("hostPermissionsForScope", () => {
  it("needs no origins for off / current-tab", () => {
    expect(hostPermissionsForScope("off", "https://example.com/")).toEqual([]);
    expect(hostPermissionsForScope("current-tab", "https://example.com/")).toEqual([]);
  });

  it("needs the current origin for site scope", () => {
    expect(hostPermissionsForScope("site", "https://example.com/page")).toEqual([
      "https://example.com/*",
    ]);
    expect(hostPermissionsForScope("site", "chrome://x")).toEqual([]);
  });

  it("needs broad origins for all-sites scope", () => {
    expect(hostPermissionsForScope("all-sites")).toEqual(ALL_SITES_ORIGINS);
  });
});

describe("scopeNeedsPermission", () => {
  it("is true only for site and all-sites", () => {
    expect(scopeNeedsPermission("off")).toBe(false);
    expect(scopeNeedsPermission("current-tab")).toBe(false);
    expect(scopeNeedsPermission("site")).toBe(true);
    expect(scopeNeedsPermission("all-sites")).toBe(true);
  });
});

describe("scopeLabel", () => {
  it("shows Off when disabled regardless of scope", () => {
    expect(scopeLabel("all-sites", false)).toBe("Off");
    expect(scopeLabel("off", true)).toBe("Off");
  });

  it("labels each active scope", () => {
    expect(scopeLabel("current-tab", true)).toBe("Current tab");
    expect(scopeLabel("site", true)).toBe("This site");
    expect(scopeLabel("all-sites", true)).toBe("All supported websites");
  });
});

describe("popup display labels (plain language)", () => {
  it("scopeChoiceLabel maps internal scopes to friendly option text", () => {
    expect(scopeChoiceLabel("current-tab")).toBe("This page only");
    expect(scopeChoiceLabel("site")).toBe("This website");
    expect(scopeChoiceLabel("all-sites")).toBe("All websites");
  });

  it("automaticCheckingStatusLabel is friendly and reflects enabled state", () => {
    expect(automaticCheckingStatusLabel("current-tab", false)).toBe("Off");
    expect(automaticCheckingStatusLabel("off", true)).toBe("Off");
    expect(automaticCheckingStatusLabel("current-tab", true)).toBe("On for this page");
    expect(automaticCheckingStatusLabel("site", true)).toBe("On for this website");
    expect(automaticCheckingStatusLabel("all-sites", true)).toBe("On for all websites");
  });

  it("scopeExplanation gives one plain description per scope", () => {
    expect(scopeExplanation("site")).toContain("other pages on this website");
    expect(scopeExplanation("all-sites")).toContain("normal websites as you browse");
    // "This page only" must clearly warn the user they may need to reopen the
    // extension after navigating to another page.
    expect(scopeExplanation("current-tab")).toContain("open another page");
    expect(scopeExplanation("current-tab")).toContain("may need to open Easy Web Navigation again");
  });

  it("current-tab keep-checking hint points to the broader scopes", () => {
    expect(CURRENT_TAB_KEEP_CHECKING_HINT).toContain("This website");
    expect(CURRENT_TAB_KEEP_CHECKING_HINT).toContain("All websites");
  });

  it("display labels never leak technical terms", () => {
    const all = [
      scopeChoiceLabel("current-tab"),
      scopeChoiceLabel("site"),
      scopeChoiceLabel("all-sites"),
      automaticCheckingStatusLabel("current-tab", true),
      automaticCheckingStatusLabel("site", true),
      automaticCheckingStatusLabel("all-sites", true),
      scopeExplanation("current-tab"),
      scopeExplanation("site"),
      scopeExplanation("all-sites"),
    ].join(" ");
    expect(all).not.toMatch(/monitor|scope|SPA|cross-origin|activeTab|host permission/i);
  });
});

describe("DEFAULT_MONITORING", () => {
  it("is off, current-tab, helpers off, 100 markers", () => {
    expect(DEFAULT_MONITORING).toEqual({
      enabled: false,
      scope: "current-tab",
      focusHelperEnabled: false,
      tabPathEnabled: false,
      tabPathMaxItems: 100,
    });
  });

  it("defaults the keyboard-path marker limit to 100", () => {
    expect(DEFAULT_TAB_PATH_MAX_ITEMS).toBe(100);
    expect(DEFAULT_MONITORING.tabPathMaxItems).toBe(100);
  });
});

const SETTINGS: MonitoringSettings = {
  enabled: true,
  scope: "site",
  focusHelperEnabled: true,
  tabPathEnabled: false,
  tabPathMaxItems: 100,
};

describe("mergeMonitoringSettings", () => {
  it("applies a patch without dropping other fields", () => {
    expect(mergeMonitoringSettings(SETTINGS, { enabled: false })).toEqual({
      enabled: false,
      scope: "site",
      focusHelperEnabled: true,
      tabPathEnabled: false,
      tabPathMaxItems: 100,
    });
  });

  it("does not mutate the input", () => {
    const copy = { ...SETTINGS };
    mergeMonitoringSettings(SETTINGS, { scope: "all-sites" });
    expect(SETTINGS).toEqual(copy);
  });

  it("changing the marker limit preserves scope, enabled, and helper prefs", () => {
    const next = mergeMonitoringSettings(SETTINGS, { tabPathMaxItems: 500 });
    expect(next.tabPathMaxItems).toBe(500);
    expect(next.enabled).toBe(SETTINGS.enabled);
    expect(next.scope).toBe(SETTINGS.scope);
    expect(next.focusHelperEnabled).toBe(SETTINGS.focusHelperEnabled);
    expect(next.tabPathEnabled).toBe(SETTINGS.tabPathEnabled);
  });

  it("stopping then starting automatic checking preserves the marker limit", () => {
    const chosen: MonitoringSettings = { ...SETTINGS, tabPathMaxItems: 250 };
    const stopped = mergeMonitoringSettings(chosen, { enabled: false });
    const started = mergeMonitoringSettings(stopped, { enabled: true, scope: "current-tab" });
    expect(stopped.tabPathMaxItems).toBe(250);
    expect(started.tabPathMaxItems).toBe(250);
  });
});

describe("normalizeTabPathMaxItems", () => {
  it("accepts exactly 100, 250, and 500", () => {
    expect(TAB_PATH_MAX_ITEMS_VALUES).toEqual([100, 250, 500]);
    expect(normalizeTabPathMaxItems(100)).toBe(100);
    expect(normalizeTabPathMaxItems(250)).toBe(250);
    expect(normalizeTabPathMaxItems(500)).toBe(500);
  });

  it("falls back to 100 for old/missing/invalid values", () => {
    expect(normalizeTabPathMaxItems(undefined)).toBe(100); // old stored settings
    expect(normalizeTabPathMaxItems(null)).toBe(100);
    expect(normalizeTabPathMaxItems(0)).toBe(100);
    expect(normalizeTabPathMaxItems(999)).toBe(100); // never exceeds 500
    expect(normalizeTabPathMaxItems(1000)).toBe(100);
    expect(normalizeTabPathMaxItems("250")).toBe(100); // strings are not valid
    expect(normalizeTabPathMaxItems({})).toBe(100);
  });
});

describe("keyboardPathSummaryText", () => {
  const make = (shown: number, totalDetected: number, capped: boolean): TabPathSummary => ({
    shown,
    totalDetected,
    capped,
  });

  it("shows the real total when nothing is limited (uses 'keyboard items')", () => {
    expect(keyboardPathSummaryText(make(78, 78, false))).toEqual({
      line: "Showing all 78 keyboard items.",
    });
  });

  it("shows first-of-total and a higher-limit hint when limited", () => {
    expect(keyboardPathSummaryText(make(100, 342, true))).toEqual({
      line: "Showing the first 100 of 342 keyboard items.",
      hint: "Choose a higher limit to show more.",
    });
  });

  it("never uses the phrase 'focusable items' in the popup wording", () => {
    const all = [
      keyboardPathSummaryText(make(78, 78, false)),
      keyboardPathSummaryText(make(100, 342, true)),
    ]
      .flatMap((r) => [r.line, r.hint ?? ""])
      .join(" ");
    expect(all).not.toMatch(/focusable item/i);
  });
});

describe("updateMonitoringHelperPreference", () => {
  it("updates only the focus preference", () => {
    expect(updateMonitoringHelperPreference(SETTINGS, "focus", false)).toEqual({
      ...SETTINGS,
      focusHelperEnabled: false,
    });
  });

  it("updates only the tab-path preference", () => {
    expect(updateMonitoringHelperPreference(SETTINGS, "tabPath", true)).toEqual({
      ...SETTINGS,
      tabPathEnabled: true,
    });
  });

  it("preserves enabled and scope (so Stop/Start keeps prefs)", () => {
    const next = updateMonitoringHelperPreference(SETTINGS, "focus", false);
    expect(next.enabled).toBe(SETTINGS.enabled);
    expect(next.scope).toBe(SETTINGS.scope);
  });
});

describe("createApplyMonitoringPayload", () => {
  it("maps remembered preferences (incl. the marker limit) to the apply payload", () => {
    expect(createApplyMonitoringPayload({ ...SETTINGS, tabPathMaxItems: 250 })).toEqual({
      focusHelper: true,
      tabPath: false,
      tabPathMaxItems: 250,
    });
  });

  it("normalizes an old/invalid stored marker limit to 100", () => {
    const legacy = { ...SETTINGS, tabPathMaxItems: undefined as unknown as 100 };
    expect(createApplyMonitoringPayload(legacy).tabPathMaxItems).toBe(100);
  });
});

describe("shouldAutoApplyHelpers", () => {
  it("is true only when enabled and at least one helper is on", () => {
    expect(shouldAutoApplyHelpers(SETTINGS)).toBe(true);
    expect(shouldAutoApplyHelpers({ ...SETTINGS, focusHelperEnabled: false })).toBe(false);
    expect(shouldAutoApplyHelpers({ ...SETTINGS, enabled: false })).toBe(false);
    expect(
      shouldAutoApplyHelpers({ ...SETTINGS, focusHelperEnabled: false, tabPathEnabled: true }),
    ).toBe(true);
  });
});
