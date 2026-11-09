'use client';
import { useRef, useState } from 'react';
import { useLibraryDisplayAccess } from './useLibraryMediaAccess';
import type { MediaReadAccess } from '@/lib/media-read-access';

/** Original-quality tool sources: canonical identity stays in the caller's DTO. */
export function useLibrarySourceAccess(source: MediaReadAccess | null | undefined, original?: string, poster?: string | null) {
  const access = useLibraryDisplayAccess(source ?? {});
  const privateSource = Boolean(source?.readAccessRef || source?.readAccessOwnerId);
  const resolved = access.retired ? undefined : privateSource ? access.access.accessUrl : original;
  const thumbnail = access.retired ? undefined : privateSource ? access.access.thumbnailAccessUrl : poster ?? undefined;
  const [failed, setFailed] = useState<string>();
  const current = useRef(resolved); current.current = resolved;
  const url = resolved && failed !== resolved ? resolved : undefined;
  function onError() {
    const captured = resolved;
    void access.refresh().then(ok => { if (!ok && current.current === captured) setFailed(captured); });
  }
  function retry() {
    if (!privateSource) { setFailed(undefined); return; }
    access.beginAttempt();
    void access.refresh().then(ok => { if (ok) setFailed(undefined); });
  }
  return { url, poster: thumbnail, retired: access.retired, pending: access.pending,
    unavailable: !access.retired && !access.pending && Boolean(original) && !url,
    privateSource, onError, retry };
}
