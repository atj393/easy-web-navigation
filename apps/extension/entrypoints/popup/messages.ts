/**
 * User-facing popup copy and error translation. Pure and unit-tested.
 *
 * CLAIM ACCURACY
 * --------------
 * Automated checks cannot establish that a page is accessible, so nothing here
 * ever says a page "is accessible", "passes", or "is compliant". The strongest
 * positive statement the product makes is: no problems were found *by these
 * checks*.
 */
import { PRODUCT_NAME } from "@easy-web-navigation/shared-types";

export const TAGLINE = "Check how a website works with a keyboard.";

export const DISCLAIMER =
  "These checks find some keyboard-access problems. They cannot confirm a page is accessible, " +
  "and they never change the website.";

export const PERMISSION_DENIED_MSG =
  "Permission was not granted, so automatic checking stays on this page only.";

export const AUTO_ENABLED_NOTE =
  "Your keyboard focus and keyboard path choices are applied again on supported pages where " +
  "permission allows.";

export const NOT_CHECKED_YET = "Not checked yet";

export const NO_PROBLEMS_FOUND =
  "No problems were found by these checks. Some keyboard problems can only be found by testing " +
  "the page by hand.";

export const NOTHING_CHECKED_YET =
  "Nothing has been checked yet. Choose “Check this page” to look at keyboard use, movement " +
  "order, and names and labels.";

export const DISABLED_SITE_TITLE = "This site is switched off";

export const DISABLED_SITE_BODY =
  `You added this site to the “Sites to stay off” list, so ${PRODUCT_NAME} does not check it or ` +
  "draw anything on it. Remove it from that list in settings to check it again.";

export const RESTRICTED_PAGE_TITLE = "This page cannot be checked";

export const RESTRICTED_PAGE_BODY =
  "Browsers do not let extensions read their own internal pages, the extensions gallery, or " +
  `local files. Open a normal http:// or https:// page and ${PRODUCT_NAME} can check it.`;

/**
 * Shown the moment results leave the popup, not as a permanent footnote. A
 * standing warning in the corner is read once and then stops registering; this
 * one arrives exactly when the user is about to share a file.
 */
export const REPORT_PRIVACY_NOTE =
  "They include the page address and page text, so check before sharing.";

export const RESULTS_COPIED = `Results copied. ${REPORT_PRIVACY_NOTE}`;
export const RESULTS_SAVED = `Results saved to your downloads. ${REPORT_PRIVACY_NOTE}`;

/* --------------------------------------------------------------- errors -- */

/** Where a failure came from, so the popup can phrase it usefully. */
export type FailureKind =
  | "restricted"
  | "no-connection"
  | "no-tab"
  | "permission"
  | "clipboard"
  | "unknown";

const PATTERNS: { kind: FailureKind; re: RegExp }[] = [
  {
    kind: "restricted",
    re: /chrome:\/\/|edge:\/\/|about:|moz-extension:|chrome-extension:|view-source:|chrome\.google\.com\/webstore|chromewebstore\.google\.com|cannot be scripted|showing error page|extension manifest must request permission|cannot access (a )?(chrome|contents of the page|the url)/i,
  },
  {
    kind: "no-connection",
    re: /could not establish connection|receiving end does not exist|message port closed|no response from the page/i,
  },
  { kind: "no-tab", re: /no active tab|no tab with id/i },
  { kind: "permission", re: /host permission|permission (was )?(denied|not granted)/i },
];

/** Classify a raw browser/exception message. Never throws. */
export function classifyFailure(message: string): FailureKind {
  for (const { kind, re } of PATTERNS) {
    if (re.test(message)) return kind;
  }
  return "unknown";
}

const FAILURE_TEXT: Record<FailureKind, string> = {
  restricted: `${PRODUCT_NAME} cannot check browser pages, the extensions gallery, or local files. Open a normal website and try again.`,
  "no-connection": `${PRODUCT_NAME} could not reach this page. Reload the page, then try again.`,
  "no-tab": "No page is open in this window to check.",
  permission: "The browser has not given permission to work on this page.",
  clipboard: "Copying is blocked here. You can download the results instead.",
  unknown: `${PRODUCT_NAME} could not finish on this page. Reload the page, then try again.`,
};

/**
 * Turn any thrown value into one calm sentence a non-technical user can act on.
 * Raw browser exception text is never shown.
 */
export function humanizeError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  return FAILURE_TEXT[classifyFailure(raw)];
}
