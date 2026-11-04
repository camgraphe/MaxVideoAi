'use client';

import { useEffect, useState } from 'react';
import type { VideoExcerptRange } from '@/lib/video-excerpt';
import { mediaExcerptDuration } from '@/lib/media-excerpt-timing';
import { RECAST_MAX_SOURCE_SECONDS } from '@/lib/character-studio-recast-timing';

export type RecastTrack = {
  file: File;
  name: string;
  url: string;
  originalSeconds?: number;
  range?: VideoExcerptRange;
};

// Remove binary subtraction noise before rounding a suggestion to whole seconds.
export const passageSeconds = (track: RecastTrack | null) =>
  track?.range
    ? mediaExcerptDuration(track.range)
    : null;

/** Keep the local original for re-editing. An overlong source is never implicitly shortened. */
export function useRecastTrack(kind: 'audio' | 'video') {
  const [track, setTrack] = useState<RecastTrack | null>(null);
  const [editing, setEditing] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const url = track?.url;
  useEffect(() => {
    if (!url) return;
    const probe = document.createElement(kind);
    let settled = false;
    const releaseProbe = () => {
      probe.onloadedmetadata = null;
      probe.onerror = null;
      probe.removeAttribute('src');
      probe.load();
    };
    const finish = (duration: number) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      releaseProbe();
      if (!Number.isFinite(duration) || duration <= 0) {
        setInvalid(true);
        setTrack(null);
        return;
      }
      const wholeFits = duration <= RECAST_MAX_SOURCE_SECONDS;
      setTrack((current) =>
        current?.url === url
          ? {
              ...current,
              originalSeconds: duration,
              range: wholeFits ? { startSec: 0, endSec: duration } : undefined,
            }
          : current,
      );
      setEditing(!wholeFits);
    };
    const timer = setTimeout(() => finish(NaN), 10000);
    probe.onloadedmetadata = () => finish(probe.duration);
    probe.onerror = () => finish(NaN);
    probe.preload = 'metadata';
    probe.src = url;
    return () => {
      if (!settled) releaseProbe();
      settled = true;
      clearTimeout(timer);
      URL.revokeObjectURL(url);
    };
  }, [url, kind]);
  return {
    track,
    editing,
    invalid,
    setEditing,
    select(file: File) {
      setInvalid(false);
      setEditing(false);
      if (!file.type) {
        const type = kind === 'video' ? (/\.mov$/i.test(file.name) ? 'video/quicktime' : 'video/mp4')
          : /\.wav$/i.test(file.name) ? 'audio/wav' : 'audio/mpeg';
        file = new File([file], file.name, { type, lastModified: file.lastModified });
      }
      setTrack({ file, name: file.name, url: URL.createObjectURL(file) });
    },
    remove() {
      setInvalid(false);
      setEditing(false);
      setTrack(null);
    },
    apply(originalUrl: string, range: VideoExcerptRange) {
      setTrack((current) => (current?.url === originalUrl ? { ...current, range } : current));
      setEditing(false);
    },
  };
}
export type RecastTrackControl = ReturnType<typeof useRecastTrack>;
