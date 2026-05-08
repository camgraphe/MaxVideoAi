import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { authFetch } from '@/lib/authFetch';
import {
  getAspectRatioOptions,
  getDefaultAspectRatio,
} from '@/lib/image/inputSchema';
import type { ImageGenerationMode } from '@/types/image-generation';
import type { GroupSummary } from '@/types/groups';
import { findImageEngine } from '../_lib/image-workspace-utils';
import type { HistoryEntry, ImageEngineOption } from '../_lib/image-workspace-types';

export function useImageGallerySelection({
  applyImageSettingsSnapshot,
  engines,
  historyEntries,
  setAspectRatio,
  setEngineId,
  setLocalHistory,
  setMode,
  setPrompt,
  setSelectedPreviewEntryId,
  setSelectedPreviewImageIndex,
}: {
  applyImageSettingsSnapshot: (snapshot: unknown) => void;
  engines: ImageEngineOption[];
  historyEntries: HistoryEntry[];
  setAspectRatio: (value: string | null) => void;
  setEngineId: (value: string) => void;
  setLocalHistory: Dispatch<SetStateAction<HistoryEntry[]>>;
  setMode: (value: ImageGenerationMode) => void;
  setPrompt: (value: string) => void;
  setSelectedPreviewEntryId: (value: string | null) => void;
  setSelectedPreviewImageIndex: (value: number) => void;
}) {
  return useCallback(
    (group: GroupSummary) => {
      const applyEntryDefaults = (entry: HistoryEntry) => {
        const engineMatch = entry.engineId ? findImageEngine(engines, entry.engineId) : null;
        if (engineMatch) {
          setEngineId(engineMatch.id);
          if (entry.mode) {
            setMode(engineMatch.modes.includes(entry.mode) ? entry.mode : engineMatch.modes[0] ?? 't2i');
          }
        } else if (entry.mode) {
          setMode(entry.mode);
        }
        if (typeof entry.prompt === 'string') {
          setPrompt(entry.prompt);
        }
        if (engineMatch) {
          const nextMode = engineMatch.modes.includes(entry.mode) ? entry.mode : engineMatch.modes[0] ?? 't2i';
          const options = getAspectRatioOptions(engineMatch.engineCaps, nextMode);
          const fallback = getDefaultAspectRatio(engineMatch.engineCaps, nextMode);
          const nextAspect = entry.aspectRatio && options.includes(entry.aspectRatio) ? entry.aspectRatio : fallback;
          setAspectRatio(nextAspect);
        }
      };

      const fetchSnapshot = (jobId: string | null | undefined) => {
        if (!jobId) return;
        void authFetch(`/api/jobs/${encodeURIComponent(jobId)}`)
          .then(async (response) => {
            const payload = (await response.json().catch(() => null)) as
              | { ok?: boolean; settingsSnapshot?: unknown }
              | null;
            if (!response.ok || !payload?.ok || !payload.settingsSnapshot) return;
            applyImageSettingsSnapshot(payload.settingsSnapshot);
          })
          .catch(() => undefined);
      };

      const heroJobId = group.hero.jobId ?? group.hero.job?.jobId ?? group.id;
      const heroUrl =
        group.hero.thumbUrl ??
        group.hero.videoUrl ??
        group.previews.find((preview) => preview.thumbUrl ?? preview.videoUrl)?.thumbUrl ??
        group.previews.find((preview) => preview.videoUrl ?? preview.thumbUrl)?.videoUrl ??
        null;
      const matchById = heroJobId
        ? historyEntries.find((entry) => entry.id === heroJobId || entry.jobId === heroJobId)
        : null;
      const matchByUrl =
        !matchById && heroUrl
          ? historyEntries.find((entry) => entry.images.some((image) => image.url === heroUrl || image.thumbUrl === heroUrl))
          : null;
      const match = matchById ?? matchByUrl;
      if (match) {
        const index = heroUrl ? match.images.findIndex((image) => image.url === heroUrl || image.thumbUrl === heroUrl) : -1;
        setSelectedPreviewEntryId(match.id);
        setSelectedPreviewImageIndex(index >= 0 ? index : 0);
        applyEntryDefaults(match);
        fetchSnapshot(match.jobId ?? heroJobId);
        return;
      }

      const previewUrls = group.previews
        .map((preview) => preview.thumbUrl ?? preview.videoUrl)
        .filter((url): url is string => Boolean(url));
      if (!previewUrls.length && heroUrl) {
        previewUrls.push(heroUrl);
      }
      if (!previewUrls.length) return;
      const heroRenderUrls = Array.isArray(group.hero.job?.renderIds)
        ? group.hero.job.renderIds.filter((url): url is string => typeof url === 'string' && url.length > 0)
        : [];
      const heroRenderThumbUrls = Array.isArray(group.hero.job?.renderThumbUrls)
        ? group.hero.job.renderThumbUrls.filter((url): url is string => typeof url === 'string' && url.length > 0)
        : [];
      const fallbackImages =
        heroRenderUrls.length > 0
          ? heroRenderUrls.map((url, index) => ({
              url,
              thumbUrl: heroRenderThumbUrls[index] ?? (index === 0 ? group.hero.thumbUrl ?? null : null),
            }))
          : previewUrls.map((url) => ({ url, thumbUrl: url }));

      const createdAt = Date.parse(group.createdAt ?? '');
      const entry: HistoryEntry = {
        id: group.id,
        jobId: heroJobId ?? group.id,
        engineId: group.hero.engineId ?? '',
        engineLabel: group.hero.engineLabel ?? 'Image generation',
        mode: 't2i',
        prompt: group.hero.prompt ?? '',
        createdAt: Number.isNaN(createdAt) ? Date.now() : createdAt,
        description: group.hero.message ?? null,
        images: fallbackImages,
        aspectRatio: group.hero.aspectRatio ?? group.previews[0]?.aspectRatio ?? null,
      };

      setLocalHistory((prev) => {
        if (prev.some((existing) => existing.id === entry.id)) return prev;
        return [entry, ...prev].slice(0, 24);
      });
      const fallbackIndex = heroUrl
        ? fallbackImages.findIndex((image) => image.url === heroUrl || image.thumbUrl === heroUrl)
        : -1;
      setSelectedPreviewEntryId(entry.id);
      setSelectedPreviewImageIndex(fallbackIndex >= 0 ? fallbackIndex : 0);
      applyEntryDefaults(entry);
      fetchSnapshot(entry.jobId ?? heroJobId);
    },
    [
      applyImageSettingsSnapshot,
      engines,
      historyEntries,
      setAspectRatio,
      setEngineId,
      setLocalHistory,
      setMode,
      setPrompt,
      setSelectedPreviewEntryId,
      setSelectedPreviewImageIndex,
    ]
  );
}
