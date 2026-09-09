/** Progress from app_jobs is often synthetic. Only explicit provider telemetry is displayable. */
export type GenerationStage = 'submitting' | 'queued' | 'processing' | 'finalizing' | 'pending' | 'completed' | 'failed';
export type GenerationObservation = {
  stage: GenerationStage;
  providerPercent?: { value: number; source: 'provider'; provider: string };
  checkedAt?: number;
  degraded?: boolean;
};

export function generationStage(status?: string | null, finalizing = false): GenerationStage {
  const raw = status?.toLowerCase();
  if (raw === 'completed') return 'completed';
  if (raw === 'failed' || raw === 'provider_polling_stalled') return 'failed';
  if (finalizing) return 'finalizing';
  if (raw === 'queued' || raw === 'accepted' || raw === 'in_queue') return 'queued';
  if (raw === 'running' || raw === 'processing' || raw === 'in_progress') return 'processing';
  return 'pending';
}

export function normalizeGenerationObservation(value: unknown): GenerationObservation | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const input = value as Partial<GenerationObservation>;
  const stages: GenerationStage[] = ['submitting', 'queued', 'processing', 'finalizing', 'pending', 'completed', 'failed'];
  if (!stages.includes(input.stage as GenerationStage)) return undefined;
  const percent = input.providerPercent;
  return {
    stage: input.stage!,
    ...(percent?.source === 'provider' && typeof percent.provider === 'string' && percent.provider.trim()
      && typeof percent.value === 'number' && Number.isFinite(percent.value)
      ? { providerPercent: { value: Math.max(0, Math.min(100, percent.value)), source: 'provider' as const, provider: percent.provider } } : {}),
    ...(typeof input.checkedAt === 'number' && Number.isFinite(input.checkedAt) && input.checkedAt > 0 ? { checkedAt: input.checkedAt } : {}),
    ...(input.degraded === true ? { degraded: true } : {}),
  };
}

export function isStaleGenerationUpdate(current: { status?: string | null; observation?: GenerationObservation }, next: { status?: string | null; observation?: GenerationObservation }): boolean {
  if ((current.status === 'completed' || current.status === 'failed') && next.status != null && next.status !== current.status) return true;
  if (next.status === 'completed' || next.status === 'failed') return false;
  return Boolean(current.observation?.checkedAt && next.observation?.checkedAt && next.observation.checkedAt < current.observation.checkedAt);
}

export function degradedGenerationObservation(current?: GenerationObservation): GenerationObservation {
  return { ...current, stage: current?.stage ?? 'pending', degraded: true };
}

export function generationTimingView(now: number, startedAt?: number, etaSeconds?: number | null, observation?: GenerationObservation) {
  const elapsedSeconds = typeof startedAt === 'number' && Number.isFinite(startedAt) && startedAt > 0
    ? Math.max(0, Math.floor((now - startedAt) / 1000)) : null;
  const estimatedSeconds = typeof etaSeconds === 'number' && Number.isFinite(etaSeconds) && etaSeconds > 0 ? etaSeconds : null;
  const checkedAgoSeconds = observation?.checkedAt ? Math.max(0, Math.floor((now - observation.checkedAt) / 1000)) : null;
  return { elapsedSeconds, estimatedSeconds, overdue: elapsedSeconds !== null && estimatedSeconds !== null && elapsedSeconds > estimatedSeconds,
    checkedAgoSeconds, degraded: observation?.degraded === true || (checkedAgoSeconds !== null && checkedAgoSeconds > 30) };
}

export function mergeGenerationObservation(current?: GenerationObservation, next?: GenerationObservation): GenerationObservation | undefined {
  if (!next) return current;
  if (next.degraded) return { ...next, checkedAt: current?.checkedAt };
  if (next.stage === 'completed' || next.stage === 'failed') return next;
  // Feed/hydration stages lack a new successful status-check timestamp.
  if (!next.checkedAt && current?.checkedAt) return current;
  return next;
}
