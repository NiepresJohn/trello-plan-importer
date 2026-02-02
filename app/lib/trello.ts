type TrelloResponse<T> = { ok: true; data: T } | { ok: false; status: number; text: string };

type TrelloBoard = { id: string; name: string };
type TrelloList = { id: string; name: string };
type TrelloLabel = { id: string; name: string | null; color: string | null };

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function buildTrelloUrl(path: string, params: Record<string, string>) {
  const url = new URL(`https://api.trello.com/1/${path}`);
  const search = new URLSearchParams(params);
  url.search = search.toString();
  return url;
}

async function trelloRequest(path: string, options: { method?: string; params?: Record<string, string>; body?: Record<string, string> }) {
  const key = requireEnv("TRELLO_KEY");
  const token = requireEnv("TRELLO_TOKEN");
  const params = { key, token, ...(options.params || {}) };
  const method = options.method || "GET";
  const url = buildTrelloUrl(path, params);

  if (method === "GET") {
    const res = await fetch(url, { method });
    const text = await res.text();
    if (!res.ok) return { ok: false, status: res.status, text } as TrelloResponse<never>;
    return { ok: true, data: JSON.parse(text) } as TrelloResponse<unknown>;
  }

  const form = new URLSearchParams(options.body || {});
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const text = await res.text();
  if (!res.ok) return { ok: false, status: res.status, text } as TrelloResponse<never>;
  return { ok: true, data: JSON.parse(text) } as TrelloResponse<unknown>;
}

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

export async function getBoards() {
  const res = await trelloRequest("members/me/boards", { params: { fields: "name" } });
  if (!res.ok) return res as TrelloResponse<TrelloBoard[]>;
  const boards = (res.data as Array<{ id: string; name: string }>).map((b) => ({ id: b.id, name: b.name }));
  return { ok: true, data: boards } as TrelloResponse<TrelloBoard[]>;
}

export async function createBoard(name: string) {
  const res = await trelloRequest("boards", {
    method: "POST",
    params: { name: name.trim(), defaultLists: "false" },
    body: {},
  });
  if (!res.ok) return res as TrelloResponse<TrelloBoard>;
  const raw = res.data as { id: string; name: string };
  return { ok: true, data: { id: raw.id, name: raw.name } } as TrelloResponse<TrelloBoard>;
}

export async function createList(boardId: string, name: string) {
  const res = await trelloRequest("lists", {
    method: "POST",
    body: { idBoard: boardId, name: name.trim() },
  });
  if (!res.ok) return res as TrelloResponse<TrelloList>;
  const raw = res.data as { id: string; name: string };
  return { ok: true, data: { id: raw.id, name: raw.name } } as TrelloResponse<TrelloList>;
}

export async function getLists(boardId: string) {
  const res = await trelloRequest(`boards/${boardId}/lists`, { params: { fields: "name" } });
  if (!res.ok) return res as TrelloResponse<TrelloList[]>;
  const lists = (res.data as Array<{ id: string; name: string }>).map((l) => ({ id: l.id, name: l.name }));
  return { ok: true, data: lists } as TrelloResponse<TrelloList[]>;
}

/** Archive a list (and its cards). Removes the list from the board. */
export async function archiveList(listId: string) {
  const res = await trelloRequest(`lists/${listId}`, {
    method: "PUT",
    body: { closed: "true" },
  });
  if (!res.ok) return res as TrelloResponse<never>;
  return { ok: true, data: res.data as TrelloList } as TrelloResponse<TrelloList>;
}

export async function getLabels(boardId: string) {
  const res = await trelloRequest(`boards/${boardId}/labels`, { params: { fields: "name,color" } });
  if (!res.ok) return res as TrelloResponse<TrelloLabel[]>;
  return { ok: true, data: res.data as TrelloLabel[] } as TrelloResponse<TrelloLabel[]>;
}

export async function createLabel(boardId: string, name: string) {
  const res = await trelloRequest("labels", {
    method: "POST",
    body: { idBoard: boardId, name, color: "blue" },
  });
  if (!res.ok) return res as TrelloResponse<TrelloLabel>;
  return { ok: true, data: res.data as TrelloLabel } as TrelloResponse<TrelloLabel>;
}

