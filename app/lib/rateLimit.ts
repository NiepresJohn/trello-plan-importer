/**
 * Lightweight in-memory sliding-window rate limiter.
 * Reads RATE_LIMIT_PER_MINUTE from env (default: 30).
 * Resets on server restart — suitable for single-instance deployments.
 *
 * SECURITY: Requires trusted proxy. Spoofed x-forwarded-for headers
 * can bypass rate limiting if not behind a trusted reverse proxy.
 */
const requestLog = new Map<string, number[]>();
const CLEANUP_INTERVAL_MS = 5 * 60_000;

let cleanupInitialized = false;

function initCleanup() {
  if (cleanupInitialized) return;
  cleanupInitialized = true;
  setInterval(() => {
    const now = Date.now();
    const windowMs = 60_000;
    for (const [ip, timestamps] of requestLog.entries()) {
      const recent = timestamps.filter((t) => now - t < windowMs);
      if (recent.length === 0) {
        requestLog.delete(ip);
      } else {
        requestLog.set(ip, recent);
      }
    }
  }, CLEANUP_INTERVAL_MS).unref();
}

const IPV4_REGEX = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const IPV6_REGEX = /^(?:[0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

function isValidIp(ip: string): boolean {
  return IPV4_REGEX.test(ip) || IPV6_REGEX.test(ip);
}

export function checkRateLimit(ip: string): boolean {
  initCleanup();
  const limit = parseInt(process.env.RATE_LIMIT_PER_MINUTE || "30", 10);
  const now = Date.now();
  const windowMs = 60_000;
  const log = (requestLog.get(ip) || []).filter((t) => now - t < windowMs);
  if (log.length >= limit) return false;
  requestLog.set(ip, [...log, now]);
  return true;
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const ip = forwarded.split(",")[0]?.trim();
    if (ip && isValidIp(ip)) return ip;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp && isValidIp(realIp)) return realIp;
  return "unknown";
}
