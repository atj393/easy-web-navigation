/**
 * User-facing copy and error translation.
 *
 * The claim-accuracy group is a product guard, not a style check: an
 * accessibility tool that tells a user their page "is accessible" on the
 * strength of automated checks is making a claim it cannot support.
 */
import { describe, expect, it } from "vitest";
import {
  AUTO_ENABLED_NOTE,
  classifyFailure,
  DISCLAIMER,
  humanizeError,
  isRestrictedFailure,
  NOTHING_CHECKED_YET,
  NO_PROBLEMS_FOUND,
  PERMISSION_DENIED_MSG,
  REPORT_PRIVACY_NOTE,
  RESTRICTED_PAGE_BODY,
  TAGLINE,
} from "./messages";

const ALL_COPY = [
  TAGLINE,
  DISCLAIMER,
  PERMISSION_DENIED_MSG,
  AUTO_ENABLED_NOTE,
  NO_PROBLEMS_FOUND,
  NOTHING_CHECKED_YET,
  RESTRICTED_PAGE_BODY,
  REPORT_PRIVACY_NOTE,
];

/** Phrases that would be an unsupportable claim if stated affirmatively. */
const CLAIM =
  /(is accessible|fully accessible|accessibility compliant|wcag compliant|certif\w*|guarantee\w*|passes wcag|meets wcag)/g;

/** Words that turn a following claim into an honest limitation. */
const NEGATION = /\b(not|never|cannot|can't|no|without|neither|nor)\b/;

/**
 * Claims that appear WITHOUT a negation in the preceding clause. "cannot
 * confirm a page is accessible" is exactly the wording the product wants;
 * "this page is accessible" is the wording it must never produce.
 */
function unnegatedClaims(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const match of lower.matchAll(CLAIM)) {
    const before = lower.slice(Math.max(0, match.index - 60), match.index);
    if (!NEGATION.test(before)) found.push(match[0]);
  }
  return found;
}

describe("claim accuracy", () => {
  it("never states that a page is accessible or compliant", () => {
    for (const text of ALL_COPY) {
      expect(unnegatedClaims(text)).toEqual([]);
    }
  });

  it("still flags an affirmative claim, so the guard is not vacuous", () => {
    expect(unnegatedClaims("This page is accessible.")).toEqual(["is accessible"]);
    expect(unnegatedClaims("We guarantee WCAG compliance.")).toContain("guarantee");
    expect(unnegatedClaims("It cannot certify compliance.")).toEqual([]);
  });

  it("qualifies a clean result rather than presenting it as a pass", () => {
    expect(NO_PROBLEMS_FOUND).toContain("by these checks");
    expect(NO_PROBLEMS_FOUND).toContain("by hand");
  });

  it("states plainly that the tool does not change the website", () => {
    expect(DISCLAIMER).toContain("never change the website");
    expect(DISCLAIMER).toContain("cannot confirm a page is accessible");
  });

  it("warns that saved results can carry page information", () => {
    expect(REPORT_PRIVACY_NOTE).toMatch(/page address|selector/i);
  });
});

describe("classifyFailure", () => {
  const cases: [string, ReturnType<typeof classifyFailure>][] = [
    ["Cannot access contents of the page at chrome://settings", "restricted"],
    ["Cannot access a chrome:// URL", "restricted"],
    ["The extensions gallery cannot be scripted.", "restricted"],
    ["Extension manifest must request permission to access this host.", "restricted"],
    ['Cannot access contents of url "edge://flags".', "restricted"],
    ["Could not establish connection. Receiving end does not exist.", "no-connection"],
    ["The message port closed before a response was received.", "no-connection"],
    ["No response from the page.", "no-connection"],
    ["No active tab.", "no-tab"],
    ["No tab with id: 42.", "no-tab"],
    ["Missing host permission for the tab", "permission"],
    ["kaboom", "unknown"],
    ["", "unknown"],
  ];

  for (const [raw, expected] of cases) {
    it(`classifies ${JSON.stringify(raw.slice(0, 44))} as ${expected}`, () => {
      expect(classifyFailure(raw)).toBe(expected);
    });
  }
});

describe("humanizeError", () => {
  it("never leaks raw browser exception text", () => {
    const raw = "Uncaught TypeError: Cannot read properties of undefined (reading 'foo')";
    const message = humanizeError(new Error(raw));
    expect(message).not.toContain("TypeError");
    expect(message).not.toContain("undefined");
    expect(message.endsWith(".")).toBe(true);
  });

  it("handles values that are not Errors", () => {
    expect(humanizeError(undefined)).toBeTruthy();
    expect(humanizeError(null)).toBeTruthy();
    expect(humanizeError({ weird: true })).toBeTruthy();
  });

  it("tells the user what to do next for the common failures", () => {
    expect(humanizeError(new Error("Could not establish connection."))).toContain(
      "Reload the page",
    );
    expect(humanizeError(new Error("Cannot access a chrome:// URL"))).toContain("normal website");
  });

  it("identifies a restricted page for the calm restricted state", () => {
    expect(isRestrictedFailure(new Error("Cannot access a chrome:// URL"))).toBe(true);
    expect(isRestrictedFailure(new Error("Could not establish connection."))).toBe(false);
  });
});
