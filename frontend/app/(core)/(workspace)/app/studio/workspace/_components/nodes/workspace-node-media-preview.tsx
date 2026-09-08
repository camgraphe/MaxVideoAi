'use client';

/* eslint-disable @next/next/no-img-element */
import { useState } from 'react';
import { Play, AudioWaveform } from 'lucide-react';
import styles from '../../_styles/canvas-nodes.module.css';

// Stable mount ref: transfer focus once when playback replaces its launcher,
// without stealing focus on later parent renders or metadata updates.
function focusMediaControls(media: HTMLMediaElement | null) {
  media?.focus({ preventScroll: true });
}

export function VideoPreview({
  posterUrl,
  videoUrl,
  label = 'Play video',
}: {
  posterUrl?: string | null;
  videoUrl: string;
  label?: string;
}) {
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  return (
    <div className={styles.nodePreview}>
      {activeUrl === videoUrl ? <video key={videoUrl} ref={focusMediaControls} tabIndex={0} className={`${styles.previewVideo} nodrag`} controls playsInline preload="none" autoPlay poster={posterUrl ?? undefined} src={videoUrl} /> : <button type="button" className={`${styles.mediaPlayButton} nodrag`} onClick={() => setActiveUrl(videoUrl)} aria-label={label}>
        {posterUrl ? <img src={posterUrl} alt="" loading="lazy" /> : null}
        <span><Play size={20} />{label}</span>
      </button>}
    </div>
  );
}

export function AudioPreview({ audioUrl, label = 'Listen' }: { audioUrl: string; label?: string }) {
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  return (
    <div className={`${styles.nodePreview} ${styles.audioPreview}`}>
      {activeUrl === audioUrl ? <audio key={audioUrl} ref={focusMediaControls} tabIndex={0} className={`${styles.previewAudio} nodrag`} controls preload="none" autoPlay src={audioUrl} /> : <button type="button" className={`${styles.mediaPlayButton} nodrag`} onClick={() => setActiveUrl(audioUrl)}><span><AudioWaveform size={24} />{label}</span></button>}
    </div>
  );
}
