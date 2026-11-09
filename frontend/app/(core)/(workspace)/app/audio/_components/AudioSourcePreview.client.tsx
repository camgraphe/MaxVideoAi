'use client';
import { useEffect, useRef } from 'react';
import { useLibrarySourceAccess } from '@/hooks/useLibrarySourceAccess';
import type { MediaReadAccess } from '@/lib/media-read-access';

export function AudioSourcePreview({ source, kind, label, errorLabel, retryLabel, className, controls = true }: {
  source: MediaReadAccess & { url: string; thumbUrl?: string | null }; kind: 'audio' | 'video';
  label?: string; errorLabel: string; retryLabel: string; className?: string; controls?: boolean;
}) {
  const access = useLibrarySourceAccess(source, source.url, source.thumbUrl);
  const player = useRef<HTMLMediaElement>(null);
  useEffect(() => { const node = player.current; if (node && access.url && node.getAttribute('src') !== access.url) node.setAttribute('src', access.url); return () => { if (node) { if (!node.paused) node.pause(); node.removeAttribute('src'); } }; }, [access.url]);
  if (access.retired) return null;
  if (!access.url) return access.pending ? null : <p role="alert">{errorLabel}<button type="button" onClick={access.retry}>{retryLabel}</button></p>;
  return kind === 'audio'
    ? <audio key={access.url} ref={player as React.Ref<HTMLAudioElement>} src={access.url} controls={controls} preload="none" aria-label={label} className={className} onError={access.onError} />
    : <video key={access.url} ref={player as React.Ref<HTMLVideoElement>} src={access.url} poster={access.poster} controls={controls} muted={!controls} preload="none" playsInline aria-label={label} className={className} onError={access.onError} />;
}
