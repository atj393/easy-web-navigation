import { storage } from "#imports";
import { DEFAULT_SETTINGS, type ExtensionSettings } from "@easy-web-navigation/shared-types";

/**
 * Typed, persisted settings backed by WXT storage (extension local storage).
 * A single source of truth shared by the popup, options page, and background.
 */
export const settingsItem = storage.defineItem<ExtensionSettings>("local:settings", {
  fallback: DEFAULT_SETTINGS,
});
