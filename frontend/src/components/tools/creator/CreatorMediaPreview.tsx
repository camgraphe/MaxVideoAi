'use client';
import { useState } from 'react';
import { Upload } from 'lucide-react';
import { creatorWorkspaceCopy } from './creator-workspace-copy';
import styles from './creator-workspace.module.css';
/** Private media uses its original URL and native, manual playback. No public optimizer. */
export function CreatorMediaPreview({ locale, url, kind, poster, name, unavailable = false, onRetry }: { locale: string; url?: string; kind: 'image' | 'video' | 'audio'; poster?: string | null; name?: string; unavailable?: boolean; onRetry?(): void }) {
  const [failed, setFailed] = useState<string | null>(null), copy = creatorWorkspaceCopy(locale);
  const failure = <p className={styles.error} role="alert">{copy.previewError}{onRetry ? <button type="button" onClick={onRetry}>{copy.retry}</button> : null}</p>;
  if (unavailable) return failure;
  if (!url) return <div className={styles.media}><div className={styles.empty}><Upload size={28} aria-hidden="true" /><p>{copy.sourceHint}</p></div></div>;
  return <><div className={styles.media}>
    {kind === 'image' ? /* eslint-disable-next-line @next/next/no-img-element -- Private original; public optimization is forbidden. */
      <img src={url} alt={name ?? copy.source} onError={() => setFailed(url)} />
      : kind === 'video' ? <video key={url} src={url} poster={poster ?? undefined} controls preload="none" playsInline onError={() => setFailed(url)} />
        : <audio key={url} src={url} controls preload="none" onError={() => setFailed(url)} />}
  </div>{failed === url ? failure : null}</>;
}
