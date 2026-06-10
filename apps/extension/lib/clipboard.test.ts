import { describe, it, expect, vi } from "vitest";
import { copyTextToClipboard } from "./clipboard";

/** Minimal fake Document for testing the execCommand fallback in isolation. */
function makeFakeDoc(execResult: boolean) {
  const appended: unknown[] = [];
  const body = {
    appendChild(el: unknown) {
      appended.push(el);
    },
  };
  const execCommand = vi.fn(() => execResult);
  const doc = {
    body,
    execCommand,
    createElement() {
      const el = {
        value: "",
        style: {} as Record<string, string>,
        setAttribute() {},
        select: vi.fn(),
        remove() {
          const i = appended.indexOf(el);
          if (i >= 0) appended.splice(i, 1);
        },
      };
      return el;
    },
  };
  return { doc: doc as unknown as Document, appended, execCommand };
}

describe("copyTextToClipboard", () => {
  it("uses the async Clipboard API when available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const ok = await copyTextToClipboard("hello", { clipboard: { writeText }, doc: null });
    expect(ok).toBe(true);
    expect(writeText).toHaveBeenCalledWith("hello");
  });

  it("falls back to execCommand when the Clipboard API is unavailable", async () => {
    const { doc, appended, execCommand } = makeFakeDoc(true);
    const ok = await copyTextToClipboard("fallback text", { clipboard: null, doc });
    expect(ok).toBe(true);
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(appended).toHaveLength(0); // temporary textarea cleaned up
  });

  it("falls back when the Clipboard API rejects", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    const { doc, execCommand } = makeFakeDoc(true);
    const ok = await copyTextToClipboard("x", { clipboard: { writeText }, doc });
    expect(ok).toBe(true);
    expect(execCommand).toHaveBeenCalled();
  });

  it("reports failure when execCommand returns false", async () => {
    const { doc } = makeFakeDoc(false);
    const ok = await copyTextToClipboard("x", { clipboard: null, doc });
    expect(ok).toBe(false);
  });

  it("returns false when neither method is available", async () => {
    const doc = { body: {} } as unknown as Document; // no execCommand
    const ok = await copyTextToClipboard("x", { clipboard: null, doc });
    expect(ok).toBe(false);
  });
});
