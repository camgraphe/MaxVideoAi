'use client';

/* eslint-disable @next/next/no-img-element */

import baseStyles from '../maxvideoai-editor.module.css';
import inspectorStyles from '../_styles/inspector.module.css';
import {
  isPlayableAudioUrl,
  isPlayableVideoUrl,
} from '../_lib/workspace-media-availability';

const styles = { ...baseStyles, ...inspectorStyles };

export function NodeInspectorMediaPreview({
  kind,
  thumbUrl,
  url,
}: {
  kind?: string;
  thumbUrl?: string | null;
  url?: string | null;
}) {
  const playableVideoUrl = kind === 'video' && isPlayableVideoUrl(url) ? url : null;
  const playableAudioUrl = kind === 'audio' && isPlayableAudioUrl(url) ? url : null;
  const previewUrl = thumbUrl ?? url ?? null;
  if (playableVideoUrl) {
    return (
      <div className={styles.inspectorPreview}>
        <video className={`${styles.previewVideo} nodrag`} controls playsInline preload="metadata" poster={thumbUrl ?? undefined} src={playableVideoUrl} />
      </div>
    );
  }
  if (playableAudioUrl) {
    return (
      <div className={styles.inspectorPreview}>
        <audio className={`${styles.previewAudio} nodrag`} controls preload="metadata" src={playableAudioUrl} />
      </div>
    );
  }
  if (!previewUrl) return null;
  return (
    <div className={styles.inspectorPreview}>
      <img src={previewUrl} alt="" />
    </div>
  );
}
