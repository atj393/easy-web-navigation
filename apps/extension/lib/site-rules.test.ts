import { describe, expect, it } from "vitest";
import {
  hostOf,
  isSiteDisabled,
  normalizeDisabledDomains,
  normalizeDomainEntry,
} from "./site-rules";

describe("normalizeDomainEntry", () => {
  it("accepts the shapes people actually type", () => {
    expect(normalizeDomainEntry("example.com")).toBe("example.com");
    expect(normalizeDomainEntry("  EXAMPLE.com  ")).toBe("example.com");
    expect(normalizeDomainEntry("https://example.com/some/path?q=1#f")).toBe("example.com");
    expect(normalizeDomainEntry("http://example.com:8443")).toBe("example.com");
    expect(normalizeDomainEntry("*.example.com")).toBe("example.com");
    expect(normalizeDomainEntry("user:pw@example.com")).toBe("example.com");
    expect(normalizeDomainEntry("example.com.")).toBe("example.com");
  });

  it("rejects entries that are not host-like", () => {
    expect(normalizeDomainEntry("")).toBe("");
    expect(normalizeDomainEntry("   ")).toBe("");
    expect(normalizeDomainEntry("not a domain")).toBe("");
    expect(normalizeDomainEntry("/")).toBe("");
  });
});

describe("normalizeDisabledDomains", () => {
  it("cleans, de-duplicates and drops junk", () => {
    expect(
      normalizeDisabledDomains([
        " Example.com ",
        "https://example.com/x",
        "",
        "bad entry",
        "b.test",
      ]),
    ).toEqual(["example.com", "b.test"]);
  });

  it("survives a corrupted stored value", () => {
    expect(normalizeDisabledDomains(undefined)).toEqual([]);
    expect(normalizeDisabledDomains("example.com")).toEqual([]);
    expect(normalizeDisabledDomains([1, null, {}, "ok.test"])).toEqual(["ok.test"]);
  });
});

describe("hostOf", () => {
  it("extracts the host, lowercased", () => {
    expect(hostOf("https://Example.COM/path")).toBe("example.com");
    expect(hostOf("http://a.b.example.com:8080/")).toBe("a.b.example.com");
  });

  it("returns nothing for a URL it cannot parse", () => {
    expect(hostOf("")).toBe("");
    expect(hostOf(undefined)).toBe("");
    expect(hostOf("chrome://settings")).toBe("");
    expect(hostOf("not a url")).toBe("");
  });
});

describe("isSiteDisabled", () => {
  const list = ["example.com", "intranet.test"];

  it("matches the host itself and its subdomains", () => {
    expect(isSiteDisabled("https://example.com/a", list)).toBe(true);
    expect(isSiteDisabled("https://www.example.com/a", list)).toBe(true);
    expect(isSiteDisabled("https://deep.app.example.com/", list)).toBe(true);
  });

  it("does not match by substring, which would over-block", () => {
    // The classic mistakes: a prefix match and a suffix-shaped impostor.
    expect(isSiteDisabled("https://notexample.com/", list)).toBe(false);
    expect(isSiteDisabled("https://example.com.evil.test/", list)).toBe(false);
    expect(isSiteDisabled("https://myexample.com/", list)).toBe(false);
  });

  it("is case-insensitive on both sides", () => {
    expect(isSiteDisabled("https://WWW.Example.COM/", ["EXAMPLE.com"])).toBe(true);
  });

  it("is inert for an empty or broken list", () => {
    expect(isSiteDisabled("https://example.com/", [])).toBe(false);
    expect(isSiteDisabled("https://example.com/", null)).toBe(false);
    expect(isSiteDisabled("https://example.com/", ["   ", "???"])).toBe(false);
  });

  it("never blocks a URL with no host", () => {
    expect(isSiteDisabled("chrome://settings", list)).toBe(false);
    expect(isSiteDisabled("", list)).toBe(false);
  });
});
