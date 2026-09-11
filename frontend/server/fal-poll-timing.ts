const NORMAL_WINDOW_MS = 35 * 60_000;
const DEFAULT_GRACE_MS = 20 * 60_000;

export function getFalPollTiming(engineId: string, createdAt: string, now: number) {
  const createdAtMs = Date.parse(createdAt);
  const ageMs = Number.isFinite(createdAtMs) ? now - createdAtMs : 0;
  // H3 delivered successful outputs after 63–65 minutes in the 2026-09-07 audit.
  // 90 minutes is an attention threshold, not permission to fail, refund or resubmit.
  const graceMs = engineId === 'minimax-h3' ? 55 * 60_000 : DEFAULT_GRACE_MS;
  return {
    ageMs,
    graceMs,
    timedOut: ageMs > NORMAL_WINDOW_MS,
    beyondTimeoutGrace: ageMs > NORMAL_WINDOW_MS + graceMs,
  };
}
