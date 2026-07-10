'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildWorkspaceTimelineEdl,
  buildWorkspaceTimelineVideoExportRequest,
  serializeWorkspaceTimelineVideoExportRequest,
  type WorkspaceTimelineExportQualityPreset,
  workspaceTimelineRenderReadinessLabel,
} from '../_lib/workspace-timeline-export';
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
  qualityPreset: WorkspaceTimelineExportQualityPreset;
  copy: StudioCopy['exportDialog'];
  notices: StudioCopy['notices'];
  onNotice: (message: string) => void;
};

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
  qualityPreset,
  copy,
  notices,
  onNotice,
}: UseExportControllerOptions) {
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [exportVideoFeedback, setExportVideoFeedback] = useState<string | null>(null);
  const [exportEstimate, setExportEstimate] = useState<TimelineExportClientEstimate | null>(null);
  const [exportQuota, setExportQuota] = useState<TimelineExportClientQuota | null>(null);
  const [activeExportJob, setActiveExportJob] = useState<TimelineExportClientJob | null>(null);
  const [exportIdempotencyKey, setExportIdempotencyKey] = useState<string | null>(null);
  const [isExportEstimateLoading, setIsExportEstimateLoading] = useState(false);
  const [isExportVideoStarting, setIsExportVideoStarting] = useState(false);
  const exportReadinessLabel = useMemo(() => workspaceTimelineRenderReadinessLabel(manifest, copy), [copy, manifest]);

  const resetExportSession = useCallback(() => {
    setExportVideoFeedback(null);
    setExportEstimate(null);
    setExportQuota(null);
    setActiveExportJob(null);
    setExportIdempotencyKey(createClientExportIdempotencyKey());
  }, []);

  const openExportDialog = useCallback(() => {
    resetExportSession();
    setIsExportDialogOpen(true);
  }, [resetExportSession]);

  const closeExportDialog = useCallback(() => {
    setIsExportDialogOpen(false);
  }, []);

  useEffect(() => {
    if (!isExportDialogOpen || !exportIdempotencyKey) return;
    if (manifest.status === 'blocked') {
      setExportEstimate(null);
      setExportQuota(null);
      setIsExportEstimateLoading(false);
      return;
    }

    const controller = new AbortController();
    const request = buildWorkspaceTimelineVideoExportRequest(manifest, {
      qualityPreset,
      includeAudio: true,
      idempotencyKey: exportIdempotencyKey,
    });
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
        setExportEstimate(payload.estimate ?? null);
        setExportQuota(payload.quota ?? null);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setExportEstimate(null);
        setExportQuota(null);
        setExportVideoFeedback(error instanceof Error
          ? humanizeTimelineExportError(error.message, notices, copy, notices.exportEstimateFailed)
          : notices.exportEstimateFailed);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsExportEstimateLoading(false);
      });

    return () => controller.abort();
  }, [copy, exportIdempotencyKey, isExportDialogOpen, manifest, notices, qualityPreset]);

  useEffect(() => {
    if (!activeExportJob || isTerminalExportJob(activeExportJob)) return;

    let cancelled = false;
    const pollExportJob = async () => {
      try {
        const response = await fetch(`/api/studio/timeline-exports/${activeExportJob.id}`, {
          headers: { Accept: 'application/json' },
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok || cancelled) return;
        const nextJob = normalizeTimelineExportClientJob(payload.export);
        if (!nextJob) return;
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
      }
    };

    const interval = window.setInterval(pollExportJob, 2000);
    void pollExportJob();
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [activeExportJob, copy, notices, onNotice]);

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
    const idempotencyKey = activeExportJob && isTerminalExportJob(activeExportJob)
      ? createClientExportIdempotencyKey()
      : exportIdempotencyKey ?? createClientExportIdempotencyKey();
    if (idempotencyKey !== exportIdempotencyKey) {
      setExportIdempotencyKey(idempotencyKey);
    }
    const request = buildWorkspaceTimelineVideoExportRequest(manifest, {
      qualityPreset,
      includeAudio: true,
      idempotencyKey,
    });
    const serializedRequest = serializeWorkspaceTimelineVideoExportRequest(request);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(VIDEO_EXPORT_REQUEST_STORAGE_KEY, serializedRequest);
    }
    if (request.status === 'blocked') {
      const blockedMessage = workspaceTimelineRenderReadinessLabel(manifest, copy);
      setExportVideoFeedback(blockedMessage);
      onNotice(blockedMessage);
      return;
    }
    setIsExportVideoStarting(true);
    setExportVideoFeedback(notices.queueingServerExport);
    try {
      const response = await fetch('/api/studio/timeline-exports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request }),
      });
      const payload = await response.json().catch(() => null);
      const job = normalizeTimelineExportClientJob(payload?.export);
      if (!response.ok || !payload?.ok) {
        if (job) setActiveExportJob(job);
        throw new Error(payload?.message ?? payload?.error ?? 'EXPORT_CREATE_FAILED');
      }
      if (!job) throw new Error('EXPORT_JOB_INVALID');
      setActiveExportJob(job);
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
  }, [activeExportJob, copy, exportIdempotencyKey, manifest, notices, onNotice, qualityPreset]);

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
    isExportEstimateLoading,
    isExportVideoStarting,
    openExportDialog,
    resetExportSession,
  };
}
