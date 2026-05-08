"use client";

import { useCallback, useState } from 'react';
import type { GroupedJobAction } from '@/components/GroupedJobCard';
import { listUpscaleToolEngines } from '@/config/tools-upscale-engines';
import { saveAssetToLibrary } from '@/lib/api';
import { authFetch } from '@/lib/authFetch';
import { suggestDownloadFilename, triggerAppDownload } from '@/lib/download';
import type {
  UpscaleMediaType,
  UpscaleMode,
  UpscaleOutputFormat,
  UpscaleTargetResolution,
  UpscaleToolEngineId,
  UpscaleToolResponse,
} from '@/types/tools-upscale';
import type { GroupSummary } from '@/types/groups';
import type { Job } from '@/types/jobs';
import { DEFAULT_UPSCALE_COPY } from '@/components/tools/upscale/_lib/upscale-workspace-copy';
import {
  formatCurrency,
  parseRecentImageVariantIndex,
  resolveRecentUpscaleJobFromGroup,
  resolveRecentUpscaleMedia,
  resolveRecentUpscaleMediaFromGroup,
  resolveUpscaleEngineId,
} from '@/components/tools/upscale/_lib/upscale-workspace-helpers';
import type {
  JobDetailResponse,
  PreviewMode,
  RecentUpscaleMedia,
  UploadedAsset,
} from '@/components/tools/upscale/_lib/upscale-workspace-types';

type UseUpscaleRecentActionsOptions = {
  copy: Pick<typeof DEFAULT_UPSCALE_COPY, 'saved' | 'saveFailed'>;
  hasSourcePreview: boolean;
  locale: string;
  mediaType: UpscaleMediaType;
  setActiveRecentGroupId: (value: string | null) => void;
  setEngineId: (value: UpscaleToolEngineId) => void;
  setError: (value: string | null) => void;
  setMediaType: (value: UpscaleMediaType) => void;
  setMediaUrl: (value: string) => void;
  setMessage: (value: string | null) => void;
  setMode: (value: UpscaleMode) => void;
  setOutputFormat: (value: UpscaleOutputFormat) => void;
  setPreviewMode: (value: PreviewMode) => void;
  setResult: (value: UpscaleToolResponse | null) => void;
  setSource: (value: UploadedAsset | null) => void;
  setTargetResolution: (value: UpscaleTargetResolution) => void;
  setUpscaleFactor: (value: number) => void;
};

function buildRecentUpscaleResult(selection: RecentUpscaleMedia): UpscaleToolResponse {
  const resolvedEngineId = resolveUpscaleEngineId(selection.engineId, selection.mediaType);
  const totalCents = selection.totalCents ?? 0;
  return {
    ok: true,
    jobId: selection.job.jobId,
    engineId: resolvedEngineId,
    engineLabel: selection.engineLabel,
    mediaType: selection.mediaType,
    latencyMs: 0,
    pricing: {
      estimatedCostUsd: totalCents / 100,
      actualCostUsd: selection.totalCents == null ? null : totalCents / 100,
      currency: selection.currency,
      estimatedCredits: totalCents,
      actualCredits: selection.totalCents,
      totalCents: selection.totalCents,
      billingProductKey: selection.job.billingProductKey ?? null,
    },
    output: {
      url: selection.url,
      thumbUrl: selection.thumbUrl ?? null,
      mimeType: selection.mimeType,
      originUrl: selection.url,
      source: 'upscale',
      persisted: true,
    },
  };
}

