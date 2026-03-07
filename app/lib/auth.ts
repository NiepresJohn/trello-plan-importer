/**
 * Validates the x-webhook-secret header against WEBHOOK_SECRET env var.
 * If WEBHOOK_SECRET is not configured, validation is skipped (returns true).
 */
export function validateWebhookSecret(request: Request): boolean {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return true;
  const header = request.headers.get("x-webhook-secret");
  return header === secret;
}
