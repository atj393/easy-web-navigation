import { useEffect, useState } from "react";
import { DEFAULT_SETTINGS, type ExtensionSettings } from "@keywise/shared-types";
import { settingsItem } from "../../lib/settings";

/**
 * Options UI — Phase 0A skeleton with simple typed storage.
 * Toggles persist via WXT storage; none of them drive behavior yet.
 */
type BoolKey = Exclude<keyof ExtensionSettings, "disabledDomains">;

const TOGGLES: { key: BoolKey; label: string }[] = [
  { key: "enableVisibleFocusHelper", label: "Enable visible focus helper" },
  { key: "showTabPath", label: "Show tab path" },
  { key: "showWcagReferences", label: "Show WCAG references" },
  { key: "enableSafeEnhancementsManually", label: "Enable safe enhancements manually" },
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
      <h1>KeyWise Web — Options</h1>
      <p className="options__hint">
        {loaded ? "Settings are saved automatically." : "Loading settings…"}
      </p>

      <fieldset className="options__group">
        <legend>Helpers</legend>
        {TOGGLES.map(({ key, label }) => (
          <label key={key} className="options__row">
            <input
              type="checkbox"
              checked={settings[key]}
              onChange={(e) => update({ [key]: e.target.checked } as Partial<ExtensionSettings>)}
            />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>

      <fieldset className="options__group">
        <legend>Disabled domains</legend>
        <label className="options__row options__row--block">
          <span>One domain per line. KeyWise Web stays inactive on these.</span>
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
    </main>
  );
}
