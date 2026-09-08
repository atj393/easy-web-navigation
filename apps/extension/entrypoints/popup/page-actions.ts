/**
 * The popup's browser-facing layer: active-tab lookup, content-script
 * injection, and typed messaging.
 *
 * Everything here is thin and side-effecting; the decision logic lives in
 * `state.ts` (pure) and `messages.ts` (pure) so it can be unit-tested.
 */
import { browser } from "#imports";
import type { ExtensionMessage } from "@easy-web-navigation/shared-types";

export interface ActiveTab {
  id: number;
  url: string;
}

/** The active tab in the current window. Throws when there is none. */
export async function getActiveTab(): Promise<ActiveTab> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab.");
  return { id: tab.id, url: tab.url ?? "" };
}

/**
 * Ensure the read-only content script is present in a tab.
 *
 * Safe to call repeatedly: the script's own `__easyWebNavigationInitialized`
 * guard makes a second execution a no-op, so repeated popup opens never stack
 * duplicate message listeners.
 */
export async function ensureInjected(tabId: number): Promise<void> {
  await browser.scripting.executeScript({
    target: { tabId },
    files: ["/content-scripts/content.js"],
  });
}

/** Send a typed message to a tab's content script. */
export async function send(
  tabId: number,
  message: ExtensionMessage,
): Promise<ExtensionMessage | undefined> {
  const response = (await browser.tabs.sendMessage(tabId, message)) as unknown;
  return isExtensionMessage(response) ? response : undefined;
}

/**
 * Runtime shape check for anything arriving over the messaging boundary.
 * The static `ExtensionMessage` union is a compile-time contract only — a stale
 * content script from a previous extension version can answer with anything.
 */
export function isExtensionMessage(value: unknown): value is ExtensionMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { type?: unknown }).type === "string"
  );
}

/** Request optional host permissions. Resolves false on any failure. */
export async function requestOrigins(origins: string[]): Promise<boolean> {
  if (origins.length === 0) return false;
  try {
    return await browser.permissions.request({ origins });
  } catch {
    // Firefox MV2 has no `optional_host_permissions`, so the request is
    // rejected outright rather than shown to the user.
    return false;
  }
}
