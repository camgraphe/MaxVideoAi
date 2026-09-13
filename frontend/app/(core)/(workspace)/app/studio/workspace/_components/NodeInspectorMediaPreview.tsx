'use client';

/* eslint-disable @next/next/no-img-element */

import baseStyles from '../maxvideoai-editor.module.css';
import inspectorStyles from '../_styles/inspector.module.css';
import { AudioPreview, VideoPreview } from './nodes/workspace-node-media-preview';
import type { StudioCopy } from '../../_lib/studio-copy';
import {
  isPlayableAudioUrl,
  isPlayableVideoUrl,
} from '../_lib/workspace-media-availability';

const styles = { ...baseStyles, ...inspectorStyles };

export function NodeInspectorMediaPreview({
  kind,
  thumbUrl,
  url,
  copy,
}: {
  kind?: string;
  thumbUrl?: string | null;
  url?: string | null;
  copy: StudioCopy['canvas']['nodes'];
}) {
  const playableVideoUrl = kind === 'video' && isPlayableVideoUrl(url) ? url : null;
  const playableAudioUrl = kind === 'audio' && isPlayableAudioUrl(url) ? url : null;
  const previewUrl = thumbUrl ?? (kind === 'image' || kind === 'logo' ? url : null);
  if (playableVideoUrl) {
    return (
      <div className={styles.inspectorPreview}>
        <VideoPreview videoUrl={playableVideoUrl} posterUrl={thumbUrl} label={copy.playMedia} />
      </div>
    );
  }
  if (playableAudioUrl) {
    return (
      <div className={styles.inspectorPreview}>
        <AudioPreview audioUrl={playableAudioUrl} label={copy.listen} />
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
