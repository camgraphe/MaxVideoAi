'use client';

import styles from '../../_styles/canvas.module.css';

export function VideoPreview({
  posterUrl,
  videoUrl,
}: {
  posterUrl?: string | null;
  videoUrl: string;
}) {
  return (
    <div className={styles.nodePreview}>
      <video className={`${styles.previewVideo} nodrag`} controls playsInline preload="metadata" poster={posterUrl ?? undefined} src={videoUrl} />
    </div>
  );
}

export function AudioPreview({ audioUrl }: { audioUrl: string }) {
  return (
    <div className={`${styles.nodePreview} ${styles.audioPreview}`}>
      <audio className={`${styles.previewAudio} nodrag`} controls preload="metadata" src={audioUrl} />
    </div>
  );
}
