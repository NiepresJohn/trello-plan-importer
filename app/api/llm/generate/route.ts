import { NextResponse } from "next/server";
import { generatePlan, PROVIDER_CONFIGS } from "../../../lib/llm";
import { validatePlanLenient } from "../../../lib/plan";
import { checkRateLimit, getClientIp } from "../../../lib/rateLimit";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ ok: false, error: "Too many requests. Please wait and try again." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { provider, apiKey, model, description } = body as Record<string, unknown>;

  if (!provider || typeof provider !== "string" || !(provider in PROVIDER_CONFIGS)) {
    return NextResponse.json({ ok: false, error: "Invalid or missing provider" }, { status: 400 });
  }

  if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length < 10) {
    return NextResponse.json({ ok: false, error: "Invalid or missing API key" }, { status: 400 });
  }

  if (!description || typeof description !== "string" || description.trim().length < 10) {
    return NextResponse.json({ ok: false, error: "Project description must be at least 10 characters" }, { status: 400 });
  }

  if (model && (typeof model !== "string" || (model as string).trim().length === 0)) {
    return NextResponse.json({ ok: false, error: "Invalid model specified" }, { status: 400 });
  }

  const result = await generatePlan({
    provider: provider as "openai" | "anthropic" | "google",
    apiKey: apiKey.trim(),
    model: typeof model === "string" ? model.trim() || undefined : undefined,
    description: description.trim(),
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  const validation = validatePlanLenient(result.plan);
  if (!validation.ok) {
    return NextResponse.json(
      { ok: false, error: `LLM generated invalid plan: ${validation.error}` },
      { status: 422 }
    );
  }

  return NextResponse.json({ ok: true, plan: validation.data });
}
