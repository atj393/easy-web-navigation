import { useEffect, useState } from "react";
import {
  DEFAULT_SETTINGS,
  PRODUCT_NAME,
  PRODUCT_TAGLINE,
  type ExtensionSettings,
} from "@easy-web-navigation/shared-types";
import { settingsItem } from "../../lib/settings";

/**
 * Options UI (Phase 0F).
 *
 * Preferences persist via typed WXT storage. Some toggles are saved for future
 * phases and are clearly marked as not yet wired to behavior; the focus helper
 * and tab path are currently controlled directly from the popup.
 */
type BoolKey = Exclude<keyof ExtensionSettings, "disabledDomains">;

const TOGGLES: { key: BoolKey; label: string; hint: string; ready: boolean }[] = [
  {
    key: "enableVisibleFocusHelper",
    label: "Enable visible focus helper by default",
    hint: "Preference for future auto-enable. Today the focus helper is toggled from the popup.",
    ready: false,
  },
  {
    key: "showTabPath",
    label: "Show tab path by default",
    hint: "Preference for future auto-enable. Today the tab path is toggled from the popup.",
    ready: false,
  },
  {
    key: "showWcagReferences",
    label: "Show WCAG references",
    hint: "Show WCAG criterion references alongside issues and in reports.",
    ready: true,
  },
  {
    key: "enableSafeEnhancementsManually",
    label: "Enable safe enhancements manually",
    hint: "Reserved for a future, opt-in assist mode. Not implemented yet — read-only today.",
    ready: false,
  },
];

export function App() {
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    settingsItem.getValue().then((value) => {
      setSettings(value);
      setLoaded(true);
    });
  }, []);

  async function update(patch: Partial<ExtensionSettings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    await settingsItem.setValue(next);
  }

  return (
    <main className="options">
      <header className="options__header">
        <img className="options__icon" src="/icon-48.png" alt="" width={40} height={40} />
        <div>
          <h1 className="options__title">{PRODUCT_NAME}</h1>
          <p className="options__tagline">{PRODUCT_TAGLINE}</p>
        </div>
      </header>

      <p className="options__hint" role="status">
        {loaded ? "Settings are saved automatically." : "Loading settings…"}
      </p>

      <fieldset className="options__group">
        <legend>Helpers</legend>
        {TOGGLES.map(({ key, label, hint, ready }) => (
          <label key={key} className="options__row">
            <input
              type="checkbox"
              checked={settings[key]}
              onChange={(e) => update({ [key]: e.target.checked } as Partial<ExtensionSettings>)}
            />
            <span className="options__text">
              <span className="options__label">
                {label}
                {!ready && <span className="options__tag">not wired yet</span>}
              </span>
              <span className="options__desc">{hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <fieldset className="options__group">
        <legend>Disabled domains</legend>
        <label className="options__row options__row--block">
          <span className="options__desc">
            One domain per line. {PRODUCT_NAME} stays inactive on these.
          </span>
          <textarea
            rows={4}
            value={settings.disabledDomains.join("\n")}
            onChange={(e) =>
              update({
                disabledDomains: e.target.value
                  .split("\n")
                  .map((d) => d.trim())
                  .filter(Boolean),
              })
            }
          />
        </label>
      </fieldset>

      <fieldset className="options__group">
        <legend>Monitoring &amp; privacy</legend>
        <p className="options__desc">
          Monitoring is started from the popup. It is off by default. When you start it,{" "}
          {PRODUCT_NAME} scans supported pages automatically and re-applies the visual helpers you
          enabled, within the scope you choose (current tab, this site, or all supported websites).
          Site and all-sites scopes ask for an optional permission first.
        </p>
        <p className="options__desc">
          {PRODUCT_NAME} does not upload page content, does not call external APIs, and does not use
          analytics. Monitoring only runs when you explicitly start it.
        </p>
      </fieldset>

      <footer className="options__footer">
        <p>
          {PRODUCT_NAME} inspects keyboard accessibility at runtime. It does not certify legal
          compliance, and a clean report is not a compliance pass.
        </p>
      </footer>
    </main>
  );
}
