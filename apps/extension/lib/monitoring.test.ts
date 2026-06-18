import { describe, it, expect } from "vitest";
import { DEFAULT_MONITORING } from "@easy-web-navigation/shared-types";
import {
  isSupportedPageUrl,
  originPatternFromUrl,
  hostPermissionsForScope,
  scopeNeedsPermission,
  scopeLabel,
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

describe("DEFAULT_MONITORING", () => {
  it("is off, current-tab, helpers off", () => {
    expect(DEFAULT_MONITORING).toEqual({
      enabled: false,
      scope: "current-tab",
      focusHelperEnabled: false,
      tabPathEnabled: false,
    });
  });
});
