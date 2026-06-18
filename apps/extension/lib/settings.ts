import { storage } from "#imports";
import {
  DEFAULT_MONITORING,
  DEFAULT_SETTINGS,
  type ExtensionSettings,
  type MonitoringSettings,
} from "@easy-web-navigation/shared-types";

/**
 * Typed, persisted settings backed by WXT storage (extension local storage).
 * A single source of truth shared by the popup, options page, and background.
 */
export const settingsItem = storage.defineItem<ExtensionSettings>("local:settings", {
  fallback: DEFAULT_SETTINGS,
});

/**
 * Persisted monitoring state + remembered visual-helper preferences. Read by
 * the popup (writer), the content script (auto-apply on load), and the
 * background (decide whether to auto-inject on navigation). No page content is
 * ever stored here — only the user's monitoring choices.
 */
export const monitoringItem = storage.defineItem<MonitoringSettings>("local:monitoring", {
  fallback: DEFAULT_MONITORING,
});
