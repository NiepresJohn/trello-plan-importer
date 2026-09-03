export type Provider = "openai" | "anthropic" | "google";

export interface ProviderConfig {
  name: string;
  baseUrl: string;
  defaultModel: string;
  models: string[];
}

export const PROVIDER_CONFIGS: Record<Provider, ProviderConfig> = {
  openai: {
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1/chat/completions",
    defaultModel: "gpt-4o-mini",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"],
  },
  anthropic: {
    name: "Anthropic Claude",
    baseUrl: "https://api.anthropic.com/v1/messages",
    defaultModel: "claude-3-5-haiku-latest",
    models: ["claude-3-5-haiku-latest", "claude-3-5-sonnet-latest", "claude-3-opus-latest"],
  },
  google: {
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/models",
    defaultModel: "gemini-1.5-flash",
    models: ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-1.0-pro"],
  },
};

export function getPlanSchemaPrompt(): string {
  return `You are a project planning assistant. Given a project description, create a structured plan for a Trello board.

Output ONLY valid JSON in this exact structure (no markdown, no code fences, just raw JSON):

{
  "boardName": "string (required) - A concise, descriptive name for the Trello board based on the project",
  "listName": "string - Default list name for cards without a specific list (e.g., 'To Do', 'Backlog')",
  "items": [
    {
      "name": "string (required) - Clear, actionable card title",
      "desc": "string - Detailed description with acceptance criteria or notes",
      "labels": ["string"] - Priority and type labels like 'P0', 'P1', 'P2', 'Feature', 'Bug', 'Enhancement', 'Design', 'Research'",
      "checklist": ["string"] - Subtasks or checklist items for this card",
      "due": "ISO 8601 date string or null - Suggested due date if applicable",
      "listName": "string - Which list/column this card belongs to (e.g., 'To Do', 'In Progress', 'Done', 'Backlog')"
    }
  ]
}

Guidelines:
- Break the project into 8-20 actionable cards (not too few, not too many)
- Group cards into logical lists like 'Backlog', 'To Do', 'In Progress', 'Review', 'Done'
- Use priority labels: P0 (critical), P1 (important), P2 (nice-to-have)
- Use type labels: Feature, Bug, Enhancement, Design, Research, Documentation
- Add checklists to cards that have clear subtasks
- Set due dates only if the project has a clear deadline
- Make card descriptions specific and actionable`;
}

function buildOpenAIPrompt(description: string) {
  return {
    model: "",
    messages: [
      { role: "system", content: getPlanSchemaPrompt() },
      { role: "user", content: `Create a project plan for:\n\n${description}` },
    ],
    temperature: 0.7,
    response_format: { type: "json_object" },
  };
}

function buildAnthropicPrompt(description: string, model: string) {
  return {
    model,
    max_tokens: 4096,
    system: getPlanSchemaPrompt(),
    messages: [{ role: "user", content: `Create a project plan for:\n\n${description}` }],
  };
}

function buildGooglePrompt(description: string) {
  return {
    contents: [
      {
        parts: [
          { text: `${getPlanSchemaPrompt()}\n\nCreate a project plan for:\n\n${description}` },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 4096,
    },
  };
}

export interface LLMRequest {
  provider: Provider;
  apiKey: string;
  model?: string;
  description: string;
}

export interface LLMResponse {
  ok: boolean;
  plan?: unknown;
  error?: string;
}

export async function generatePlan(request: LLMRequest): Promise<LLMResponse> {
  const config = PROVIDER_CONFIGS[request.provider];
  const model = request.model || config.defaultModel;

  try {
    let response: Response;
    let plan: unknown;

    if (request.provider === "openai") {
      const body = buildOpenAIPrompt(request.description);
      body.model = model;
      response = await fetch(config.baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${request.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { ok: false, error: parseOpenAIError(errorText, response.status) };
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        return { ok: false, error: "No content in OpenAI response" };
      }
      plan = JSON.parse(content);
    } else if (request.provider === "anthropic") {
      response = await fetch(config.baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": request.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(buildAnthropicPrompt(request.description, model)),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { ok: false, error: parseAnthropicError(errorText, response.status) };
      }

      const data = await response.json();
      const content = data.content?.[0]?.text;
      if (!content) {
        return { ok: false, error: "No content in Anthropic response" };
      }
      plan = JSON.parse(content);
    } else if (request.provider === "google") {
      const url = `${config.baseUrl}/${model}:generateContent?key=${request.apiKey}`;
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildGooglePrompt(request.description)),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { ok: false, error: parseGoogleError(errorText, response.status) };
      }

      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) {
        return { ok: false, error: "No content in Google response" };
      }
      const cleaned = content.replace(/```json\n?|\n?```/g, "").trim();
      plan = JSON.parse(cleaned);
    } else {
      return { ok: false, error: "Unknown provider" };
    }

    return { ok: true, plan };
  } catch (err) {
    if (err instanceof SyntaxError) {
      return { ok: false, error: "Failed to parse LLM response as JSON. Please try again." };
    }
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error occurred" };
  }
}

function parseOpenAIError(text: string, status: number): string {
  try {
    const data = JSON.parse(text);
    if (data.error?.message) {
      if (data.error.message.includes("Incorrect API key")) {
        return "Invalid OpenAI API key. Please check your key and try again.";
      }
      return data.error.message;
    }
  } catch {
    // ignore parse error
  }
  return `OpenAI API error (${status})`;
}

function parseAnthropicError(text: string, status: number): string {
  try {
    const data = JSON.parse(text);
    if (data.error?.message) {
      if (data.error.message.includes("invalid x-api-key")) {
        return "Invalid Anthropic API key. Please check your key and try again.";
      }
      return data.error.message;
    }
  } catch {
    // ignore parse error
  }
  return `Anthropic API error (${status})`;
}

function parseGoogleError(text: string, status: number): string {
  try {
    const data = JSON.parse(text);
    if (data.error?.message) {
      if (data.error.message.includes("API key not valid")) {
        return "Invalid Google API key. Please check your key and try again.";
      }
      return data.error.message;
    }
  } catch {
    // ignore parse error
  }
  return `Google API error (${status})`;
}