export async function addLabelToCard(cardId: string, labelId: string) {
  const res = await trelloRequest(`cards/${cardId}/idLabels`, {
    method: "POST",
    body: { value: labelId },
  });
  if (!res.ok) return res as TrelloResponse<unknown>;
  return { ok: true, data: res.data as unknown } as TrelloResponse<unknown>;
}

export async function createChecklist(cardId: string) {
  const res = await trelloRequest("checklists", {
    method: "POST",
    body: { idCard: cardId, name: "Checklist" },
  });
  if (!res.ok) return res as TrelloResponse<{ id: string }>;
  return { ok: true, data: res.data as { id: string } } as TrelloResponse<{ id: string }>;
}

export async function addChecklistItem(checklistId: string, name: string) {
  const res = await trelloRequest(`checklists/${checklistId}/checkItems`, {
    method: "POST",
    body: { name },
  });
  if (!res.ok) return res as TrelloResponse<unknown>;
  return { ok: true, data: res.data as unknown } as TrelloResponse<unknown>;
}

export async function resolveBoard(boardName: string, boardId?: string) {
  if (boardId) {
    const boards = await getBoards();
    if (!boards.ok) return boards;
    const match = boards.data.find((b) => b.id === boardId);
    return { ok: true, data: match || { id: boardId, name: null } } as TrelloResponse<TrelloBoard | { id: string; name: string | null }>;
  }
  const boards = await getBoards();
  if (!boards.ok) return boards;
  const match = boards.data.find((b) => normalizeName(b.name) === normalizeName(boardName));
  if (!match) {
    return {
      ok: false,
      status: 404,
      text: JSON.stringify({ error: `Board not found: ${boardName}`, availableBoards: boards.data.map((b) => b.name).sort() }),
    } as TrelloResponse<never>;
  }
  return { ok: true, data: match } as TrelloResponse<TrelloBoard>;
}

const allowBoardCreate = () => String(process.env.ALLOW_BOARD_CREATE ?? "true").toLowerCase() === "true";

export async function resolveOrCreateBoard(boardName: string, boardId?: string): Promise<TrelloResponse<TrelloBoard>> {
  const resolved = await resolveBoard(boardName, boardId);
  if (resolved.ok) {
    const data = resolved.data as TrelloBoard & { name: string | null };
    if (data.id) {
      const fallback = boardName.trim() || "Board";
      const name = data.name != null ? data.name : fallback;
      return { ok: true, data: { id: data.id, name } };
    }
  }
  if (!boardId && boardName.trim() && allowBoardCreate()) {
    const created = await createBoard(boardName);
    if (created.ok) return { ok: true, data: created.data };
  }
  return resolved as TrelloResponse<TrelloBoard>;
}

export async function resolveOrCreateList(boardId: string, listName: string): Promise<TrelloResponse<TrelloList>> {
  const resolved = await resolveList(boardId, listName);
  if (resolved.ok) return resolved;
  const name = listName.trim() || "To Do";
  const created = await createList(boardId, name);
  if (created.ok) return { ok: true, data: created.data };
  return resolved;
}

export async function resolveList(boardId: string, listName: string) {
  const lists = await getLists(boardId);
  if (!lists.ok) return lists as TrelloResponse<TrelloList>;
  const match = lists.data.find((l) => normalizeName(l.name) === normalizeName(listName));
  if (!match) {
    return {
      ok: false,
      status: 404,
      text: JSON.stringify({ error: `List not found: ${listName}`, availableLists: lists.data.map((l) => l.name).sort() }),
    } as TrelloResponse<never>;
  }
  return { ok: true, data: match } as TrelloResponse<TrelloList>;
}

export async function createCard(params: { listId: string; name: string; desc: string; due?: string }) {
  const res = await trelloRequest("cards", {
    method: "POST",
    body: { idList: params.listId, name: params.name, desc: params.desc, ...(params.due ? { due: params.due } : {}) },
  });
  if (!res.ok) return res as TrelloResponse<{ id: string; name: string; shortUrl: string }>;
  return { ok: true, data: res.data as { id: string; name: string; shortUrl: string } } as TrelloResponse<{
    id: string;
    name: string;
    shortUrl: string;
  }>;
}

export function normalizeDue(due: string | null) {
  if (!due) return null;
  const date = new Date(due);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}
