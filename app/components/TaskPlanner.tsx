"use client";

import { useEffect, useMemo, useState } from "react";
import { blankPlan, TaskPlan, PlanItem, validatePlanLenient } from "../lib/plan";

type Board = { id: string; name: string };

type List = { id: string; name: string };

type CommitResult = {
  ok: boolean;
  name: string;
  listName?: string;
  shortUrl?: string;
  error?: string;
};

function toLocalDateTime(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function fromLocalDateTime(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function Stepper({
  activeStep,
  canStep2,
  canStep3,
  canStep4,
  onStep,
  compact = false,
}: {
  activeStep: 1 | 2 | 3 | 4;
  canStep2: boolean;
  canStep3: boolean;
  canStep4: boolean;
  onStep: (step: 1 | 2 | 3 | 4) => void;
  compact?: boolean;
}) {
  return (
    <div className={`stepper ${compact ? "compact" : ""}`} role="tablist" aria-label="Setup steps">
      <button
        type="button"
        className={`step ${activeStep > 1 ? "done" : ""} ${activeStep === 1 ? "active" : ""}`}
        onClick={() => onStep(1)}
        aria-current={activeStep === 1 ? "step" : undefined}
      >
        <span className="step-dot">1</span>
        <span className="step-label">Import JSON</span>
      </button>
      <button
        type="button"
        className={`step ${activeStep > 2 ? "done" : ""} ${activeStep === 2 ? "active" : ""}`}
        onClick={() => onStep(2)}
        disabled={!canStep2}
        aria-current={activeStep === 2 ? "step" : undefined}
      >
        <span className="step-dot">2</span>
        <span className="step-label">Board &amp; List</span>
      </button>
      <button
        type="button"
        className={`step ${activeStep > 3 ? "done" : ""} ${activeStep === 3 ? "active" : ""}`}
        onClick={() => onStep(3)}
        disabled={!canStep3}
        aria-current={activeStep === 3 ? "step" : undefined}
      >
        <span className="step-dot">3</span>
        <span className="step-label">Review Cards</span>
      </button>
      <button
        type="button"
        className={`step ${activeStep > 4 ? "done" : ""} ${activeStep === 4 ? "active" : ""}`}
        onClick={() => onStep(4)}
        disabled={!canStep4}
        aria-current={activeStep === 4 ? "step" : undefined}
      >
        <span className="step-dot">4</span>
        <span className="step-label">Commit</span>
      </button>
    </div>
  );
}

export default function TaskPlanner() {
  const [draftPlan, setDraftPlan] = useState<TaskPlan>(blankPlan());
  const [importText, setImportText] = useState("");
  const [boards, setBoards] = useState<Board[]>([]);
  const [lists, setLists] = useState<List[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [commitResults, setCommitResults] = useState<CommitResult[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1);
  const [showCommitModal, setShowCommitModal] = useState(false);
  const [showCommitSuccessToast, setShowCommitSuccessToast] = useState(false);
  const [savedDraftAt, setSavedDraftAt] = useState<string | null>(null);
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  const [importResult, setImportResult] = useState<
    { ok: true; itemCount: number; boardName: string; listName: string } | { ok: false; error: string } | null
  >(null);

  const hasBoard = draftPlan.boardName.trim().length > 0;
  const hasItems = draftPlan.items.some((item) => item.name.trim().length > 0);
  const planReady = hasBoard && hasItems;

  const selectedBoard = useMemo(
    () => boards.find((board) => board.name === draftPlan.boardName) || null,
    [boards, draftPlan.boardName]
  );

  async function loadBoards() {
    setLoadingMeta(true);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/trello/meta");
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to load Trello boards");
      }
      setBoards(data.boards || []);
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Failed to load Trello metadata");
    } finally {
      setLoadingMeta(false);
    }
  }

  async function loadLists(boardName: string, listName?: string) {
    if (!boardName) {
      setLists([]);
      return;
    }
    setLoadingMeta(true);
    setStatusMessage(null);
    try {
      const query = new URLSearchParams({ boardName });
      if (listName && listName.trim()) query.set("listName", listName.trim());
      const res = await fetch(`/api/trello/meta?${query.toString()}`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to load Trello lists");
      }
      setLists(data.lists || []);
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Failed to load Trello metadata");
    } finally {
      setLoadingMeta(false);
    }
  }

  useEffect(() => {
    loadBoards();
  }, []);


  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("aitrello_draft_plan");
    const storedAt = window.localStorage.getItem("aitrello_draft_saved_at");
    if (stored) {
      setHasSavedDraft(true);
    }
    if (storedAt) {
      setSavedDraftAt(storedAt);
    }
  }, []);

  useEffect(() => {
    if (!showCommitSuccessToast) return;
    const t = setTimeout(() => setShowCommitSuccessToast(false), 6000);
    return () => clearTimeout(t);
  }, [showCommitSuccessToast]);

  function isPlanLike(value: unknown): value is TaskPlan {
    if (!value || typeof value !== "object") return false;
    const plan = value as Record<string, unknown>;
    if (typeof plan.boardName !== "string" || typeof plan.listName !== "string") return false;
    if (!Array.isArray(plan.items)) return false;
    return true;
  }

  function saveDraft() {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("aitrello_draft_plan", JSON.stringify(draftPlan));
    const now = new Date().toISOString();
    window.localStorage.setItem("aitrello_draft_saved_at", now);
    setSavedDraftAt(now);
    setHasSavedDraft(true);
    setStatusMessage("Draft saved locally.");
  }

  function restoreDraft() {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("aitrello_draft_plan");
    if (!stored) {
      setStatusMessage("No saved draft found.");
      return;
    }
    try {
      const parsed = JSON.parse(stored);
      if (!isPlanLike(parsed)) {
        throw new Error("Saved draft is invalid.");
      }
      setDraftPlan(parsed);
      setStatusMessage("Saved draft restored.");
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Saved draft could not be restored.");
    }
  }

  function resetDraft() {
    setDraftPlan(blankPlan());
    setCommitResults([]);
    setStatusMessage("Draft reset. Nothing has been sent to Trello.");
  }

  function loadFromJson() {
    if (!importText.trim()) {
      setStatusMessage("Paste a JSON plan before importing.");
      return;
    }
    try {
      const parsed = JSON.parse(importText);
      let normalized = parsed as Record<string, unknown>;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const obj = parsed as Record<string, unknown>;
        if (Array.isArray(obj.cards) && !Array.isArray(obj.items)) {
          normalized = { ...obj, items: obj.cards };
        } else if (Array.isArray(obj.tasks) && !Array.isArray(obj.items)) {
          normalized = { ...obj, items: obj.tasks };
        } else if (obj.board && typeof obj.board === "object" && !Array.isArray(obj.items)) {
          const board = obj.board as Record<string, unknown>;
          const listsRaw = Array.isArray(board.lists) ? board.lists : Array.isArray(board.columns) ? board.columns : [];
          const labelsRaw = Array.isArray(board.labels) ? board.labels : [];
          const labelMap = new Map<string, string>();
          for (const label of labelsRaw) {
            if (!label || typeof label !== "object") continue;
            const entry = label as Record<string, unknown>;
            const id = typeof entry.id === "string" ? entry.id : "";
            const name = typeof entry.name === "string" ? entry.name : "";
            if (id && name) labelMap.set(id, name);
          }
          const firstListObj = listsRaw.length > 0 && listsRaw[0] && typeof listsRaw[0] === "object" ? (listsRaw[0] as Record<string, unknown>) : null;
          const firstListName = firstListObj
            ? (typeof firstListObj.name === "string" ? firstListObj.name : typeof firstListObj.title === "string" ? firstListObj.title : "").trim()
            : "";
          const items: Array<Record<string, unknown>> = [];
          for (const list of listsRaw) {
            if (!list || typeof list !== "object") continue;
            const listObj = list as Record<string, unknown>;
            const listNameForItems =
              (typeof listObj.name === "string" ? listObj.name : typeof listObj.title === "string" ? listObj.title : "").trim() ||
              "To Do";
            const cards =
              Array.isArray(listObj.cards) ? listObj.cards
              : Array.isArray(listObj.items) ? listObj.items
              : Array.isArray(listObj.tasks) ? listObj.tasks
              : [];
            for (const card of cards) {
              if (!card) continue;
              if (typeof card === "string") {
                items.push({
                  name: card.trim() || "Untitled",
                  desc: "",
                  due: null,
                  labels: [],
                  checklist: [],
                  listName: listNameForItems,
                });
                continue;
              }
              if (typeof card !== "object") continue;
              const cardObj = card as Record<string, unknown>;
              const title = typeof cardObj.title === "string" ? cardObj.title : "";
              const name =
                (typeof cardObj.name === "string" ? cardObj.name : title).trim() ||
                (typeof cardObj.cardName === "string" ? cardObj.cardName : "").trim() ||
                "Untitled";
              const desc =
                typeof cardObj.description === "string"
                  ? cardObj.description
                  : typeof cardObj.desc === "string"
                    ? cardObj.desc
                    : "";
              const labelIds = Array.isArray(cardObj.labelIds) ? cardObj.labelIds : [];
              const labelsAsStrings = Array.isArray(cardObj.labels)
                ? (cardObj.labels as unknown[]).filter((x) => typeof x === "string").map((x) => String(x).trim()).filter(Boolean)
                : [];
              const labelsResolved =
                labelsAsStrings.length > 0
                  ? labelsAsStrings
                  : labelIds.map((id) => labelMap.get(id != null ? String(id) : "")).filter((value): value is string => Boolean(value));
              items.push({
                name,
                desc,
                due: null,
                labels: labelsResolved,
                checklist: [],
                listName: listNameForItems,
              });
            }
          }
          normalized = {
            boardName: typeof board.name === "string" ? board.name : "",
            listName: firstListName || "To Do",
            items,
          };
        }
      }

      if (Array.isArray(normalized.items)) {
        normalized = {
          ...normalized,
          items: normalized.items.map((it: Record<string, unknown>) => {
            const item = it ?? {};
            const rawName =
              typeof item.name === "string"
                ? (item.name as string).trim()
                : typeof item.title === "string"
                  ? (item.title as string).trim()
                  : typeof item.cardName === "string"
                    ? (item.cardName as string).trim()
                    : typeof it === "string"
                      ? String(it).trim()
                      : "";
            const name = rawName || "Untitled";
            const desc =
              typeof item.desc === "string"
                ? item.desc
                : typeof item.description === "string"
                  ? item.description
                  : "";
            return {
              name,
              desc,
              due: item.due,
              labels: item.labels,
              checklist: item.checklist,
              listName: typeof item.listName === "string" ? item.listName.trim() : undefined,
            };
          }),
        };
      }

      const validation = validatePlanLenient(normalized);
      if (!validation.ok) {
        const msg = validation.error ?? "Invalid plan JSON. Expect { items: [{ name, desc, labels, checklist, due }] }.";
        setStatusMessage(msg);
        setImportResult({ ok: false, error: msg });
        return;
      }
      if (validation.data.items.length === 0) {
        const msg =
          "No cards were found. Your JSON structure may not match. " +
          "Expected: a board with lists (each list with cards/items/tasks), or a top-level items array " +
          "where each item has name or title.";
        setStatusMessage(msg);
        setImportResult({ ok: false, error: msg });
        return;
      }
      setDraftPlan(validation.data);
      setCommitResults([]);
      setStatusMessage("Draft loaded from JSON.");
      setImportResult({
        ok: true,
        itemCount: validation.data.items.length,
        boardName: validation.data.boardName,
        listName: validation.data.listName,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid JSON.";
      setStatusMessage(msg);
      setImportResult({ ok: false, error: msg });
    }
  }

  function updatePlanField(field: "boardName" | "listName", value: string) {
    setDraftPlan((prev) => ({ ...prev, [field]: value }));
  }

  function updateItem(index: number, patch: Partial<PlanItem>) {
    setDraftPlan((prev) => {
      const items = prev.items.map((item, idx) => (idx === index ? { ...item, ...patch } : item));
      return { ...prev, items };
    });
  }

  function addItem() {
    setDraftPlan((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          name: "",
          desc: "",
          due: null,
          labels: [],
          checklist: [],
        },
      ],
    }));
  }

  function removeItem(index: number) {
    setDraftPlan((prev) => {
      const items = prev.items.filter((_, idx) => idx !== index);
      return { ...prev, items };
    });
  }

  function addLabel(index: number, label: string) {
    if (!label.trim()) return;
    updateItem(index, { labels: [...draftPlan.items[index].labels, label.trim()] });
  }

  function removeLabel(index: number, labelIndex: number) {
    const labels = draftPlan.items[index].labels.filter((_, idx) => idx !== labelIndex);
    updateItem(index, { labels });
  }

  function addChecklistItem(index: number, text: string) {
    if (!text.trim()) return;
    updateItem(index, { checklist: [...draftPlan.items[index].checklist, text.trim()] });
  }

  function removeChecklistItem(index: number, itemIndex: number) {
    const checklist = draftPlan.items[index].checklist.filter((_, idx) => idx !== itemIndex);
    updateItem(index, { checklist });
  }

  const COMMIT_SUCCESS_MSG = "Commit successful. Please check your newly created Trello board.";

  async function commitPlan() {
    setStatusMessage(null);
    setCommitResults([]);

    try {
      const res = await fetch("/api/trello/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: draftPlan }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Commit failed");
      }
      setCommitResults(data.results || []);
      setStatusMessage(COMMIT_SUCCESS_MSG);
      setShowCommitSuccessToast(true);
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Commit failed");
    }
  }

  function openCommitModal() {
    if (!planReady) return;
    setShowCommitModal(true);
  }

  return (
    <section className="workspace">
      <div className="panel editor">
        <div className="panel-header">
          <h2>Draft / Review</h2>
          <p>Edit cards, labels, and checklists before committing anything to Trello.</p>
        </div>

        <Stepper
          activeStep={activeStep}
          canStep2={hasItems}
          canStep3={hasBoard}
          canStep4={planReady}
          onStep={setActiveStep}
        />
        <div className="draft-section">
          {activeStep === 1 && (
            <div className="import-panel">
            <label>Import JSON plan</label>
            <textarea
              value={importText}
              onChange={(event) => {
                setImportText(event.target.value);
                setImportResult(null);
              }}
              placeholder="Paste plan JSON here..."
              rows={6}
            />
            <div className="editor-actions">
              <button className="ghost" onClick={loadFromJson} type="button">
                Load JSON plan
              </button>
              <button
                className="ghost"
                onClick={() => {
                  setImportText("");
                  setImportResult(null);
                }}
                type="button"
              >
                Clear
              </button>
            </div>
            {importResult && (
              <div
                className={`import-confirm ${importResult.ok ? "import-success" : "import-error"}`}
                role="status"
                aria-live="polite"
              >
                {importResult.ok ? (
                  <>
                    <strong>Plan loaded successfully.</strong>
                    <span>
                      {importResult.itemCount} card{importResult.itemCount === 1 ? "" : "s"}
                      {importResult.boardName ? ` · Board: ${importResult.boardName}` : ""}
                      {importResult.listName ? ` · List: ${importResult.listName}` : ""}
                    </span>
                    <span className="import-confirm-hint">You can proceed to the next step.</span>
                  </>
                ) : (
                  <>
                    <strong>Load failed.</strong>
                    <span>{importResult.error}</span>
                    <span className="import-confirm-hint">Fix the JSON and click &quot;Load JSON plan&quot; again.</span>
                  </>
                )}
              </div>
            )}
            <p className="helper">
              Paste JSON with a <code>board</code> (name, labels, lists) where each list has <code>cards</code> with{" "}
              <code>title</code> and <code>description</code>, or a top-level <code>items</code> array. We validate before any Trello action.
            </p>
            <div className="step-actions">
              <button
                className="primary"
                type="button"
                onClick={() => setActiveStep(2)}
                disabled={!hasItems}
              >
                Next: Board &amp; List
              </button>
            </div>
            {!hasItems && !importResult?.ok && (
              <p className="helper">Click &quot;Load JSON plan&quot; to validate and load, then proceed.</p>
            )}
            {!hasItems && importResult?.ok === false && (
              <p className="helper">Fix the JSON and load again to continue.</p>
            )}
          </div>
          )}

          {activeStep === 2 && (
            <>
              <div className="draft-controls">
            <button className="ghost" onClick={saveDraft} type="button">
              Save draft
            </button>
            <button className="ghost" onClick={restoreDraft} type="button" disabled={!hasSavedDraft}>
              Restore saved
            </button>
            <button className="ghost" onClick={resetDraft} type="button">
              Reset draft
            </button>
            {savedDraftAt && (
              <span className="helper">Last saved: {new Date(savedDraftAt).toLocaleString()}</span>
            )}
              </div>

          <section className="step2-board-section" aria-labelledby="step2-board-label">
            <h3 id="step2-board-label" className="step2-board-label">Board</h3>
            <div className="board-select-row">
              <div className="dropdown-wrap board-dropdown">
                <select
                  id="board-select"
                  className="dropdown-select"
                  value={draftPlan.boardName}
                  onChange={(event) => updatePlanField("boardName", event.target.value)}
                >
                  <option value="">Select a board</option>
                  {boards.map((board) => (
                    <option key={board.id} value={board.name}>
                      {board.name}
                    </option>
                  ))}
                  {draftPlan.boardName &&
                    !boards.some((b) => b.name === draftPlan.boardName) && (
                      <option value={draftPlan.boardName}>{draftPlan.boardName}</option>
                    )}
                </select>
              </div>
              <button
                type="button"
                className="board-refresh-btn"
                onClick={loadBoards}
                disabled={loadingMeta}
              >
                {loadingMeta ? "Refreshing…" : "Refresh Trello metadata"}
              </button>
            </div>
            <p className="step2-helper">Lists come from your JSON; each card is created in its list on the board.</p>
          </section>
          <div className="step-actions">
            <button className="ghost" type="button" onClick={() => setActiveStep(1)}>
              Back
            </button>
            <button
              className="primary"
              type="button"
              onClick={() => setActiveStep(3)}
              disabled={!hasBoard}
            >
              Next: Review Cards
            </button>
          </div>
          {!hasBoard && <p className="helper">Select a board to continue.</p>}
            </>
          )}

          {activeStep === 3 && (
            <>
              <div className="card-grid">
                {draftPlan.items.length === 0 && (
                  <div className="empty">No draft yet. Import JSON or add cards manually.</div>
                )}
                {draftPlan.items.map((item, index) => (
                  <div className="card" key={`item-${index}`}>
                    <div className="card-header">
                      <h3>Card {index + 1}</h3>
                      <button className="ghost" onClick={() => removeItem(index)}>
                        Remove
                      </button>
                    </div>

                    <label>Title</label>
                    <input
                      type="text"
                      value={item.name}
                      onChange={(event) => updateItem(index, { name: event.target.value })}
                      placeholder="Card title"
                    />

                    <label>Description</label>
                    <textarea
                      value={item.desc}
                      onChange={(event) => updateItem(index, { desc: event.target.value })}
                      placeholder="Card description"
                      rows={3}
                    />

                    <div className="two-col">
                      <div>
                        <label>Due date</label>
                        <input
                          type="datetime-local"
                          value={toLocalDateTime(item.due)}
                          onChange={(event) => updateItem(index, { due: fromLocalDateTime(event.target.value) })}
                        />
                      </div>
                      <div>
                        <label>Labels</label>
                        <LabelEditor
                          labels={item.labels}
                          onAdd={(label) => addLabel(index, label)}
                          onRemove={(labelIndex) => removeLabel(index, labelIndex)}
                        />
                      </div>
                    </div>

                    <label>Checklist</label>
                    <ChecklistEditor
                      items={item.checklist}
                      onAdd={(text) => addChecklistItem(index, text)}
                      onRemove={(itemIndex) => removeChecklistItem(index, itemIndex)}
                    />
                  </div>
                ))}
              </div>

              <div className="editor-actions">
                <button onClick={addItem}>Add card</button>
                <button className="primary" type="button" onClick={() => setActiveStep(4)} disabled={!planReady}>
                  Next: Commit
                </button>
              </div>
            </>
          )}

          {activeStep === 4 && (
            <>
              <div className="editor-actions">
                <button className="ghost" type="button" onClick={() => setActiveStep(3)}>
                  Back
                </button>
                <button className="primary" onClick={openCommitModal} disabled={!planReady}>
                  Commit to Trello
                </button>
              </div>
              {!planReady && <p className="helper">Add a board, list, and at least one card to enable commit.</p>}
            </>
          )}
        </div>

        {statusMessage &&
          (activeStep === 1 || statusMessage !== "Draft loaded from JSON.") && (
            <div
              className={
                statusMessage === "Draft loaded from JSON." || statusMessage === COMMIT_SUCCESS_MSG
                  ? "status status-success"
                  : "status"
              }
            >
              {statusMessage}
            </div>
          )}

        {activeStep === 4 && (
          <div className="commit-section">
            <div className="panel-header committed">
              <h2>Commit / Confirm</h2>
              <p>Each card returns a success or failure and a Trello link when created.</p>
            </div>
            {commitResults.length === 0 ? (
              <div className="empty">No committed tasks yet.</div>
            ) : (
              <>
                <div
                  className={
                    commitResults.every((r) => r.ok)
                      ? "commit-banner commit-banner-success"
                      : "commit-banner commit-banner-partial"
                  }
                  role="status"
                  aria-live="polite"
                >
                  {commitResults.every((r) => r.ok)
                    ? COMMIT_SUCCESS_MSG
                    : `${commitResults.filter((r) => r.ok).length} of ${commitResults.length} cards created. Some cards could not be created; see list below.`}
                </div>
                <div className="deploy-progress" role="status" aria-live="polite">
                  <div className="deploy-progress-bar-wrap">
                    <div
                      className="deploy-progress-bar"
                      style={{
                        width: `${(commitResults.filter((r) => r.ok).length / commitResults.length) * 100}%`,
                      }}
                    />
                  </div>
                  <p className="deploy-progress-text">
                    {commitResults.filter((r) => r.ok).length} of {commitResults.length} cards created on the board
                  </p>
                </div>
                <ul className="results">
                  {commitResults.map((result, idx) => (
                    <li key={`result-${idx}`} className={result.ok ? "ok" : "error"}>
                      <span className="result-name">{result.name}</span>
                      {result.listName && <span className="result-list">{result.listName}</span>}
                      {result.ok && result.shortUrl ? (
                        <a href={result.shortUrl} target="_blank" rel="noreferrer">
                          View card
                        </a>
                      ) : result.ok ? (
                        <span className="muted">Created</span>
                      ) : (
                        <span className="muted">{result.error || "Failed"}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>
      {showCommitModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <h3>Confirm Trello commit</h3>
            <p>
              You are about to create {draftPlan.items.length} card{draftPlan.items.length === 1 ? "" : "s"} on board{" "}
              {draftPlan.boardName}
              {draftPlan.items.some((i) => i.listName) ? " in their lists from your JSON." : ` in ${draftPlan.listName || "To Do"}.`}
            </p>
            <p className="muted">This action cannot be undone. Please confirm you want to create these cards.</p>
            <div className="modal-actions">
              <button className="ghost" onClick={() => setShowCommitModal(false)}>
                Cancel
              </button>
              <button
                className="primary"
                onClick={() => {
                  setShowCommitModal(false);
                  commitPlan();
                }}
              >
                Confirm &amp; commit
              </button>
            </div>
          </div>
        </div>
      )}
      {showCommitSuccessToast && (
        <div className="commit-success-toast" role="status" aria-live="polite">
          <p className="commit-success-toast__message">{COMMIT_SUCCESS_MSG}</p>
          <button
            type="button"
            className="commit-success-toast__dismiss"
            onClick={() => setShowCommitSuccessToast(false)}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      )}
    </section>
  );
}

function LabelEditor({
  labels,
  onAdd,
  onRemove,
}: {
  labels: string[];
  onAdd: (label: string) => void;
  onRemove: (index: number) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <div className="label-editor">
      <div className="chips">
        {labels.map((label, idx) => (
          <span key={`${label}-${idx}`}>
            {label}
            <button onClick={() => onRemove(idx)} aria-label={`Remove ${label}`}>
              x
            </button>
          </span>
        ))}
      </div>
      <div className="inline-input">
        <input
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Add label"
        />
        <button
          type="button"
          onClick={() => {
            onAdd(value);
            setValue("");
          }}
        >
          Add
        </button>
      </div>
    </div>
  );
}

function ChecklistEditor({
  items,
  onAdd,
  onRemove,
}: {
  items: string[];
  onAdd: (text: string) => void;
  onRemove: (index: number) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <div className="checklist">
      <ul>
        {items.map((item, idx) => (
          <li key={`${item}-${idx}`}>
            <span>{item}</span>
            <button onClick={() => onRemove(idx)} aria-label={`Remove ${item}`}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      <div className="inline-input">
        <input
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Add checklist item"
        />
        <button
          type="button"
          onClick={() => {
            onAdd(value);
            setValue("");
          }}
        >
          Add
        </button>
      </div>
    </div>
  );
}
