"use client";

import { useCallback, useState } from "react";
import type { TaskPlan } from "../lib/plan";

export type CommitResult = {
  ok: boolean;
  name: string;
  listName?: string;
  shortUrl?: string;
  error?: string;
  warnings?: string[];
};

export function useCommit() {
  const [committing, setCommitting] = useState(false);
  const [results, setResults] = useState<CommitResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const commit = useCallback(async (plan: TaskPlan, replace: boolean) => {
    setError(null);
    setResults([]);
    setCommitting(true);

    try {
      const res = await fetch("/api/trello/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, replace }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Commit failed");
      }
      setResults(data.results || []);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Commit failed");
      return false;
    } finally {
      setCommitting(false);
    }
  }, []);

  return {
    committing,
    results,
    error,
    commit,
  };
}
