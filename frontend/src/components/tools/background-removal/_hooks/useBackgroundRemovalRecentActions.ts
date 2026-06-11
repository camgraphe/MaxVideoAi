import { useCallback, useState } from 'react';
import { saveAssetToLibrary } from '@/lib/api';
import { suggestDownloadFilename, triggerAppDownload } from '@/lib/download';
import type {
  BackgroundRemovalResult,
  RecentBackgroundRemovalResult,
} from '../_lib/background-removal-workspace-types';

export function useBackgroundRemovalRecentActions(params: {
  onSelectResult: (result: BackgroundRemovalResult) => void;
  setError: (value: string | null) => void;
  setMessage: (value: string | null) => void;
}) {
  const [savingJobId, setSavingJobId] = useState<string | null>(null);

  const downloadUrl = useCallback((url: string, name = 'background-removal') => {
    triggerAppDownload(url, suggestDownloadFilename(url, name));
  }, []);

  const copyUrl = useCallback(
    async (url: string) => {
      try {
        await navigator.clipboard.writeText(url);
        params.setMessage('Link copied.');
      } catch {
        params.setError('Could not copy link.');
      }
    },
    [params]
  );

  const saveRecent = useCallback(
    async (item: RecentBackgroundRemovalResult) => {
      setSavingJobId(item.job.jobId);
      params.setError(null);
      try {
        await saveAssetToLibrary({
          url: item.url,
          jobId: item.job.jobId,
          label: item.engineLabel,
          source: 'background-removal',
          kind: 'video',
          sourceOutputId: `${item.job.jobId}:video:0`,
          thumbUrl: item.thumbUrl ?? null,
        });
        params.setMessage('Saved to library.');
      } catch (error) {
        params.setError(error instanceof Error ? error.message : 'Could not save this result.');
      } finally {
        setSavingJobId(null);
      }
    },
    [params]
  );

  const selectRecent = useCallback(
    (item: RecentBackgroundRemovalResult) => {
      params.onSelectResult({
        ok: true,
        jobId: item.job.jobId,
        engineId: 'bria-video-background-removal-v3',
        engineLabel: item.engineLabel,
        latencyMs: 0,
        pricing: {
          estimatedCostUsd: typeof item.totalCents === 'number' ? item.totalCents / 100 : 0,
          currency: item.currency ?? 'USD',
          estimatedCredits: typeof item.totalCents === 'number' ? item.totalCents : 0,
          totalCents: item.totalCents ?? null,
          billingProductKey: item.job.billingProductKey ?? 'background-removal-video-v3',
        },
        output: {
          url: item.url,
          thumbUrl: item.thumbUrl ?? null,
          mimeType: item.mimeType ?? 'video/webm',
          source: 'background-removal',
        },
      });
      params.setMessage(item.engineLabel);
    },
    [params]
  );

  return {
    copyUrl,
    downloadUrl,
    saveRecent,
    savingJobId,
    selectRecent,
  };
}