export function useUpscaleRecentActions({
  copy,
  hasSourcePreview,
  locale,
  mediaType,
  setActiveRecentGroupId,
  setEngineId,
  setError,
  setMediaType,
  setMediaUrl,
  setMessage,
  setMode,
  setOutputFormat,
  setPreviewMode,
  setResult,
  setSource,
  setTargetResolution,
  setUpscaleFactor,
}: UseUpscaleRecentActionsOptions) {
  const [savingRecentGroupId, setSavingRecentGroupId] = useState<string | null>(null);

  const applyRecentUpscaleMediaType = useCallback(
    (selection: RecentUpscaleMedia) => {
      if (selection.mediaType === mediaType) return;
      const nextEngineId = resolveUpscaleEngineId(selection.engineId, selection.mediaType);
      const resolved =
        listUpscaleToolEngines(selection.mediaType).find((entry) => entry.id === nextEngineId) ??
        listUpscaleToolEngines(selection.mediaType)[0];
      setMediaType(selection.mediaType);
      setEngineId(resolved.id);
      setMode(resolved.defaultMode);
      setUpscaleFactor(resolved.defaultUpscaleFactor);
      setTargetResolution(resolved.defaultTargetResolution ?? '1080p');
      setOutputFormat(resolved.defaultOutputFormat);
    },
    [mediaType, setEngineId, setMediaType, setMode, setOutputFormat, setTargetResolution, setUpscaleFactor]
  );

  const resolveRecentSelectionWithSource = useCallback(async (group: GroupSummary): Promise<RecentUpscaleMedia | null> => {
    const selection = resolveRecentUpscaleMediaFromGroup(group);
    if (selection?.source?.url) return selection;

    const baseJob = resolveRecentUpscaleJobFromGroup(group);
    if (!baseJob?.jobId) return selection;

    try {
      const response = await authFetch(`/api/jobs/${encodeURIComponent(baseJob.jobId)}`);
      const payload = (await response.json().catch(() => null)) as JobDetailResponse | null;
      if (!response.ok || !payload?.ok) return selection;
      const detailedJob: Job = {
        ...baseJob,
        settingsSnapshot: payload.settingsSnapshot ?? baseJob.settingsSnapshot,
        renderIds: payload.renderIds ?? baseJob.renderIds,
        renderThumbUrls: payload.renderThumbUrls ?? baseJob.renderThumbUrls,
        heroRenderId: payload.heroRenderId ?? baseJob.heroRenderId,
        videoUrl: payload.videoUrl ?? baseJob.videoUrl,
        readyVideoUrl: payload.readyVideoUrl ?? baseJob.readyVideoUrl,
        thumbUrl: payload.thumbUrl ?? baseJob.thumbUrl,
        previewFrame: payload.previewFrame ?? baseJob.previewFrame,
        finalPriceCents: payload.finalPriceCents ?? baseJob.finalPriceCents,
        currency: payload.currency ?? baseJob.currency,
        pricingSnapshot: payload.pricingSnapshot ?? payload.pricing ?? baseJob.pricingSnapshot,
      };
      return resolveRecentUpscaleMedia(detailedJob, parseRecentImageVariantIndex(group.hero.id)) ?? selection;
    } catch {
      return selection;
    }
  }, []);

  const selectRecentUpscale = useCallback(
    async (group: GroupSummary) => {
      setError(null);
      const selection = await resolveRecentSelectionWithSource(group);
      if (!selection) {
        setError('No finished upscale output is available for this job yet.');
        return;
      }
      applyRecentUpscaleMediaType(selection);
      if (selection.source?.url) {
        setSource({
          id: selection.source.assetId ?? null,
          jobId: selection.source.jobId ?? null,
          url: selection.source.url,
          width: selection.source.width ?? null,
          height: selection.source.height ?? null,
          mime: selection.source.mimeType,
          name: 'Recent upscale source',
        });
        setMediaUrl(selection.source.url);
      }
      setResult(buildRecentUpscaleResult(selection));
      setActiveRecentGroupId(group.id);
      setError(null);
      setMessage(
        selection.totalCents == null
          ? selection.engineLabel
          : `${selection.engineLabel} · ${formatCurrency(selection.totalCents, selection.currency, locale)}`
      );
      setPreviewMode(selection.source?.url || (hasSourcePreview && selection.mediaType === mediaType) ? 'compare' : 'result');
    },
    [
      applyRecentUpscaleMediaType,
      hasSourcePreview,
      locale,
      mediaType,
      resolveRecentSelectionWithSource,
      setActiveRecentGroupId,
      setError,
      setMediaUrl,
      setMessage,
      setPreviewMode,
      setResult,
      setSource,
    ]
  );

  const saveRecentUpscale = useCallback(
    async (group: GroupSummary) => {
      const selection = resolveRecentUpscaleMediaFromGroup(group);
      if (!selection) {
        setError('No finished upscale output is available for this job yet.');
        return;
      }
      setSavingRecentGroupId(group.id);
      setError(null);
      try {
        await saveAssetToLibrary({
          url: selection.url,
          jobId: selection.job.jobId,
          label: selection.engineLabel,
          source: 'upscale',
          kind: selection.mediaType,
        });
        setMessage(copy.saved);
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : copy.saveFailed);
      } finally {
        setSavingRecentGroupId(null);
      }
    },
    [copy.saveFailed, copy.saved, setError, setMessage]
  );

  const handleRecentGroupAction = useCallback(
    (group: GroupSummary, action: GroupedJobAction) => {
      const selection = resolveRecentUpscaleMediaFromGroup(group);
      if ((action === 'open' || action === 'view' || action === 'compare' || action === 'continue' || action === 'refine' || action === 'branch') && selection) {
        void selectRecentUpscale(group);
        return;
      }
      if (!selection) {
        setError('No finished upscale output is available for this job yet.');
        return;
      }
      if (action === 'download') {
        triggerAppDownload(selection.url, suggestDownloadFilename(selection.url, `upscale-${selection.job.jobId}`));
        return;
      }
      if (action === 'copy') {
        void navigator.clipboard
          ?.writeText(selection.url)
          .then(() => setMessage('Link copied.'))
          .catch(() => setError('Unable to copy link.'));
        return;
      }
      if (action === 'save-image') {
        void saveRecentUpscale(group);
      }
    },
    [saveRecentUpscale, selectRecentUpscale, setError, setMessage]
  );

  return {
    handleRecentGroupAction,
    savingRecentGroupId,
    selectRecentUpscale,
  };
}
