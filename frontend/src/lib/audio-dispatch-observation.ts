/** Bounded recovery metadata only; private execution data never reaches status readers. */
export function audioDispatchObservation(
  settingsSnapshot: unknown,
  status: string,
  nowMs = Date.now(),
): { needsAttention: boolean; message: string | null } {
  const clear = { needsAttention: false, message: null };
  if (['completed', 'failed', 'cancelled', 'canceled'].includes(status)
    || !settingsSnapshot || typeof settingsSnapshot !== 'object' || Array.isArray(settingsSnapshot)
    || !Object.prototype.hasOwnProperty.call(settingsSnapshot, 'audioDispatch')) return clear;
  const metadata = (settingsSnapshot as Record<string, unknown>).audioDispatch;
  const message = 'This Audio attempt needs review. Do not resubmit it or retry generation automatically.';
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return { needsAttention: true, message };
  const record = metadata as Record<string, unknown>;
  if (record.version !== 1 || !['queued', 'processing', 'completed', 'failed'].includes(String(record.state))
    || typeof record.observedAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/u.test(record.observedAt)) {
    return { needsAttention: true, message };
  }
  const observedAt = Date.parse(record.observedAt);
  if (!Number.isFinite(observedAt) || !Number.isFinite(nowMs) || observedAt > nowMs) return { needsAttention: true, message };
  // A terminal dispatch paired with an active job also requires reconciliation.
  const deadline = record.state === 'queued' ? 10 * 60_000 : record.state === 'processing' ? 45 * 60_000 : 0;
  return nowMs - observedAt >= deadline ? { needsAttention: true, message } : clear;
}
