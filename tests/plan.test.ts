import { describe, expect, it } from "vitest";
import { PLAN_LIMITS, validatePlan, validatePlanLenient } from "../app/lib/plan";

const base = { boardName: "B", listName: "To Do", items: [{ name: "A" }] };

describe("validatePlan", () => {
  it("accepts a minimal plan and normalizes fields", () => {
    const r = validatePlan({ ...base, items: [{ name: " A ", due: "2026-03-15T17:00:00Z", labels: ["x", { name: "y", color: "RED" }, { name: "z", color: "nope" }] }] });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.items[0].name).toBe("A");
      expect(r.data.items[0].due).toBe("2026-03-15T17:00:00.000Z");
      expect(r.data.items[0].labels).toEqual(["x", { name: "y", color: "red" }, "z"]);
    }
  });
  it.each([null, "str", 5])("rejects non-object %p", (p) => {
    expect(validatePlan(p).ok).toBe(false);
  });
  it("requires boardName, listName and items", () => {
    expect(validatePlan({ ...base, boardName: " " }).ok).toBe(false);
    expect(validatePlan({ ...base, listName: "" }).ok).toBe(false);
    expect(validatePlan({ ...base, items: [] }).ok).toBe(false);
  });
  it("allows per-item listName instead of global", () => {
    expect(validatePlan({ boardName: "B", items: [{ name: "A", listName: "L" }] }).ok).toBe(true);
  });
  it("enforces limits and drops invalid dates", () => {
    const many = Array.from({ length: PLAN_LIMITS.MAX_ITEMS + 1 }, () => ({ name: "a" }));
    expect(validatePlan({ ...base, items: many }).ok).toBe(false);
    const r = validatePlan({ ...base, items: [{ name: "A", due: "garbage" }] });
    expect(r.ok && r.data.items[0].due).toBe(null);
  });
});

describe("validatePlanLenient", () => {
  it("falls back to title and Untitled", () => {
    const r = validatePlanLenient({ boardName: "B", items: [{ title: "T" }, {}] });
    expect(r.ok && r.data.items.map((i) => i.name)).toEqual(["T", "Untitled"]);
  });
  it("rejects empty plans", () => {
    expect(validatePlanLenient({ boardName: "B", items: [] }).ok).toBe(false);
  });
});
