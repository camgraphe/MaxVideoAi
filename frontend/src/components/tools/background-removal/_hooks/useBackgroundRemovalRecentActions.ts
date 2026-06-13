import { useCallback, useState } from 'react';
import { saveAssetToLibrary } from '@/lib/api';
import { suggestDownloadFilename, triggerAppDownload } from '@/lib/download';
import { backgroundRemovalRecentToResult } from '../_lib/background-removal-workspace-helpers';
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
      params.onSelectResult(backgroundRemovalRecentToResult(item));
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
