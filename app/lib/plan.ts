export type LabelInput = string | { name: string; color?: string };

export type PlanItem = {
  name: string;
  desc: string;
  due: string | null;
  labels: LabelInput[];
  checklist: string[];
  listName?: string;
};

export type TaskPlan = {
  boardName: string;
  listName: string;
  items: PlanItem[];
};

export type ValidationResult<T> = { ok: true; data: T } | { ok: false; error: string };

export const PLAN_LIMITS = {
  MAX_ITEMS: 100,
  MAX_NAME_LENGTH: 500,
  MAX_DESC_LENGTH: 5000,
  MAX_LABELS_PER_ITEM: 10,
  MAX_CHECKLIST_ITEMS: 50,
} as const;

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean);
}

const VALID_LABEL_COLORS = new Set([
  "yellow", "purple", "blue", "red", "green",
  "orange", "black", "sky", "pink", "lime",
]);

function toLabelArray(value: unknown): LabelInput[] {
  if (!Array.isArray(value)) return [];
  const result: LabelInput[] = [];
  for (const item of value) {
    if (typeof item === "string" && item.trim()) {
      result.push(item.trim());
    } else if (item && typeof item === "object") {
      const obj = item as Record<string, unknown>;
      const name = (typeof obj.name === "string" ? obj.name : "").trim();
      if (!name) continue;
      const color =
        typeof obj.color === "string" && VALID_LABEL_COLORS.has(obj.color.toLowerCase())
          ? obj.color.toLowerCase()
          : undefined;
      result.push(color ? { name, color } : name);
    }
  }
  return result;
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
  if (boardName.length > PLAN_LIMITS.MAX_NAME_LENGTH) {
    return { ok: false, error: `boardName exceeds ${PLAN_LIMITS.MAX_NAME_LENGTH} characters` };
  }

  const itemsRaw = Array.isArray(plan.items) ? plan.items : [];
  if (itemsRaw.length > PLAN_LIMITS.MAX_ITEMS) {
    return { ok: false, error: `Plan exceeds maximum of ${PLAN_LIMITS.MAX_ITEMS} items` };
  }

  const items: PlanItem[] = [];
  const errors: string[] = [];

  for (let i = 0; i < itemsRaw.length; i++) {
    const raw = itemsRaw[i];
    if (!raw || typeof raw !== "object") {
      errors.push(`Item ${i + 1}: invalid format`);
      continue;
    }
    const item = raw as Record<string, unknown>;
    const name = typeof item.name === "string" ? item.name.trim() : "";
    if (!name) {
      errors.push(`Item ${i + 1}: name is required`);
      continue;
    }
    if (name.length > PLAN_LIMITS.MAX_NAME_LENGTH) {
      errors.push(`Item ${i + 1}: name exceeds ${PLAN_LIMITS.MAX_NAME_LENGTH} characters`);
      continue;
    }
    const desc = typeof item.desc === "string" ? item.desc : "";
    if (desc.length > PLAN_LIMITS.MAX_DESC_LENGTH) {
      errors.push(`Item ${i + 1}: description exceeds ${PLAN_LIMITS.MAX_DESC_LENGTH} characters`);
      continue;
    }
    const due = normalizeDue(item.due);
    const labels = toLabelArray(item.labels).slice(0, PLAN_LIMITS.MAX_LABELS_PER_ITEM);
    const checklist = toStringArray(item.checklist).slice(0, PLAN_LIMITS.MAX_CHECKLIST_ITEMS);
    const itemListName = typeof item.listName === "string" ? item.listName.trim() : undefined;

    items.push({ name, desc, due, labels, checklist, listName: itemListName || undefined });
  }

  const hasList = listName || items.some((i) => i.listName);
  if (!hasList) {
    return { ok: false, error: "listName is required (or provide listName per item)" };
  }

  if (items.length === 0) {
    return { ok: false, error: errors.length > 0 ? errors.join("; ") : "items must contain at least one valid item" };
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

  if (!boardName) {
    return { ok: false, error: "boardName is required" };
  }

  const itemsRaw = Array.isArray(plan.items) ? plan.items : [];
  if (itemsRaw.length > PLAN_LIMITS.MAX_ITEMS) {
    return { ok: false, error: `Plan exceeds maximum of ${PLAN_LIMITS.MAX_ITEMS} items` };
  }

  const items: PlanItem[] = [];

  for (const raw of itemsRaw) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const name =
      (typeof item.name === "string" ? item.name.trim() : "") ||
      (typeof item.title === "string" ? item.title.trim() : "") ||
      (typeof item.cardName === "string" ? item.cardName.trim() : "") ||
      "Untitled";
    if (name.length > PLAN_LIMITS.MAX_NAME_LENGTH) continue;
    const desc = typeof item.desc === "string" ? item.desc.slice(0, PLAN_LIMITS.MAX_DESC_LENGTH) : "";
    const due = normalizeDue(item.due);
    const labels = toLabelArray(item.labels).slice(0, PLAN_LIMITS.MAX_LABELS_PER_ITEM);
    const checklist = toStringArray(item.checklist).slice(0, PLAN_LIMITS.MAX_CHECKLIST_ITEMS);
    const itemListName = typeof item.listName === "string" ? item.listName.trim() : undefined;

    items.push({ name, desc, due, labels, checklist, listName: itemListName || undefined });
  }

  if (items.length === 0) {
    return { ok: false, error: "Plan must contain at least one item" };
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
