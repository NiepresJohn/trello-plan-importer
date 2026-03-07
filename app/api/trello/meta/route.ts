import { NextResponse } from "next/server";
import { getBoards, getLists, resolveOrCreateBoard } from "../../../lib/trello";
import { validateWebhookSecret } from "../../../lib/auth";
import { checkRateLimit, getClientIp } from "../../../lib/rateLimit";

export async function GET(request: Request) {
  // Fix #3: validate webhook secret
  if (!validateWebhookSecret(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // Fix #10: rate limiting
  const ip = getClientIp(request);
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ ok: false, error: "Too many requests. Please wait and try again." }, { status: 429 });
  }

  const url = new URL(request.url);
  const boardName = url.searchParams.get("boardName")?.trim() || "";
  const boardId = url.searchParams.get("boardId")?.trim() || "";

  // Fix #5: removed listName param — GET routes must not have side effects.
  // List creation only happens at commit time via POST /api/trello/commit.

  try {
    const boardsResp = await getBoards();
    if (!boardsResp.ok) {
      return NextResponse.json(
        { ok: false, error: "Trello API error while fetching boards", trelloStatus: boardsResp.status },
        { status: 502 }
      );
    }

    let lists = undefined;
    let resolvedBoard = undefined;

    if (boardName || boardId) {
      const resolved = await resolveOrCreateBoard(boardName, boardId || undefined);
      if (!resolved.ok) {
        let parsed = null as null | Record<string, unknown>;
        try {
          parsed = JSON.parse(resolved.text);
        } catch {
          parsed = { error: "Board not found" };
        }
        return NextResponse.json({ ok: false, ...parsed }, { status: resolved.status });
      }
      resolvedBoard = resolved.data;
      const listResp = await getLists(resolved.data.id);
      if (!listResp.ok) {
        return NextResponse.json(
          { ok: false, error: "Trello API error while fetching lists", trelloStatus: listResp.status },
          { status: 502 }
        );
      }
      lists = listResp.data;
    }

    return NextResponse.json({
      ok: true,
      boards: boardsResp.data,
      lists,
      resolvedBoard,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Failed to reach Trello API" },
      { status: 502 }
    );
  }
}
