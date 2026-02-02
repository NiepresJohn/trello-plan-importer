export type PlanItem = {
  name: string;
  desc: string;
  due: string | null;
  labels: string[];
  checklist: string[];
  /** When set, card is created in this list (from JSON board structure). */
  listName?: string;
};

export type TaskPlan = {
  boardName: string;
  listName: string;
  items: PlanItem[];
};

export type ValidationResult<T> = { ok: true; data: T } | { ok: false; error: string };

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean);
}

function normalizeDue(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function validatePlan(payload: unknown): ValidationResult<TaskPlan> {
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "Payload must be an object" };
  }

  const plan = payload as Record<string, unknown>;
  const boardName = typeof plan.boardName === "string" ? plan.boardName.trim() : "";
  const listName = typeof plan.listName === "string" ? plan.listName.trim() : "";

  if (!boardName) {
    return { ok: false, error: "boardName is required" };
  }

  const itemsRaw = Array.isArray(plan.items) ? plan.items : [];
  const items: PlanItem[] = [];

  for (const raw of itemsRaw) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const name = typeof item.name === "string" ? item.name.trim() : "";
    if (!name) continue;
    const desc = typeof item.desc === "string" ? item.desc : "";
    const due = normalizeDue(item.due);
    const labels = toStringArray(item.labels);
    const checklist = toStringArray(item.checklist);
    const itemListName = typeof item.listName === "string" ? item.listName.trim() : undefined;

    items.push({
      name,
      desc,
      due,
      labels,
      checklist,
      listName: itemListName || undefined,
    });
  }

  const hasList = listName || items.some((i) => i.listName);
  if (!hasList) {
    return { ok: false, error: "listName is required (or provide listName per item)" };
  }

  if (items.length === 0) {
    return { ok: false, error: "items must contain at least one valid item" };
  }

  return { ok: true, data: { boardName, listName, items } };
}

export function validatePlanLenient(payload: unknown): ValidationResult<TaskPlan> {
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "Payload must be an object" };
  }

  const plan = payload as Record<string, unknown>;
  const boardName = typeof plan.boardName === "string" ? plan.boardName.trim() : "";
  const listName = typeof plan.listName === "string" ? plan.listName.trim() : "";

  const itemsRaw = Array.isArray(plan.items) ? plan.items : [];
  const items: PlanItem[] = [];

  for (const raw of itemsRaw) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const name =
      (typeof item.name === "string" ? item.name.trim() : "") ||
      (typeof item.title === "string" ? item.title.trim() : "") ||
      (typeof item.cardName === "string" ? item.cardName.trim() : "") ||
      "Untitled";
    const desc = typeof item.desc === "string" ? item.desc : "";
    const due = normalizeDue(item.due);
    const labels = toStringArray(item.labels);
    const checklist = toStringArray(item.checklist);
    const itemListName = typeof item.listName === "string" ? item.listName.trim() : undefined;

    items.push({
      name,
      desc,
      due,
      labels,
      checklist,
      listName: itemListName || undefined,
    });
  }

  return { ok: true, data: { boardName, listName, items } };
}

export function blankPlan(): TaskPlan {
  return {
    boardName: "",
    listName: "",
    items: [],
  };
}
