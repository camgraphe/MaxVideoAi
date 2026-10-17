'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { authFetch } from '@/lib/authFetch';
import type { CaptureStoryboardAccountRequest } from './useStoryboardAccountScope';
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
  klingFirstFrame?: {
    id: string;
    jobId: string | null;
    url: string;
    thumbUrl: string | null;
    previewUrl: string | null;
    width: number | null;
    height: number | null;
    mime: string | null;
    createdAt: string | null;
  } | null;
};

type StoryboardRecentOutputsResponse = {
  ok?: boolean;
  outputs?: StoryboardRecentOutput[];
  error?: string;
};

const STORYBOARD_RECENT_OUTPUTS_URL = '/api/media-library/recent-outputs?limit=18&kind=image&surface=storyboard';

export function useStoryboardRecentOutputs(captureAccountRequest: CaptureStoryboardAccountRequest) {
  const [outputs, setOutputs] = useState<StoryboardRecentOutput[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sequence = useRef(0);

  const refresh = useCallback(async () => {
    const attempt = ++sequence.current;
    const request = captureAccountRequest();
    if (!request) {
      setOutputs([]);
      setError(null);
      return [];
    }
    const isCurrent = () => request.isCurrent() && attempt === sequence.current;

    setLoading(true);
    setError(null);
    try {
      const response = await authFetch(STORYBOARD_RECENT_OUTPUTS_URL, {
        headers: { Authorization: `Bearer ${request.accessToken}` }, signal: request.signal,
      });
      const payload = (await response.json().catch(() => null)) as StoryboardRecentOutputsResponse | null;
      if (!isCurrent()) return [];
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error ?? 'recent_outputs_failed');
      }
      const nextOutputs = Array.isArray(payload.outputs) ? payload.outputs.filter((output) => Boolean(output.url)) : [];
      setOutputs(nextOutputs);
      return nextOutputs;
    } catch (loadError) {
      if (!isCurrent()) return [];
      setError(loadError instanceof Error ? loadError.message : 'recent_outputs_failed');
      setOutputs([]);
      return [];
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [captureAccountRequest]);

  useEffect(() => {
    void refresh();
    return () => { sequence.current += 1; };
  }, [refresh]);

  return {
    outputs,
    loading,
    error,
    refresh,
  };
}
