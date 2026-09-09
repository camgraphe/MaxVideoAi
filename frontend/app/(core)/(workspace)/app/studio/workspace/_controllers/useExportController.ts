'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildWorkspaceTimelineEdl,
  buildWorkspaceTimelineVideoExportRequest,
  serializeWorkspaceTimelineVideoExportRequest,
  type WorkspaceTimelineExportQualityPreset,
  workspaceTimelineExportEstimateIsCurrent,
  workspaceTimelineExportEstimateKey,
  workspaceTimelineRenderReadinessLabel,
} from '../_lib/workspace-timeline-export';
import {
  parseWorkspaceTimelineExportSession,
  snapshotWorkspaceTimelineExportSubmission,
  workspaceTimelineExportSubmittedManifest,
  type WorkspaceTimelineExportSession,
} from '../_lib/workspace-timeline-export-session';
import {
  serializeWorkspaceTimelineRenderManifest,
  type WorkspaceTimelineRenderManifest,
} from '../_lib/workspace-timeline-render';
import {
  RENDER_MANIFEST_STORAGE_KEY,
  VIDEO_EXPORT_REQUEST_STORAGE_KEY,
  type TimelineExportClientEstimate,
  type TimelineExportClientJob,
  type TimelineExportClientJobStatus,
  type TimelineExportClientQuota,
} from '../_state/workspace-state';
import type { StudioCopy } from '../../_lib/studio-copy';

type UseExportControllerOptions = {
  manifest: WorkspaceTimelineRenderManifest;
  projectId?: string;
  qualityPreset: WorkspaceTimelineExportQualityPreset;
  copy: StudioCopy['exportDialog'];
  notices: StudioCopy['notices'];
  onNotice: (message: string) => void;
};

const TIMELINE_EXPORT_SESSION_STORAGE_KEY = 'maxvideoai.editor.timelineExportSession.v1';
const TIMELINE_EXPORT_POLL_DELAY_MS = 2000;

