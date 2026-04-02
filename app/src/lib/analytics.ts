// ─── GA4 Analytics Wrapper ────────────────────────────────────────────────────
//
// Thin type-safe wrapper around window.gtag.
// All functions are no-ops if GA is not loaded (e.g. no Measurement ID set).

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    gtag: (command: string, ...args: any[]) => void;
    dataLayer: unknown[];
  }
}

function fire(eventName: string, params: Record<string, string | number>) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  window.gtag('event', eventName, params);
}

/** Called when a level is first loaded and the player starts. */
export function trackLevelStart(levelId: number, levelName: string, source: 'preset' | 'user') {
  fire('level_start', { level_id: levelId, level_name: levelName, source });
}

/** Called when the player solves a level (phase → 'won'). */
export function trackLevelComplete(levelId: number, levelName: string, moveCount: number, timeSpent: number) {
  fire('level_complete', { level_id: levelId, level_name: levelName, move_count: moveCount, time_spent: timeSpent });
}

/** Called when the player loses (phase → 'lost'). */
export function trackLevelFail(levelId: number, levelName: string, moveCount: number, lostReason: string, timeSpent: number) {
  fire('level_fail', { level_id: levelId, level_name: levelName, move_count: moveCount, lost_reason: lostReason, time_spent: timeSpent });
}
