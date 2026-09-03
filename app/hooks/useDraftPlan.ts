"use client";

import { useCallback, useEffect, useState } from "react";
import { blankPlan, TaskPlan } from "../lib/plan";

const DRAFT_KEY = "aitrello_draft_plan";
const DRAFT_SAVED_AT_KEY = "aitrello_draft_saved_at";
const DRAFT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

export function useDraftPlan() {
  const [draftPlan, setDraftPlan] = useState<TaskPlan>(blankPlan());
  const [savedDraftAt, setSavedDraftAt] = useState<string | null>(null);
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  const [staleDraftWarning, setStaleDraftWarning] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(DRAFT_KEY);
    const storedAt = window.localStorage.getItem(DRAFT_SAVED_AT_KEY);
    if (stored) setHasSavedDraft(true);
    if (storedAt) {
      setSavedDraftAt(storedAt);
      if (Date.now() - new Date(storedAt).getTime() > DRAFT_EXPIRY_MS) {
        setStaleDraftWarning(true);
      }
    }
  }, []);

  const saveDraft = useCallback((plan: TaskPlan) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(plan));
    const now = new Date().toISOString();
    window.localStorage.setItem(DRAFT_SAVED_AT_KEY, now);
    setSavedDraftAt(now);
    setHasSavedDraft(true);
  }, []);

  const restoreDraft = useCallback(() => {
    if (typeof window === "undefined") return null;
    const stored = window.localStorage.getItem(DRAFT_KEY);
    if (!stored) return null;
    try {
      return JSON.parse(stored) as TaskPlan;
    } catch {
      return null;
    }
  }, []);

  const resetDraft = useCallback(() => {
    setDraftPlan(blankPlan());
  }, []);

  const dismissStaleWarning = useCallback(() => {
    setStaleDraftWarning(false);
  }, []);

  return {
    draftPlan,
    setDraftPlan,
    savedDraftAt,
    hasSavedDraft,
    staleDraftWarning,
    saveDraft,
    restoreDraft,
    resetDraft,
    dismissStaleWarning,
  };
}
