import { useEffect, useState } from "react";
import {
  DEFAULT_SETTINGS,
  PRODUCT_NAME,
  PRODUCT_TAGLINE,
  type ExtensionSettings,
} from "@easy-web-navigation/shared-types";
import { settingsItem } from "../../lib/settings";
import { normalizeDisabledDomains, normalizeDomainEntry } from "../../lib/site-rules";

/**
 * Options UI.
 *
 * Every control on this page changes real behaviour. The page previously
 * carried four settings, three of them labelled "not wired yet" and the fourth
 * ("Show WCAG references") not read anywhere either — including a disabled-
 * domains list described as keeping the extension inactive on those sites,
 * which nothing consulted. Settings that only duplicated the popup's own guide
 * toggles were removed; the two that remain are read by the popup, the content
 * script and the background worker.
 */

/** Coerce whatever is in storage into settings the UI can rely on. */
function normalizeSettings(value: unknown): ExtensionSettings {
  const raw = (value ?? {}) as Partial<Record<keyof ExtensionSettings, unknown>>;
  return {
    showWcagReferences:
      typeof raw.showWcagReferences === "boolean"
        ? raw.showWcagReferences
        : DEFAULT_SETTINGS.showWcagReferences,
    disabledDomains: normalizeDisabledDomains(raw.disabledDomains),
  };
}

type SaveState = "loading" | "saved" | "saving" | "error";

const SAVE_TEXT: Record<SaveState, string> = {
  loading: "Loading your settings…",
  saving: "Saving…",
  saved: "Settings are saved automatically.",
  error: "Your settings could not be saved. Check that this browser allows extension storage.",
};

export function App() {
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  /** Raw textarea contents, so typing is not fought by normalisation. */
  const [domainsText, setDomainsText] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("loading");

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const value = normalizeSettings(await settingsItem.getValue());
        if (!alive) return;
        setSettings(value);
        setDomainsText(value.disabledDomains.join("\n"));
        setSaveState("saved");
      } catch {
        if (alive) setSaveState("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function update(patch: Partial<ExtensionSettings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    setSaveState("saving");
    try {
      await settingsItem.setValue(next);
      setSaveState("saved");
    } catch {
      // A silent failure here would leave the user believing a privacy choice
      // had been recorded when it had not.
      setSaveState("error");
    }
  }

  /** Commit the domain list when the field loses focus, not on every keypress. */
  function commitDomains() {
    const cleaned = normalizeDisabledDomains(domainsText.split("\n"));
    setDomainsText(cleaned.join("\n"));
    void update({ disabledDomains: cleaned });
  }

  const rejected = domainsText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && normalizeDomainEntry(line) === "");

  return (
    <main className="options">
      <header className="options__header">
        <img className="options__icon" src="/icon-48.png" alt="" width={40} height={40} />
        <div>
          <h1 className="options__title">{PRODUCT_NAME}</h1>
          <p className="options__tagline">{PRODUCT_TAGLINE}</p>
        </div>
      </header>

      <p
        className={`options__hint${saveState === "error" ? " options__hint--error" : ""}`}
        role="status"
      >
        {SAVE_TEXT[saveState]}
      </p>

      <fieldset className="options__group">
        <legend>Findings</legend>
        <label className="options__row">
          <input
            type="checkbox"
            checked={settings.showWcagReferences}
            onChange={(e) => void update({ showWcagReferences: e.target.checked })}
          />
          <span className="options__text">
            <span className="options__label">Show WCAG references</span>
            <span className="options__desc">
              Adds the related WCAG success criteria to each finding in the popup and in saved
              results. Turn this off for a plainer list.
            </span>
          </span>
        </label>
      </fieldset>

      <fieldset className="options__group">
        <legend>Sites to stay off</legend>
        <label className="options__row options__row--block" htmlFor="disabled-domains">
          <span className="options__label">Disabled sites</span>
          <span className="options__desc" id="disabled-domains-hint">
            One site per line, for example <code>example.com</code>. {PRODUCT_NAME} will not check
            these sites and will not draw its guides there. A site also covers its subsections, so{" "}
            <code>example.com</code> also covers <code>shop.example.com</code>.
          </span>
        </label>
        <textarea
          id="disabled-domains"
          rows={5}
          value={domainsText}
          aria-describedby="disabled-domains-hint"
          spellCheck={false}
          onChange={(e) => setDomainsText(e.target.value)}
          onBlur={commitDomains}
        />
        {rejected.length > 0 && (
          <p className="options__warn" role="status">
            {`These lines are not site addresses and will be removed when you leave this box: ${rejected.join(", ")}`}
          </p>
        )}
      </fieldset>

      <fieldset className="options__group">
        <legend>Automatic checking and privacy</legend>
        <p className="options__desc">
          Automatic checking is started from the {PRODUCT_NAME} popup and is off until you start it.
          When you start it, supported pages are checked as you browse and the guides you turned on
          are drawn again, within the area you chose (this page, this website, or all websites).
          Website-wide and all-website checking asks your browser for permission first.
        </p>
        <p className="options__desc">
          {PRODUCT_NAME} does everything on your own computer. It does not upload page content, call
          external services, use analytics, or keep any account.
        </p>
      </fieldset>

      <footer className="options__footer">
        <p>
          {PRODUCT_NAME} looks for some keyboard-access problems while a page is open. It cannot
          confirm that a page is accessible, it does not change websites, and a clean result is not
          a compliance pass.
        </p>
      </footer>
    </main>
  );
}
