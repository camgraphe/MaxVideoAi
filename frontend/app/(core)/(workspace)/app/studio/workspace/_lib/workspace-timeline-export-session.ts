import type { WorkspaceTimelineRenderManifest } from './workspace-timeline-render';
import type { TimelineExportClientJob, TimelineExportClientEstimate } from '../_state/workspace-state';
import type { WorkspaceTimelineExportQualityPreset } from './workspace-timeline-export';

export type PendingTimelineExportSubmission = {manifest: WorkspaceTimelineRenderManifest;qualityPreset: WorkspaceTimelineExportQualityPreset};

export type WorkspaceTimelineExportSession = {
  activeJob: TimelineExportClientJob | null;
  idempotencyKey: string;
  submittedManifests: Record<string, WorkspaceTimelineRenderManifest>;
  pendingSubmission?: PendingTimelineExportSubmission | null;
  submittedEstimate?: TimelineExportClientEstimate | null;
};

function cloneManifest(manifest: WorkspaceTimelineRenderManifest): WorkspaceTimelineRenderManifest {
  return JSON.parse(JSON.stringify(manifest)) as WorkspaceTimelineRenderManifest;
}

function normalizeJob(value: unknown): TimelineExportClientJob | null {
  if (!value || typeof value !== 'object') return null;
  const job = value as Partial<TimelineExportClientJob>;
  if (typeof job.id !== 'string' || !job.id) return null;
  if (!['queued', 'rendering', 'completed', 'failed', 'canceled'].includes(String(job.status))) return null;
  return {
    id: job.id,
    status: job.status as TimelineExportClientJob['status'],
    progress: typeof job.progress === 'number' && Number.isFinite(job.progress)
      ? Math.max(0, Math.min(100, Math.round(job.progress)))
      : 0,
    message: typeof job.message === 'string' ? job.message : null,
    outputUrl: typeof job.outputUrl === 'string' ? job.outputUrl : null,
    ...(typeof job.canonicalOriginalUrl === 'string' ? {canonicalOriginalUrl: job.canonicalOriginalUrl} : {}),
    ...(typeof job.outputAssetId === 'string' ? {outputAssetId: job.outputAssetId} : {}),
    ...(normalizeTimelineExportConfirmedPrice(job.billing) ? {billing: normalizeTimelineExportConfirmedPrice(job.billing)!} : {}),
  };
}

function normalizeManifest(value: unknown): WorkspaceTimelineRenderManifest | null {
  if (!value || typeof value !== 'object') return null;
  const manifest = value as Partial<WorkspaceTimelineRenderManifest>;
  if (
    manifest.version !== 1
    || manifest.source !== 'maxvideoai-editor'
    || typeof manifest.sequenceId !== 'string'
    || !Array.isArray(manifest.tracks)
  ) return null;
  return cloneManifest(manifest as WorkspaceTimelineRenderManifest);
}

export function normalizeTimelineExportDisplayEstimate(value: unknown): TimelineExportClientEstimate | null {
  if (!value || typeof value !== 'object') return null;
  const estimate = value as Partial<TimelineExportClientEstimate>;
  return ['free','paid'].includes(String(estimate.billingKind))
    && Number.isSafeInteger(estimate.amountCents) && estimate.amountCents! >= 0
    && typeof estimate.currency === 'string' && /^[A-Z]{3}$/.test(estimate.currency)
    && Number.isSafeInteger(estimate.freeExportsRemaining) && estimate.freeExportsRemaining! >= 0
    ? {billingKind: estimate.billingKind!,amountCents: estimate.amountCents!,currency: estimate.currency,freeExportsRemaining: estimate.freeExportsRemaining!} : null;
}

export function normalizeTimelineExportConfirmedPrice(value: unknown): TimelineExportClientJob['billing'] | null {
  const estimate = normalizeTimelineExportDisplayEstimate(value && typeof value === 'object' ? {...value,freeExportsRemaining: 0} : null);
  return estimate ? {amountCents: estimate.amountCents,currency: estimate.currency,billingKind: estimate.billingKind} : null;
}

export function workspaceTimelineExportJobEstimate(job: TimelineExportClientJob | null, fallback: TimelineExportClientEstimate | null): TimelineExportClientEstimate | null {
  if (!job?.billing) return fallback;
  if (fallback && fallback.amountCents === job.billing.amountCents && fallback.currency === job.billing.currency && fallback.billingKind === job.billing.billingKind) return fallback;
  return {...job.billing,freeExportsRemaining: fallback?.freeExportsRemaining ?? 0};
}

export function parseWorkspaceTimelineExportSession(serialized: string | null): WorkspaceTimelineExportSession | null {
  if (!serialized) return null;
  try {
    const value = JSON.parse(serialized) as Partial<WorkspaceTimelineExportSession>;
    if (typeof value.idempotencyKey !== 'string' || !value.idempotencyKey) return null;
    const submittedManifests = Object.fromEntries(
      Object.entries(value.submittedManifests ?? {}).flatMap(([jobId, manifest]) => {
        const normalized = normalizeManifest(manifest);
        return normalized ? [[jobId, normalized]] : [];
      })
    );
    const pendingManifest = normalizeManifest(value.pendingSubmission?.manifest);
    const pendingQuality = value.pendingSubmission?.qualityPreset;
    return {
      activeJob: normalizeJob(value.activeJob),
      idempotencyKey: value.idempotencyKey,
      submittedManifests,
      submittedEstimate: normalizeTimelineExportDisplayEstimate(value.submittedEstimate),
      pendingSubmission: pendingManifest && ['draft','standard','high'].includes(String(pendingQuality))
        ? {manifest: pendingManifest,qualityPreset: pendingQuality!} : null,
    };
  } catch {
    return null;
  }
}

export function snapshotWorkspaceTimelineExportSubmission(params: {
  current: WorkspaceTimelineExportSession;
  job: TimelineExportClientJob;
  manifest: WorkspaceTimelineRenderManifest;
}): WorkspaceTimelineExportSession {
  return {
    activeJob: { ...params.job },
    idempotencyKey: params.current.idempotencyKey,
    submittedManifests: {
      ...params.current.submittedManifests,
      [params.job.id]: cloneManifest(params.manifest),
    },
  };
}

export function workspaceTimelineExportSubmittedManifest(
  session: WorkspaceTimelineExportSession | null,
  jobId: string | null | undefined
): WorkspaceTimelineRenderManifest | null {
  if (!session || !jobId) return null;
  return session.submittedManifests[jobId] ?? null;
}
