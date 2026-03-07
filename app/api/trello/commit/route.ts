import { NextResponse } from "next/server";
import { validatePlan } from "../../../lib/plan";
import { validateWebhookSecret } from "../../../lib/auth";
import { checkRateLimit, getClientIp } from "../../../lib/rateLimit";
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
  // Fix #3: validate webhook secret
  if (!validateWebhookSecret(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // Fix #10: rate limiting
  const ip = getClientIp(request);
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ ok: false, error: "Too many requests. Please wait and try again." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const result = validatePlan((body as Record<string, unknown>).plan);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  // Fix #4: replace is now opt-in (defaults to false)
  const replace = (body as Record<string, unknown>).replace === true;

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

  // Fix #4: only archive existing lists when replace is explicitly true
  if (replace) {
    const existingLists = await getLists(resolvedBoard.data.id);
    if (existingLists.ok && existingLists.data.length > 0) {
      for (const list of existingLists.data) {
        await archiveList(list.id);
      }
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

      // Fix #7: support label color from PlanItem
      const labels = item.labels || [];
      if (labels.length > 0) {
        for (const label of labels) {
          const labelName = typeof label === "string" ? label : label.name;
          const labelColor = typeof label === "string" ? undefined : label.color;
          const existing = labelsResp.data.find(
            (l) => l.name && l.name.toLowerCase() === labelName.trim().toLowerCase()
          );
          let labelId = existing ? existing.id : null;
          if (!labelId && allowCreate) {
            const created = await createLabel(resolvedBoard.data.id, labelName, labelColor);
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
