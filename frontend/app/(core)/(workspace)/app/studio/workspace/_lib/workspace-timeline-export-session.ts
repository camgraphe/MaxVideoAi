import type { WorkspaceTimelineRenderManifest } from './workspace-timeline-render';
import type { TimelineExportClientJob } from '../_state/workspace-state';

export type WorkspaceTimelineExportSession = {
  activeJob: TimelineExportClientJob | null;
  idempotencyKey: string;
  submittedManifests: Record<string, WorkspaceTimelineRenderManifest>;
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
    return {
      activeJob: normalizeJob(value.activeJob),
      idempotencyKey: value.idempotencyKey,
      submittedManifests,
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