function createClientExportIdempotencyKey(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `export_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function normalizeTimelineExportClientJob(value: unknown): TimelineExportClientJob | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== 'string') return null;
  const status = typeof record.status === 'string' ? record.status : 'queued';
  const safeStatus: TimelineExportClientJobStatus =
    status === 'rendering' || status === 'completed' || status === 'failed' || status === 'canceled' ? status : 'queued';
  const progress = Number(record.progress ?? 0);
  const artifact = record.artifact && typeof record.artifact === 'object'
    ? record.artifact as Record<string, unknown>
    : null;
  const outputUrl = safeStatus === 'completed'
    ? typeof artifact?.outputUrl === 'string'
      ? artifact.outputUrl
      : typeof record.output_url === 'string'
        ? record.output_url
        : typeof record.outputUrl === 'string'
          ? record.outputUrl
          : null
    : null;
  return {
    id: record.id,
    status: safeStatus,
    progress: Number.isFinite(progress) ? Math.max(0, Math.min(100, Math.round(progress))) : 0,
    message: typeof record.message === 'string' ? record.message : null,
    outputUrl,
  };
}

function isTerminalExportJob(job: TimelineExportClientJob | null): boolean {
  return job?.status === 'completed' || job?.status === 'failed' || job?.status === 'canceled';
}

function isTerminalExportStatus(status: TimelineExportClientJobStatus | null): boolean {
  return status === 'completed' || status === 'failed' || status === 'canceled';
}

function formatStudioCopyValue(value: string, replacements: Record<string, string | number>): string {
  return Object.entries(replacements).reduce(
    (current, [key, replacement]) => current.replaceAll(`{${key}}`, String(replacement)),
    value
  );
}

function humanizeTimelineExportError(
  message: string,
  notices: StudioCopy['notices'],
  copy: StudioCopy['exportDialog'],
  fallback = notices.serverExportFailed
): string {
  if (message.includes('MISSING_TIMELINE_EXPORT_ECS_')) {
    return copy.exportWorkerNotConfigured;
  }
  if (message.includes('TIMELINE_EXPORT_ECS_RUN_TASK_FAILED')) {
    return copy.exportWorkerStartFailed;
  }
  if (message.includes('TIMELINE_EXPORT_ECS_RUN_TASK_EMPTY')) {
    return copy.exportWorkerEmpty;
  }
  if (message === 'INSUFFICIENT_WALLET_BALANCE') {
    return copy.insufficientWalletBalance;
  }
  if (message === 'EXPORT_CREATE_FAILED') {
    return copy.exportCreateFailed;
  }
  if (message === 'EXPORT_ESTIMATE_FAILED') {
    return notices.exportEstimateFailed;
  }
  if (
    message === 'EXPORT_ESTIMATE_REQUIRED'
    || message === 'EXPORT_ESTIMATE_EXPIRED'
    || message === 'EXPORT_ESTIMATE_CHANGED'
    || message === 'EXPORT_ESTIMATE_INVALID'
    || message === 'EXPORT_PROJECT_STATE_STALE'
  ) {
    return notices.exportEstimateFailed;
  }
  if (message === 'EXPORT_JOB_INVALID') {
    return copy.exportJobInvalid;
  }
  return fallback;
}

function downloadWorkspaceTextFile(filename: string, contents: string, type: string): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function useExportController({
  manifest,
  projectId,
  qualityPreset,
  copy,
  notices,
  onNotice,
}: UseExportControllerOptions) {
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [exportVideoFeedback, setExportVideoFeedback] = useState<string | null>(null);
  const [exportEstimate, setExportEstimate] = useState<TimelineExportClientEstimate | null>(null);
  const [estimateToken, setEstimateToken] = useState<string | null>(null);
  const [exportEstimateKey, setExportEstimateKey] = useState<string | null>(null);
  const [exportQuota, setExportQuota] = useState<TimelineExportClientQuota | null>(null);
  const [activeExportJob, setActiveExportJob] = useState<TimelineExportClientJob | null>(null);
  const [exportIdempotencyKey, setExportIdempotencyKey] = useState<string>(() => createClientExportIdempotencyKey());
  const [submittedExportManifests, setSubmittedExportManifests] = useState<Record<string, WorkspaceTimelineRenderManifest>>({});
  const [exportSessionHydrated, setExportSessionHydrated] = useState(false);
  const [estimateRefreshVersion, setEstimateRefreshVersion] = useState(0);
  const [isExportEstimateLoading, setIsExportEstimateLoading] = useState(false);
  const [isExportVideoStarting, setIsExportVideoStarting] = useState(false);
  const terminalExportJobIdRef = useRef<string | null>(null);
  const exportSessionStorageKey = `${TIMELINE_EXPORT_SESSION_STORAGE_KEY}.${projectId ?? 'local'}`;
  const exportReadinessLabel = useMemo(() => workspaceTimelineRenderReadinessLabel(manifest, copy), [copy, manifest]);
  const exportEstimateContextKey = useMemo(
    () => exportIdempotencyKey
      ? workspaceTimelineExportEstimateKey({ manifest, qualityPreset, idempotencyKey: exportIdempotencyKey })
      : null,
    [exportIdempotencyKey, manifest, qualityPreset]
  );
  const hasCurrentExportEstimate = workspaceTimelineExportEstimateIsCurrent({
    estimate: exportEstimate,
    estimateKey: exportEstimateKey,
    manifest,
    qualityPreset,
    idempotencyKey: exportIdempotencyKey,
    isLoading: isExportEstimateLoading,
  });

  const resetExportSession = useCallback(() => {
    setExportVideoFeedback(null);
    setExportEstimate(null);
    setEstimateToken(null);
    setExportEstimateKey(null);
    setExportQuota(null);
    setActiveExportJob(null);
    setSubmittedExportManifests({});
    terminalExportJobIdRef.current = null;
    setExportIdempotencyKey(createClientExportIdempotencyKey());
  }, []);

  const openExportDialog = useCallback(() => {
    if (!activeExportJob || isTerminalExportJob(activeExportJob)) resetExportSession();
    setIsExportDialogOpen(true);
  }, [activeExportJob, resetExportSession]);

  const closeExportDialog = useCallback(() => {
    setIsExportDialogOpen(false);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const restored = parseWorkspaceTimelineExportSession(window.localStorage.getItem(exportSessionStorageKey));
    if (restored) {
      setActiveExportJob(restored.activeJob);
      setExportIdempotencyKey(restored.idempotencyKey);
      setSubmittedExportManifests(restored.submittedManifests);
    }
    setExportSessionHydrated(true);
  }, [exportSessionStorageKey]);

  useEffect(() => {
    if (!exportSessionHydrated || typeof window === 'undefined') return;
    const session: WorkspaceTimelineExportSession = {
      activeJob: activeExportJob,
      idempotencyKey: exportIdempotencyKey,
      submittedManifests: submittedExportManifests,
    };
    window.localStorage.setItem(exportSessionStorageKey, JSON.stringify(session));
  }, [activeExportJob, exportIdempotencyKey, exportSessionHydrated, exportSessionStorageKey, submittedExportManifests]);

  useEffect(() => {
    if (!isExportDialogOpen || !exportIdempotencyKey || !exportEstimateContextKey || manifest.status === 'blocked') {
      setExportEstimate(null);
      setEstimateToken(null);
      setExportEstimateKey(null);
      setExportQuota(null);
      setIsExportEstimateLoading(false);
      return;
    }

    const controller = new AbortController();
    const request = buildWorkspaceTimelineVideoExportRequest(manifest, {
      qualityPreset,
      includeAudio: true,
      idempotencyKey: exportIdempotencyKey,
      projectId,
    });
    setExportEstimate(null);
    setExportEstimateKey(null);
    setExportQuota(null);
    setIsExportEstimateLoading(true);
    fetch('/api/studio/timeline-exports/estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error ?? 'EXPORT_ESTIMATE_FAILED');
        }
        if (!payload.estimate) throw new Error('EXPORT_ESTIMATE_FAILED');
        if (typeof payload.estimateToken !== 'string' || !payload.estimateToken) throw new Error('EXPORT_ESTIMATE_FAILED');
        if (controller.signal.aborted) return;
        setExportEstimate(payload.estimate);
        setEstimateToken(payload.estimateToken);
        setExportEstimateKey(exportEstimateContextKey);
        setExportQuota(payload.quota ?? null);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setExportEstimate(null);
        setEstimateToken(null);
        setExportEstimateKey(null);
        setExportQuota(null);
        setExportVideoFeedback(error instanceof Error
          ? humanizeTimelineExportError(error.message, notices, copy, notices.exportEstimateFailed)
          : notices.exportEstimateFailed);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsExportEstimateLoading(false);
      });

    return () => controller.abort();
  }, [copy, estimateRefreshVersion, exportEstimateContextKey, exportIdempotencyKey, isExportDialogOpen, manifest, notices, projectId, qualityPreset]);

  useEffect(() => {
    if (!activeExportJob || !isTerminalExportJob(activeExportJob) || terminalExportJobIdRef.current === activeExportJob.id) return;
    terminalExportJobIdRef.current = activeExportJob.id;
    setExportEstimate(null);
    setEstimateToken(null);
    setExportEstimateKey(null);
    setExportQuota(null);
    setExportIdempotencyKey(createClientExportIdempotencyKey());
  }, [activeExportJob]);

  const activeExportJobId = activeExportJob?.id ?? null;
  const activeExportJobStatus = activeExportJob?.status ?? null;
  useEffect(() => {
    if (!activeExportJobId || !activeExportJobStatus || isTerminalExportStatus(activeExportJobStatus)) return;

    let cancelled = false;
    let timeoutId: number | null = null;
    const pollExportJob = async () => {
      let nextStatus: TimelineExportClientJobStatus = activeExportJobStatus;
      try {
        const response = await fetch(`/api/studio/timeline-exports/${activeExportJobId}`, {
          headers: { Accept: 'application/json' },
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok || cancelled) return;
        const nextJob = normalizeTimelineExportClientJob(payload.export);
        if (!nextJob) return;
        nextStatus = nextJob.status;
        setActiveExportJob(nextJob);
        if (nextJob.status === 'completed') {
          const message = nextJob.outputUrl ? notices.exportReadyDownload : notices.exportCompleted;
          setExportVideoFeedback(message);
          onNotice(message);
        } else if (nextJob.status === 'failed') {
          const message = nextJob.message
            ? humanizeTimelineExportError(nextJob.message, notices, copy, notices.serverExportFailed)
            : notices.serverExportFailed;
          setExportVideoFeedback(message);
          onNotice(message);
        } else {
          const message = nextJob.status === 'queued' ? notices.serverExportQueued : notices.serverExportRendering;
          setExportVideoFeedback(`${message} ${nextJob.progress}%`);
        }
      } catch {
        // Keep the current job state. The next poll can recover from a transient network miss.
      } finally {
        if (!cancelled && nextStatus !== 'completed' && nextStatus !== 'failed' && nextStatus !== 'canceled') {
          timeoutId = window.setTimeout(pollExportJob, TIMELINE_EXPORT_POLL_DELAY_MS);
        }
      }
    };

    timeoutId = window.setTimeout(pollExportJob, TIMELINE_EXPORT_POLL_DELAY_MS);
    return () => {
      cancelled = true;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, [activeExportJobId, activeExportJobStatus, copy, notices, onNotice]);

  const exportTimelineRender = useCallback(() => {
    const serializedManifest = serializeWorkspaceTimelineRenderManifest(manifest);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(RENDER_MANIFEST_STORAGE_KEY, serializedManifest);
    }
    const readinessLabel = workspaceTimelineRenderReadinessLabel(manifest, copy);
    onNotice(readinessLabel);
    if (manifest.status === 'blocked') return;

    downloadWorkspaceTextFile('maxvideoai-timeline-render.json', serializedManifest, 'application/json');
  }, [copy, manifest, onNotice]);

  const exportTimelineVideo = useCallback(async () => {
    const idempotencyKey = exportIdempotencyKey;
    if (manifest.status === 'blocked') {
      const blockedMessage = workspaceTimelineRenderReadinessLabel(manifest, copy);
      setExportVideoFeedback(blockedMessage);
      onNotice(blockedMessage);
      return;
    }
    if (!hasCurrentExportEstimate || !estimateToken) {
      setExportVideoFeedback(notices.exportEstimateFailed);
      onNotice(notices.exportEstimateFailed);
      return;
    }
    if (!idempotencyKey) {
      setExportVideoFeedback(notices.exportEstimateFailed);
      onNotice(notices.exportEstimateFailed);
      return;
    }
    const request = buildWorkspaceTimelineVideoExportRequest(manifest, {
      qualityPreset,
      includeAudio: true,
      idempotencyKey,
      projectId,
    });
    const serializedRequest = serializeWorkspaceTimelineVideoExportRequest(request);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(VIDEO_EXPORT_REQUEST_STORAGE_KEY, serializedRequest);
    }
    setIsExportVideoStarting(true);
    setExportVideoFeedback(notices.queueingServerExport);
    try {
      const response = await fetch('/api/studio/timeline-exports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request, estimateToken }),
      });
      const payload = await response.json().catch(() => null);
      const job = normalizeTimelineExportClientJob(payload?.export);
      if (!response.ok || !payload?.ok) {
        if (job) setActiveExportJob(job);
        if (payload?.reestimate) {
          setExportEstimate(null);
          setEstimateToken(null);
          setExportEstimateKey(null);
          setExportQuota(null);
          setEstimateRefreshVersion((current) => current + 1);
          const message = humanizeTimelineExportError(payload?.error ?? 'EXPORT_ESTIMATE_FAILED', notices, copy, notices.exportEstimateFailed);
          setExportVideoFeedback(message);
          onNotice(message);
          return;
        }
        throw new Error(payload?.message ?? payload?.error ?? 'EXPORT_CREATE_FAILED');
      }
      if (!job) throw new Error('EXPORT_JOB_INVALID');
      setActiveExportJob(job);
      setSubmittedExportManifests((current) => snapshotWorkspaceTimelineExportSubmission({
        current: {
          activeJob: job,
          idempotencyKey,
          submittedManifests: current,
        },
        job,
        manifest,
      }).submittedManifests);
      const feedbackMessage = payload.reused ? notices.serverExportAlreadyQueued : notices.serverExportQueued;
      setExportVideoFeedback(feedbackMessage);
      onNotice(feedbackMessage);
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : notices.serverExportFailedToStart;
      const message = humanizeTimelineExportError(rawMessage, notices, copy, notices.serverExportFailedToStart);
      setActiveExportJob({
        id: idempotencyKey,
        status: 'failed',
        progress: 0,
        message,
        outputUrl: null,
      });
      setExportVideoFeedback(message);
      onNotice(message);
    } finally {
      setIsExportVideoStarting(false);
    }
  }, [copy, estimateToken, exportIdempotencyKey, hasCurrentExportEstimate, manifest, notices, onNotice, projectId, qualityPreset]);

  const exportTimelineEdl = useCallback(() => {
    const edl = buildWorkspaceTimelineEdl(manifest);
    onNotice(
      manifest.status === 'blocked'
        ? workspaceTimelineRenderReadinessLabel(manifest, copy)
        : formatStudioCopyValue(notices.exportEdlReady, {
          range: manifest.exportRange.mode === 'in-out' ? copy.inOut : copy.fullSequenceRange.toLowerCase(),
        })
    );
    if (manifest.status === 'blocked') return;
    downloadWorkspaceTextFile('maxvideoai-timeline.edl', edl, 'text/plain');
  }, [copy, manifest, notices, onNotice]);

  return {
    activeExportJob,
    closeExportDialog,
    exportEstimate,
    exportQuota,
    exportReadinessLabel,
    exportTimelineEdl,
    exportTimelineRender,
    exportTimelineVideo,
    exportVideoFeedback,
    isExportDialogOpen,
    isExportEstimateReady: hasCurrentExportEstimate && Boolean(estimateToken),
    isExportEstimateLoading,
    isExportVideoStarting,
    openExportDialog,
    resetExportSession,
    submittedExportManifest: workspaceTimelineExportSubmittedManifest(
      {
        activeJob: activeExportJob,
        idempotencyKey: exportIdempotencyKey,
        submittedManifests: submittedExportManifests,
      },
      activeExportJob?.id
    ),
  };
}
