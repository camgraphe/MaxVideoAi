'use client';

import { useCallback, useEffect, useState } from 'react';
import { authFetch } from '@/lib/authFetch';
import type { StoryboardGeneratorHandoffDraft } from '@/lib/storyboard-generator-handoff';

export type StoryboardRecentOutput = {
  id: string;
  jobId: string | null;
  url: string;
  thumbUrl: string | null;
  previewUrl: string | null;
  width: number | null;
  height: number | null;
  mime: string | null;
  createdAt: string | null;
  isSaved: boolean;
  storyboard?: StoryboardGeneratorHandoffDraft | null;
};

type StoryboardRecentOutputsResponse = {
  ok?: boolean;
  outputs?: StoryboardRecentOutput[];
  error?: string;
};

const STORYBOARD_RECENT_OUTPUTS_URL = '/api/media-library/recent-outputs?limit=18&kind=image&surface=storyboard';

export function useStoryboardRecentOutputs(enabled: boolean) {
  const [outputs, setOutputs] = useState<StoryboardRecentOutput[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setOutputs([]);
      setError(null);
      return [];
    }

    setLoading(true);
    setError(null);
    try {
      const response = await authFetch(STORYBOARD_RECENT_OUTPUTS_URL);
      const payload = (await response.json().catch(() => null)) as StoryboardRecentOutputsResponse | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error ?? 'recent_outputs_failed');
      }
      const nextOutputs = Array.isArray(payload.outputs) ? payload.outputs.filter((output) => Boolean(output.url)) : [];
      setOutputs(nextOutputs);
      return nextOutputs;
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'recent_outputs_failed');
      setOutputs([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    outputs,
    loading,
    error,
    refresh,
  };
}
