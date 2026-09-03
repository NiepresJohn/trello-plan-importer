import { timingSafeEqual } from "crypto";

/**
 * Validates the x-webhook-secret header against WEBHOOK_SECRET env var.
 * Uses constant-time comparison to prevent timing attacks.
 * If WEBHOOK_SECRET is not configured, validation is skipped (returns true).
 */
export function validateWebhookSecret(request: Request): boolean {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    console.warn("[auth] WEBHOOK_SECRET not set — all requests accepted. Configure this in production.");
    return true;
  }
  const header = request.headers.get("x-webhook-secret");
  if (!header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
