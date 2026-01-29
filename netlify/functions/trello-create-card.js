const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "content-type,x-webhook-secret",
};

const rateState = new Map();

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
    body: JSON.stringify(body),
  };
}

function getClientIp(headers) {
  const xfwd = headers["x-forwarded-for"] || headers["X-Forwarded-For"];
  if (xfwd) {
    return xfwd.split(",")[0].trim();
  }
  return headers["x-nf-client-connection-ip"] || headers["X-NF-Client-Connection-IP"] || "unknown";
}

function enforceRateLimit(ip, limitPerMinute) {
  if (!limitPerMinute) return null;
  const now = Date.now();
  const windowMs = 60 * 1000;
  const entry = rateState.get(ip);
  if (!entry || now > entry.resetAt) {
    rateState.set(ip, { count: 1, resetAt: now + windowMs });
    return null;
  }
  if (entry.count >= limitPerMinute) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { retryAfter };
  }
  entry.count += 1;
  return null;
}

function parseJsonBody(body) {
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch (err) {
    return null;
  }
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function buildTrelloUrl(path, params) {
  const url = new URL(`https://api.trello.com/1/${path}`);
  const search = new URLSearchParams(params);
  url.search = search.toString();
  return url;
}

async function trelloRequest(path, { method = "GET", params = {}, body = null }) {
  const key = requireEnv("TRELLO_KEY");
  const token = requireEnv("TRELLO_TOKEN");
  const mergedParams = { key, token, ...params };

  if (method === "GET") {
    const url = buildTrelloUrl(path, mergedParams);
    const res = await fetch(url, { method });
    const text = await res.text();
    return { res, text };
  }

  const url = buildTrelloUrl(path, mergedParams);
  const form = new URLSearchParams(body || {});
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const text = await res.text();
  return { res, text };
}

async function fetchBoards() {
  const { res, text } = await trelloRequest("members/me/boards", {
    params: { fields: "name" },
  });
  if (!res.ok) {
    return { ok: false, status: res.status, text };
  }
  return { ok: true, data: JSON.parse(text) };
}

async function fetchLists(boardId) {
  const { res, text } = await trelloRequest(`boards/${boardId}/lists`, {
    params: { fields: "name" },
  });
  if (!res.ok) {
    return { ok: false, status: res.status, text };
  }
  return { ok: true, data: JSON.parse(text) };
}

async function fetchLabels(boardId) {
  const { res, text } = await trelloRequest(`boards/${boardId}/labels`, {
    params: { fields: "name,color" },
  });
  if (!res.ok) {
    return { ok: false, status: res.status, text };
  }
  return { ok: true, data: JSON.parse(text) };
}

async function createLabel(boardId, name) {
  const { res, text } = await trelloRequest("labels", {
    method: "POST",
    body: { idBoard: boardId, name, color: "blue" },
  });
  if (!res.ok) {
    return { ok: false, status: res.status, text };
  }
  return { ok: true, data: JSON.parse(text) };
}

async function addLabelToCard(cardId, labelId) {
  const { res, text } = await trelloRequest(`cards/${cardId}/idLabels`, {
    method: "POST",
    body: { value: labelId },
  });
  if (!res.ok) {
    return { ok: false, status: res.status, text };
  }
  return { ok: true, data: JSON.parse(text) };
}

async function createChecklist(cardId) {
  const { res, text } = await trelloRequest("checklists", {
    method: "POST",
    body: { idCard: cardId, name: "Checklist" },
  });
  if (!res.ok) {
    return { ok: false, status: res.status, text };
  }
  return { ok: true, data: JSON.parse(text) };
}

async function addChecklistItem(checklistId, name) {
  const { res, text } = await trelloRequest(`checklists/${checklistId}/checkItems`, {
    method: "POST",
    body: { name },
  });
  if (!res.ok) {
    return { ok: false, status: res.status, text };
  }
  return { ok: true, data: JSON.parse(text) };
}

function normalizeName(value) {
  return value.trim().toLowerCase();
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { ok: false, error: "Method not allowed" });
  }

  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    return jsonResponse(500, { ok: false, error: "Server missing WEBHOOK_SECRET" });
  }

  const providedSecret = event.headers["x-webhook-secret"] || event.headers["X-Webhook-Secret"];
  if (!providedSecret || providedSecret !== secret) {
    return jsonResponse(401, { ok: false, error: "Unauthorized: invalid or missing x-webhook-secret" });
  }

  const rateLimit = process.env.RATE_LIMIT_PER_MINUTE;
  if (rateLimit) {
    const limit = Number(rateLimit);
    if (Number.isFinite(limit) && limit > 0) {
      const ip = getClientIp(event.headers);
      const limited = enforceRateLimit(ip, limit);
      if (limited) {
        return {
          statusCode: 429,
          headers: { "Content-Type": "application/json", "Retry-After": String(limited.retryAfter), ...corsHeaders },
          body: JSON.stringify({ ok: false, error: "Rate limit exceeded" }),
        };
      }
    }
  }

  const body = parseJsonBody(event.body);
  if (body === null) {
    return jsonResponse(400, { ok: false, error: "Invalid JSON body" });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return jsonResponse(400, { ok: false, error: "Missing required field: name" });
  }

  let boardName = typeof body.boardName === "string" ? body.boardName.trim() : "";
  let listName = typeof body.listName === "string" ? body.listName.trim() : "";

  if (!boardName) {
    boardName = (process.env.DEFAULT_BOARD_NAME || "").trim();
  }
  if (!listName) {
    listName = (process.env.DEFAULT_LIST_NAME || "").trim();
  }

  const defaultBoardId = (process.env.DEFAULT_BOARD_ID || "").trim();
  if (!boardName && !defaultBoardId) {
    return jsonResponse(400, { ok: false, error: "Missing boardName and DEFAULT_BOARD_NAME/DEFAULT_BOARD_ID" });
  }
  if (!listName) {
    return jsonResponse(400, { ok: false, error: "Missing listName and DEFAULT_LIST_NAME" });
  }

  if (body.due) {
    const dueDate = new Date(body.due);
    if (Number.isNaN(dueDate.getTime())) {
      return jsonResponse(400, { ok: false, error: "Invalid due date; must be ISO8601" });
    }
  }

  let resolvedBoardId = defaultBoardId || "";
  let resolvedBoardName = boardName || "";

  if (boardName) {
    const boardsResp = await fetchBoards();
    if (!boardsResp.ok) {
      return jsonResponse(502, {
        ok: false,
        error: "Trello API error while fetching boards",
        trelloStatus: boardsResp.status,
        trelloBody: boardsResp.text,
      });
    }

    const boards = boardsResp.data;
    const match = boards.find((b) => normalizeName(b.name) === normalizeName(boardName));
    if (!match) {
      return jsonResponse(404, {
        ok: false,
        error: `Board not found: ${boardName}`,
        availableBoards: boards.map((b) => b.name).sort(),
      });
    }
    resolvedBoardId = match.id;
    resolvedBoardName = match.name;
  }

  if (!resolvedBoardId) {
    return jsonResponse(400, { ok: false, error: "Unable to resolve board ID" });
  }

  const listsResp = await fetchLists(resolvedBoardId);
  if (!listsResp.ok) {
    return jsonResponse(502, {
      ok: false,
      error: "Trello API error while fetching lists",
      trelloStatus: listsResp.status,
      trelloBody: listsResp.text,
    });
  }

  const lists = listsResp.data;
  const listMatch = lists.find((l) => normalizeName(l.name) === normalizeName(listName));
  if (!listMatch) {
    return jsonResponse(404, {
      ok: false,
      error: `List not found: ${listName}`,
      availableLists: lists.map((l) => l.name).sort(),
      board: resolvedBoardName,
    });
  }

  const desc = typeof body.desc === "string" ? body.desc : "";
  const due = body.due ? body.due : undefined;

  const { res: cardRes, text: cardText } = await trelloRequest("cards", {
    method: "POST",
    body: {
      idList: listMatch.id,
      name,
      desc,
      ...(due ? { due } : {}),
    },
  });

  if (!cardRes.ok) {
    return jsonResponse(502, {
      ok: false,
      error: "Trello API error while creating card",
      trelloStatus: cardRes.status,
      trelloBody: cardText,
    });
  }

  const card = JSON.parse(cardText);

  const labels = Array.isArray(body.labels) ? body.labels.filter((l) => typeof l === "string" && l.trim()) : [];
  if (labels.length > 0) {
    const labelsResp = await fetchLabels(resolvedBoardId);
    if (!labelsResp.ok) {
      return jsonResponse(502, {
        ok: false,
        error: "Trello API error while fetching labels",
        trelloStatus: labelsResp.status,
        trelloBody: labelsResp.text,
      });
    }

    const existingLabels = labelsResp.data;
    const allowCreate = String(process.env.ALLOW_LABEL_CREATE || "").toLowerCase() === "true";

    for (const labelName of labels) {
      const existing = existingLabels.find(
        (label) => label.name && normalizeName(label.name) === normalizeName(labelName)
      );
      let labelId = existing ? existing.id : null;

      if (!labelId && allowCreate) {
        const created = await createLabel(resolvedBoardId, labelName);
        if (!created.ok) {
          return jsonResponse(502, {
            ok: false,
            error: `Trello API error while creating label: ${labelName}`,
            trelloStatus: created.status,
            trelloBody: created.text,
          });
        }
        labelId = created.data.id;
      }

      if (labelId) {
        const attached = await addLabelToCard(card.id, labelId);
        if (!attached.ok) {
          return jsonResponse(502, {
            ok: false,
            error: `Trello API error while attaching label: ${labelName}`,
            trelloStatus: attached.status,
            trelloBody: attached.text,
          });
        }
      }
    }
  }

  const checklist = Array.isArray(body.checklist)
    ? body.checklist.filter((item) => typeof item === "string" && item.trim())
    : [];
  if (checklist.length > 0) {
    const checklistResp = await createChecklist(card.id);
    if (!checklistResp.ok) {
      return jsonResponse(502, {
        ok: false,
        error: "Trello API error while creating checklist",
        trelloStatus: checklistResp.status,
        trelloBody: checklistResp.text,
      });
    }

    for (const item of checklist) {
      const added = await addChecklistItem(checklistResp.data.id, item);
      if (!added.ok) {
        return jsonResponse(502, {
          ok: false,
          error: `Trello API error while adding checklist item: ${item}`,
          trelloStatus: added.status,
          trelloBody: added.text,
        });
      }
    }
  }

  return jsonResponse(200, {
    ok: true,
    card: { id: card.id, name: card.name, shortUrl: card.shortUrl },
    resolved: { boardName: resolvedBoardName, listName: listMatch.name },
  });
}
