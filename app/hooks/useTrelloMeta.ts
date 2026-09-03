"use client";

import { useCallback, useState } from "react";

type Board = { id: string; name: string };
type List = { id: string; name: string };

export function useTrelloMeta() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [lists, setLists] = useState<List[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBoards = useCallback(async () => {
    setLoadingMeta(true);
    setError(null);
    try {
      const res = await fetch("/api/trello/meta", {
        headers: { "x-webhook-secret": process.env.NEXT_PUBLIC_WEBHOOK_SECRET || "" },
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to load Trello boards");
      }
      setBoards(data.boards || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Trello metadata");
    } finally {
      setLoadingMeta(false);
    }
  }, []);

  const loadLists = useCallback(async (boardName: string) => {
    if (!boardName) {
      setLists([]);
      return;
    }
    setLoadingMeta(true);
    setError(null);
    try {
      const query = new URLSearchParams({ boardName });
      const res = await fetch(`/api/trello/meta?${query.toString()}`, {
        headers: { "x-webhook-secret": process.env.NEXT_PUBLIC_WEBHOOK_SECRET || "" },
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to load Trello lists");
      }
      setLists(data.lists || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Trello metadata");
    } finally {
      setLoadingMeta(false);
    }
  }, []);

  return {
    boards,
    lists,
    loadingMeta,
    error,
    loadBoards,
    loadLists,
  };
}
