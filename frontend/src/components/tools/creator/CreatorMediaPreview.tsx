'use client';
import { useEffect, useRef, useState } from 'react';
import { useLibrarySourceAccess } from '@/hooks/useLibrarySourceAccess';
import type { CreatorSource } from './creator-source-selection';
import { Upload } from 'lucide-react';
import { creatorWorkspaceCopy } from './creator-workspace-copy';
import styles from './creator-workspace.module.css';
/** Private media uses its original URL and native, manual playback. No public optimizer. */
export function CreatorMediaPreview({ locale, url: original, source, kind, poster: originalPoster, name, unavailable = false, onRetry }: { locale: string; url?: string; source?: CreatorSource; kind: 'image' | 'video' | 'audio'; poster?: string | null; name?: string; unavailable?: boolean; onRetry?(): void }) {
  const access = useLibrarySourceAccess(source, original, originalPoster);
  const url = access.url, poster = access.poster;
  const player = useRef<HTMLMediaElement>(null);
  useEffect(() => { const node = player.current; if (node && url && node.getAttribute('src') !== url) node.setAttribute('src', url); return () => { if (node) { if (!node.paused) node.pause(); node.removeAttribute('src'); } }; }, [url]);
  const retry = source && access.privateSource ? access.retry : onRetry;
  const fail = () => { if (source && access.privateSource) access.onError(); else setFailed(url ?? null); };
  const [failed, setFailed] = useState<string | null>(null), copy = creatorWorkspaceCopy(locale);
  const failure = <p className={styles.error} role="alert">{copy.previewError}{retry ? <button type="button" onClick={retry}>{copy.retry}</button> : null}</p>;
  if (access.retired) return null;
  if (unavailable || access.unavailable) return failure;
  if (!url) return <div className={styles.media}><div className={styles.empty}><Upload size={28} aria-hidden="true" /><p>{copy.sourceHint}</p></div></div>;
  return <><div className={styles.media}>
    {kind === 'image' ? /* eslint-disable-next-line @next/next/no-img-element -- Private original; public optimization is forbidden. */
      <img src={url} alt={name ?? copy.source} onError={fail} />
      : kind === 'video' ? <video ref={player as React.Ref<HTMLVideoElement>} key={url} src={url} poster={poster ?? undefined} controls preload="none" playsInline onError={fail} />
        : <audio ref={player as React.Ref<HTMLAudioElement>} key={url} src={url} controls preload="none" onError={fail} />}
  </div>{failed === url ? failure : null}</>;
}
