"use client";

import { useEffect, useState } from "react";
import { PROVIDER_CONFIGS, Provider } from "../lib/llm";
import type { TaskPlan } from "../lib/plan";

const STORAGE_KEY = "aitrello_llm_tokens";

type SavedTokens = Record<Provider, { apiKey: string; model: string } | null>;

function loadSavedTokens(): SavedTokens {
  if (typeof window === "undefined") return { openai: null, anthropic: null, google: null };
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // ignore parse errors
  }
  return { openai: null, anthropic: null, google: null };
}

function saveTokens(tokens: SavedTokens) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
}

export interface LLMPlannerProps {
  onPlanGenerated: (plan: TaskPlan) => void;
}

export default function LLMPlanner({ onPlanGenerated }: LLMPlannerProps) {
  const [provider, setProvider] = useState<Provider>("openai");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [description, setDescription] = useState("");
  const [saveToBrowser, setSaveToBrowser] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSavedToken, setHasSavedToken] = useState(false);

  useEffect(() => {
    const tokens = loadSavedTokens();
    const saved = tokens[provider];
    if (saved) {
      setApiKey(saved.apiKey);
      setModel(saved.model);
      setHasSavedToken(true);
      setSaveToBrowser(true);
    } else {
      setApiKey("");
      setModel(PROVIDER_CONFIGS[provider].defaultModel);
      setHasSavedToken(false);
      setSaveToBrowser(false);
    }
  }, [provider]);

  async function handleGenerate() {
    setError(null);

    if (!apiKey.trim()) {
      setError("Please enter your API key");
      return;
    }

    if (description.trim().length < 10) {
      setError("Please describe your project in at least 10 characters");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/llm/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          apiKey: apiKey.trim(),
          model: model || undefined,
          description: description.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to generate plan");
      }

      if (saveToBrowser) {
        const tokens = loadSavedTokens();
        tokens[provider] = { apiKey: apiKey.trim(), model: model || PROVIDER_CONFIGS[provider].defaultModel };
        saveTokens(tokens);
        setHasSavedToken(true);
      } else {
        const tokens = loadSavedTokens();
        tokens[provider] = null;
        saveTokens(tokens);
        setHasSavedToken(false);
      }

      onPlanGenerated(data.plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate plan");
    } finally {
      setLoading(false);
    }
  }

  function handleClearTokens() {
    if (typeof window === "undefined") return;
    window.sessionStorage.removeItem(STORAGE_KEY);
    setApiKey("");
    setModel(PROVIDER_CONFIGS[provider].defaultModel);
    setHasSavedToken(false);
    setSaveToBrowser(false);
    setError(null);
  }

  const config = PROVIDER_CONFIGS[provider];

  return (
    <div className="llm-planner">
      <div className="llm-section">
        <label>LLM Provider</label>
        <select
          className="dropdown-select"
          value={provider}
          onChange={(e) => setProvider(e.target.value as Provider)}
        >
          {Object.entries(PROVIDER_CONFIGS).map(([key, cfg]) => (
            <option key={key} value={key}>
              {cfg.name}
            </option>
          ))}
        </select>
      </div>

      <div className="llm-section">
        <label>API Key {hasSavedToken && <span className="badge">Saved</span>}</label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={`Enter your ${config.name} API key`}
        />
        <div className="llm-options">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={saveToBrowser}
              onChange={(e) => setSaveToBrowser(e.target.checked)}
            />
            Save to browser
          </label>
          {hasSavedToken && (
            <button type="button" className="link-btn" onClick={handleClearTokens}>
              Clear saved tokens
            </button>
          )}
        </div>
      </div>

      <div className="llm-section">
        <label>Model</label>
        <select className="dropdown-select" value={model} onChange={(e) => setModel(e.target.value)}>
          {config.models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <div className="llm-section">
        <label>Project Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe your project in detail. Include goals, features, tech stack, timeline, and any specific requirements..."
          rows={6}
        />
        <p className="helper">
          Be specific about your project goals, features, and requirements. The AI will break it down into actionable Trello cards.
        </p>
      </div>

      {error && (
        <div className="status status-error" role="alert">
          {error}
        </div>
      )}

      <div className="editor-actions">
        <button
          className="primary"
          type="button"
          onClick={handleGenerate}
          disabled={loading}
        >
          {loading ? "Generating plan..." : "Generate Plan with AI"}
        </button>
      </div>

      <div className="llm-info">
        <p className="helper">
          Your API key is sent securely to our server to make the request. It&apos;s never stored on our servers.
          {saveToBrowser && " It will be saved in your browser session storage (cleared when you close the tab)."}
        </p>
      </div>
    </div>
  );
}
