// netlify/functions/trello-seed-board.js

function json(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type,x-webhook-secret",
      "access-control-allow-methods": "POST,OPTIONS",
    },
  });
}

function normalizeName(s) {
  return String(s || "").trim().toLowerCase();
}

async function trelloGet(path, key, token) {
  const url = new URL(`https://api.trello.com/1/${path}`);
  url.searchParams.set("key", key);
  url.searchParams.set("token", token);
  const res = await fetch(url.toString());
  const text = await res.text();
  if (!res.ok) throw new Error(`Trello GET ${path} failed: ${res.status} ${text}`);
  return JSON.parse(text);
}

async function trelloPost(path, key, token, paramsObj = {}) {
  const url = new URL(`https://api.trello.com/1/${path}`);
  url.searchParams.set("key", key);
  url.searchParams.set("token", token);
  for (const [k, v] of Object.entries(paramsObj)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), { method: "POST" });
  const text = await res.text();
  if (!res.ok) throw new Error(`Trello POST ${path} failed: ${res.status} ${text}`);
  return JSON.parse(text);
}

export default async (req) => {
  try {
    if (req.method === "OPTIONS") return json(200, { ok: true });
    if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" });

    const secret = req.headers.get("x-webhook-secret");
    if (!process.env.WEBHOOK_SECRET) return json(500, { ok: false, error: "Server missing WEBHOOK_SECRET" });
    if (!secret || secret !== process.env.WEBHOOK_SECRET) return json(401, { ok: false, error: "Unauthorized" });

    const key = process.env.TRELLO_KEY;
    const token = process.env.TRELLO_TOKEN;
    if (!key || !token) return json(500, { ok: false, error: "Server missing TRELLO_KEY or TRELLO_TOKEN" });

    const body = await req.json().catch(() => ({}));

    const boardName = body.boardName || process.env.DEFAULT_BOARD_NAME;
    if (!boardName) {
      return json(400, { ok: false, error: "Missing boardName (or set DEFAULT_BOARD_NAME)" });
    }

    // Default Web Dev template (override by sending lists/labels in body)
    const lists = Array.isArray(body.lists) && body.lists.length
      ? body.lists
      : ["Inbox", "Backlog", "Ready", "In Progress", "Review / QA", "Blocked", "Done", "Released"];

    const labels = Array.isArray(body.labels) && body.labels.length
      ? body.labels
      : ["Frontend", "Backend", "Bug", "Feature", "Chore", "Urgent", "Design", "DevOps"];

    // Resolve board by name
    const boards = await trelloGet("members/me/boards?fields=name", key, token);
    const board = boards.find(b => normalizeName(b.name) === normalizeName(boardName));
    if (!board) {
      return json(404, {
        ok: false,
        error: `Board not found: ${boardName}`,
        availableBoards: boards.map(b => b.name),
      });
    }

    // Fetch existing lists (including closed) so we don't duplicate names
    const existingLists = await trelloGet(`boards/${board.id}/lists?fields=name,closed`, key, token);
    const existingByName = new Map(existingLists.map(l => [normalizeName(l.name), l]));

    const createdLists = [];
    const skippedLists = [];

    for (const listName of lists) {
      const n = normalizeName(listName);
      if (!n) continue;

      const existing = existingByName.get(n);
      // If list exists and is open, skip. If it exists but is closed, create a new open list with same name.
      if (existing && existing.closed === false) {
        skippedLists.push({ name: existing.name, id: existing.id, reason: "already exists (open)" });
        continue;
      }

      const newList = await trelloPost(`boards/${board.id}/lists`, key, token, { name: String(listName).trim() });
      createdLists.push({ id: newList.id, name: newList.name });
    }

    // Labels: create missing labels (case-insensitive) - Trello label creation needs a color; Trello will accept some defaults.
    const existingLabels = await trelloGet(`boards/${board.id}/labels?fields=name,color`, key, token);
    const labelByName = new Map(existingLabels.map(l => [normalizeName(l.name), l]));

    const createdLabels = [];
    const skippedLabels = [];

    for (const labelName of labels) {
      const n = normalizeName(labelName);
      if (!n) continue;

      const existing = labelByName.get(n);
      if (existing) {
        skippedLabels.push({ id: existing.id, name: existing.name, reason: "already exists" });
        continue;
      }

      // Choose a safe default color; Trello requires a valid color keyword.
      const newLabel = await trelloPost("labels", key, token, {
        idBoard: board.id,
        name: String(labelName).trim(),
        color: "blue",
      });
      createdLabels.push({ id: newLabel.id, name: newLabel.name, color: newLabel.color });
    }

    return json(200, {
      ok: true,
      resolvedBoard: { id: board.id, name: board.name },
      lists: { created: createdLists, skipped: skippedLists },
      labels: { created: createdLabels, skipped: skippedLabels },
    });
  } catch (err) {
    return json(500, { ok: false, error: "Server error", message: err?.message || String(err) });
  }
};
