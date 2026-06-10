/**
 * Read-only clipboard helper for the popup.
 *
 * Prefers the async Clipboard API (`navigator.clipboard.writeText`) and falls
 * back to a temporary, off-screen <textarea> + `document.execCommand("copy")`
 * when the API is unavailable (older Firefox, insecure contexts). The textarea
 * is created inside the EXTENSION popup document only — never the inspected
 * page — and is removed immediately after the copy attempt.
 *
 * Dependencies are injectable so the helper is unit-testable without a real
 * browser clipboard.
 */
export interface ClipboardEnv {
  clipboard?: Pick<Clipboard, "writeText"> | null;
  doc?: Document | null;
}

export async function copyTextToClipboard(text: string, env: ClipboardEnv = {}): Promise<boolean> {
  const clipboard =
    env.clipboard ?? (globalThis.navigator?.clipboard as Pick<Clipboard, "writeText"> | undefined);
  const doc = env.doc ?? (globalThis.document as Document | undefined);

  // Preferred path: async Clipboard API.
  if (clipboard?.writeText) {
    try {
      await clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the legacy fallback.
    }
  }

  // Fallback: temporary off-screen textarea + execCommand("copy").
  if (doc?.body && typeof doc.execCommand === "function") {
    const textarea = doc.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-9999px";
    textarea.style.opacity = "0";
    doc.body.appendChild(textarea);
    textarea.select();
    let ok = false;
    try {
      ok = doc.execCommand("copy");
    } catch {
      ok = false;
    }
    textarea.remove();
    return ok;
  }

  return false;
}
