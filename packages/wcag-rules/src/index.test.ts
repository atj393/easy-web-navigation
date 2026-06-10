import { describe, it, expect } from "vitest";
import { ALL_RULES, RULES, getRule } from "./index";

describe("@keywise/wcag-rules", () => {
  it("defines the seven Phase 0A placeholder rules", () => {
    expect(ALL_RULES).toHaveLength(7);
  });

  it("marks every rule as not-implemented in Phase 0A", () => {
    for (const rule of ALL_RULES) {
      expect(rule.status).toBe("not-implemented");
    }
  });

  it("gives every rule at least one WCAG criterion", () => {
    for (const rule of ALL_RULES) {
      expect(rule.criteria.length).toBeGreaterThan(0);
    }
  });

  it("looks up a rule by id", () => {
    expect(getRule("positive-tabindex").id).toBe("positive-tabindex");
    expect(RULES["unlabeled-form-input"].level).toBe("A");
  });
});
