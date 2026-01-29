const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "content-type,x-webhook-secret",
};

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

function buildTrelloUrl(path, params) {
  const url = new URL(`https://api.trello.com/1/${path}`);
  const search = new URLSearchParams(params);
  url.search = search.toString();
  return url;
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function trelloRequest(path, { params = {} }) {
  const key = requireEnv("TRELLO_KEY");
  const token = requireEnv("TRELLO_TOKEN");
  const mergedParams = { key, token, ...params };
  const url = buildTrelloUrl(path, mergedParams);
  const res = await fetch(url, { method: "GET" });
  const text = await res.text();
  return { res, text };
}

function normalizeName(value) {
  return value.trim().toLowerCase();
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  if (event.httpMethod !== "GET") {
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

  const { res: boardsRes, text: boardsText } = await trelloRequest("members/me/boards", {
    params: { fields: "name" },
  });

  if (!boardsRes.ok) {
    return jsonResponse(502, {
      ok: false,
      error: "Trello API error while fetching boards",
      trelloStatus: boardsRes.status,
      trelloBody: boardsText,
    });
  }

  const boards = JSON.parse(boardsText).map((b) => ({ id: b.id, name: b.name }));

  const params = event.queryStringParameters || {};
  const boardName = typeof params.boardName === "string" ? params.boardName.trim() : "";
  const boardId = typeof params.boardId === "string" ? params.boardId.trim() : "";

  let lists = undefined;
  let resolvedBoard = undefined;

  if (boardName || boardId) {
    let resolvedBoardId = boardId;
    if (!resolvedBoardId && boardName) {
      const match = boards.find((b) => normalizeName(b.name) === normalizeName(boardName));
      if (!match) {
        return jsonResponse(404, {
          ok: false,
          error: `Board not found: ${boardName}`,
          availableBoards: boards.map((b) => b.name).sort(),
        });
      }
      resolvedBoardId = match.id;
      resolvedBoard = match;
    } else if (boardId) {
      resolvedBoard = boards.find((b) => b.id === boardId) || { id: boardId, name: null };
    }

    const { res: listsRes, text: listsText } = await trelloRequest(`boards/${resolvedBoardId}/lists`, {
      params: { fields: "name" },
    });

    if (!listsRes.ok) {
      return jsonResponse(502, {
        ok: false,
        error: "Trello API error while fetching lists",
        trelloStatus: listsRes.status,
        trelloBody: listsText,
      });
    }

    lists = JSON.parse(listsText).map((l) => ({ id: l.id, name: l.name }));
  }

  return jsonResponse(200, {
    ok: true,
    boards,
    lists,
    resolvedBoard,
  });
}
