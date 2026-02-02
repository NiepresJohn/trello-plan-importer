import { NextResponse } from "next/server";
import { validatePlan } from "../../../lib/plan";
import {
  addChecklistItem,
  addLabelToCard,
  archiveList,
  createCard,
  createChecklist,
  createLabel,
  getLabels,
  getLists,
  resolveOrCreateBoard,
  resolveOrCreateList,
} from "../../../lib/trello";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const result = validatePlan((body as Record<string, unknown>).plan);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  const plan = result.data;
  const defaultListName = plan.listName || process.env.DEFAULT_LIST_NAME || "To Do";

  const results = [] as Array<{ ok: boolean; name: string; listName?: string; shortUrl?: string; error?: string }>;

  const resolvedBoard = await resolveOrCreateBoard(plan.boardName, process.env.DEFAULT_BOARD_ID || undefined);
  if (!resolvedBoard.ok) {
    let parsed = null as null | Record<string, unknown>;
    try {
      parsed = JSON.parse(resolvedBoard.text);
    } catch {
      parsed = { error: "Board not found" };
    }
    return NextResponse.json({ ok: false, ...parsed }, { status: resolvedBoard.status });
  }

  // Replace behavior: archive all existing lists (and their cards) on the board before creating the new structure
  const existingLists = await getLists(resolvedBoard.data.id);
  if (existingLists.ok && existingLists.data.length > 0) {
    for (const list of existingLists.data) {
      await archiveList(list.id);
    }
  }

  const listNameToId = new Map<string, string>();
  async function getListId(listName: string): Promise<string | null> {
    const name = listName.trim() || defaultListName;
    let id = listNameToId.get(name);
    if (id) return id;
    const resolved = await resolveOrCreateList(resolvedBoard.data.id, name);
    if (!resolved.ok) return null;
    listNameToId.set(name, resolved.data.id);
    return resolved.data.id;
  }

  const labelsResp = await getLabels(resolvedBoard.data.id);
  if (!labelsResp.ok) {
    return NextResponse.json(
      { ok: false, error: "Trello API error while fetching labels", trelloStatus: labelsResp.status },
      { status: 502 }
    );
  }

  const allowCreate = String(process.env.ALLOW_LABEL_CREATE || "").toLowerCase() === "true";

  for (const item of plan.items) {
    const targetListName = (item.listName && item.listName.trim()) || defaultListName;
    const listId = await getListId(targetListName);
    if (!listId) {
      results.push({
        ok: false,
        name: item.name,
        listName: targetListName,
        error: `Could not resolve or create list: ${targetListName}`,
      });
      continue;
    }

    try {
      const cardResp = await createCard({
        listId,
        name: item.name,
        desc: item.desc,
        due: item.due || undefined,
      });
      if (!cardResp.ok) {
        results.push({
          ok: false,
          name: item.name,
          listName: targetListName,
          error: "Trello card creation failed",
        });
        continue;
      }

      const labels = item.labels || [];
      if (labels.length > 0) {
        for (const labelName of labels) {
          const existing = labelsResp.data.find(
            (label) => label.name && label.name.toLowerCase() === labelName.trim().toLowerCase()
          );
          let labelId = existing ? existing.id : null;
          if (!labelId && allowCreate) {
            const created = await createLabel(resolvedBoard.data.id, labelName);
            if (created.ok) {
              labelId = created.data.id;
            }
          }
          if (labelId) {
            await addLabelToCard(cardResp.data.id, labelId);
          }
        }
      }

      const checklist = item.checklist || [];
      if (checklist.length > 0) {
        const checklistResp = await createChecklist(cardResp.data.id);
        if (checklistResp.ok) {
          for (const entry of checklist) {
            await addChecklistItem(checklistResp.data.id, entry);
          }
        }
      }

      results.push({
        ok: true,
        name: item.name,
        listName: targetListName,
        shortUrl: cardResp.data.shortUrl,
      });
    } catch (err) {
      results.push({
        ok: false,
        name: item.name,
        listName: targetListName,
        error: err instanceof Error ? err.message : "Network error",
      });
    }
  }

  return NextResponse.json({ ok: true, results });
}
