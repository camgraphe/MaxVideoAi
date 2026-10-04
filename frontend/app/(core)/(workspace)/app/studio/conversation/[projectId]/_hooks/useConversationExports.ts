'use client';
import {useCallback,useEffect,useState} from 'react';
import type {StudioProjectTimelineExport} from '@/server/timeline-exports/contracts';
export function useConversationExports(projectId: string,enabled: boolean) {
  const [jobs,setJobs] = useState<StudioProjectTimelineExport[]>([]);
  const [error,setError] = useState<string | null>(null);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (!enabled) return;
    try {const response = await fetch(`/api/studio/projects/${encodeURIComponent(projectId)}/conversation-exports`,{cache: 'no-store',signal});const result = await response.json();if (signal?.aborted) return;if (!response.ok || !result.ok) throw new Error('STUDIO_EXPORTS_UNAVAILABLE');setJobs(result.exports);setError(null);}
    catch {if (!signal?.aborted) setError('STUDIO_EXPORTS_UNAVAILABLE');}
  },[projectId,enabled]);
  const working = jobs.some(job => job.status === 'queued' || job.status === 'rendering');
  useEffect(() => {setJobs([]);setError(null);},[projectId,enabled]);
  useEffect(() => {if (!enabled) return;const controller = new AbortController();void refresh(controller.signal);const timer = window.setInterval(() => {if (!document.hidden) void refresh(controller.signal);},working ? 2000 : 20000);return () => {controller.abort();window.clearInterval(timer);};},[enabled,refresh,working]);
  return {jobs,working,error,refresh};
}
