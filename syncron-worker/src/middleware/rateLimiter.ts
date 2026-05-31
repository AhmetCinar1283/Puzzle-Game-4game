/**
 * Sliding-window rate limiter for the Worker.
 *
 * Used on /internal/log to prevent Firebase Functions loops from
 * flooding the endpoint. In-memory, so it resets when the Worker
 * isolate is recycled — which is fine for abuse prevention.
 *
 * Two limit levels:
 *   - Global:  100 requests / 60s  (protects D1 write budget)
 *   - Per-UID: 20 requests / 60s   (prevents single-user loop)
 */

interface WindowEntry {
  count: number;
  windowStart: number;
}

const WINDOW_MS = 60_000; // 1 minute window
const GLOBAL_MAX = 100;   // max total requests from Functions per minute
const UID_MAX = 20;       // max requests per individual user per minute

// Separate maps for different limit scopes
const globalMap = new Map<string, WindowEntry>();
const uidMap = new Map<string, WindowEntry>();

// Clean up stale entries every 5 minutes to prevent memory leaks
const CLEANUP_INTERVAL_MS = 5 * 60_000;
let lastCleanup = Date.now();

function pruneMap(map: Map<string, WindowEntry>): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, entry] of map) {
    if (now - entry.windowStart > WINDOW_MS * 2) {
      map.delete(key);
    }
  }
}

/**
 * Returns true if the request is within the allowed rate.
 * Returns false if the limit is exceeded (caller should return 429).
 */
function checkLimit(map: Map<string, WindowEntry>, key: string, max: number): boolean {
  pruneMap(map);
  const now = Date.now();
  const entry = map.get(key);

  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    map.set(key, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= max) {
    return false; // Rate limit exceeded
  }

  entry.count++;
  return true;
}

/**
 * Check both global and per-UID limits for the /internal/log endpoint.
 * Returns null if all limits are satisfied, or an error string if exceeded.
 */
export function checkInternalLogRateLimit(uid: string): string | null {
  if (!checkLimit(globalMap, 'global', GLOBAL_MAX)) {
    return 'Global rate limit exceeded on /internal/log — possible loop detected';
  }
  if (!checkLimit(uidMap, uid, UID_MAX)) {
    return `Per-UID rate limit exceeded for ${uid} — possible loop detected`;
  }
  return null;
}
