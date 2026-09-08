'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { authFetch } from '@/lib/authFetch';
import type { WorkspaceAssetRecord, WorkspaceTimelineItem } from '../_lib/workspace-types';
import type { WorkspaceSequenceRecord } from '../_state/workspace-state';
import {
  applyStudioMediaAccess,
  studioMediaAssetId,
  type StudioMediaAccess,
} from '../_state/workspace-media-access';

async function requestStudioMediaAccess(projectId: string, assetIds: string[]): Promise<StudioMediaAccess[]> {
  const response = await authFetch(`/api/studio/projects/${encodeURIComponent(projectId)}/media-access`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ assetIds }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok || !Array.isArray(payload.assets)) throw new Error('STUDIO_MEDIA_ACCESS_FAILED');
  return payload.assets.filter((item: unknown): item is StudioMediaAccess => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    const value = item as Partial<StudioMediaAccess>;
    return typeof value.assetId === 'string' && typeof value.url === 'string'
      && (typeof value.expiresAt === 'string' || value.expiresAt === null);
  });
}

export function useWorkspaceMediaAccess(params: {
  accountId: string | null;
  enabled: boolean;
  projectAssets: WorkspaceAssetRecord[];
  projectId?: string;
  setProjectAssets: React.Dispatch<React.SetStateAction<WorkspaceAssetRecord[]>>;
  setSequences: React.Dispatch<React.SetStateAction<WorkspaceSequenceRecord[]>>;
  setTimelineItems: React.Dispatch<React.SetStateAction<WorkspaceTimelineItem[]>>;
  timelineItemsRef: React.MutableRefObject<WorkspaceTimelineItem[]>;
}) {
  const {
    accountId, enabled, projectAssets, projectId,
    setProjectAssets, setSequences, setTimelineItems, timelineItemsRef,
  } = params;
  const failedUrlsRef = useRef(new Set<string>());
  const requestInFlightRef = useRef<Promise<void> | null>(null);
  const pendingAssetIdsRef = useRef(new Set<string>());
  const renewLatestRef = useRef<(assetIds: string[]) => Promise<void>>(() => Promise.resolve());
  const scopeRef = useRef('');
  const assetIds = useMemo(() => [...new Set(projectAssets
    .map(studioMediaAssetId)
    .filter((assetId): assetId is string => Boolean(assetId)))], [params.projectAssets]);
  const assetKey = assetIds.join('|');

  const renew = useCallback((requestedIds: string[]) => {
    if (!enabled || !projectId || !accountId || !requestedIds.length) return Promise.resolve();
    requestedIds.forEach((assetId) => pendingAssetIdsRef.current.add(assetId));
    if (requestInFlightRef.current) return requestInFlightRef.current;
    const scope = `${accountId}:${projectId}`;
    scopeRef.current = scope;
    const batch = [...pendingAssetIdsRef.current];
    pendingAssetIdsRef.current.clear();
    const request = requestStudioMediaAccess(projectId, batch).then((access) => {
      if (scopeRef.current !== scope) return;
      setProjectAssets((current) => applyStudioMediaAccess({
        projectAssets: current, timelineItems: [], sequences: [],
      }, access).projectAssets);
      setTimelineItems((current) => {
        const updated = applyStudioMediaAccess({ projectAssets: [], timelineItems: current, sequences: [] }, access).timelineItems;
        timelineItemsRef.current = updated;
        return updated;
      });
      setSequences((current) => applyStudioMediaAccess({
        projectAssets: [], timelineItems: [], sequences: current,
      }, access).sequences);
    }).catch(() => undefined).finally(() => {
      if (requestInFlightRef.current === request) {
        requestInFlightRef.current = null;
        if (pendingAssetIdsRef.current.size) void renewLatestRef.current([...pendingAssetIdsRef.current]);
      }
    });
    requestInFlightRef.current = request;
    return request;
  }, [accountId, enabled, projectId, setProjectAssets, setSequences, setTimelineItems, timelineItemsRef]);
  renewLatestRef.current = renew;

  useEffect(() => {
    const scope = `${accountId ?? 'anonymous'}:${projectId ?? 'local'}`;
    scopeRef.current = scope;
    failedUrlsRef.current.clear();
    pendingAssetIdsRef.current.clear();
    const requestedIds = assetKey ? assetKey.split('|') : [];
    if (!enabled || !requestedIds.length) return;
    void renew(requestedIds);
    const timer = window.setInterval(() => void renew(requestedIds), 240_000);
    return () => window.clearInterval(timer);
  }, [assetKey, accountId, enabled, projectId, renew]);

  return useCallback((item: WorkspaceTimelineItem) => {
    const assetId = studioMediaAssetId(item);
    const failedUrl = item.mediaAccessUrl;
    if (!assetId || !failedUrl || failedUrlsRef.current.has(failedUrl)) return;
    failedUrlsRef.current.add(failedUrl);
    void renew([assetId]);
  }, [renew]);
}
