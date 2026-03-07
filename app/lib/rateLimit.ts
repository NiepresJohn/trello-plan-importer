/**
 * Lightweight in-memory sliding-window rate limiter.
 * Reads RATE_LIMIT_PER_MINUTE from env (default: 30).
 * Resets on server restart — suitable for single-instance deployments.
 */
const requestLog = new Map<string, number[]>();

export function checkRateLimit(ip: string): boolean {
  const limit = parseInt(process.env.RATE_LIMIT_PER_MINUTE || "30", 10);
  const now = Date.now();
  const windowMs = 60_000;
  const log = (requestLog.get(ip) || []).filter((t) => now - t < windowMs);
  if (log.length >= limit) return false;
  requestLog.set(ip, [...log, now]);
  return true;
}

export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}
