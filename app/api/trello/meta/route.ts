import { NextResponse } from "next/server";
import { getBoards, getLists, resolveOrCreateBoard, resolveOrCreateList } from "../../../lib/trello";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const boardName = url.searchParams.get("boardName")?.trim() || "";
  const boardId = url.searchParams.get("boardId")?.trim() || "";
  const listName = url.searchParams.get("listName")?.trim() || "";

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
      if (listName) {
        await resolveOrCreateList(resolved.data.id, listName);
      }
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
