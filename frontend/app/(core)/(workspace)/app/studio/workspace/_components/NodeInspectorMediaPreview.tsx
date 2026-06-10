'use client';

/* eslint-disable @next/next/no-img-element */

import baseStyles from '../maxvideoai-editor.module.css';
import inspectorStyles from '../_styles/inspector.module.css';
import type {
  WorkspaceOutputMetadata,
  WorkspaceOutputStatus,
} from '../_lib/workspace-types';

const styles = { ...baseStyles, ...inspectorStyles };

export function isPlayableVideoUrl(url?: string | null): boolean {
  if (!url) return false;
  if (url.startsWith('blob:') || url.startsWith('data:video/')) return true;
  return /\.(mp4|webm|mov|m4v)(?:[?#].*)?$/i.test(url);
}

export function isPlayableAudioUrl(url?: string | null): boolean {
  if (!url) return false;
  if (url.startsWith('blob:') || url.startsWith('data:audio/')) return true;
  return /\.(mp3|wav|ogg|m4a|aac|mp4|webm|mov|m4v)(?:[?#].*)?$/i.test(url);
}

export function isPlayableImageUrl(url?: string | null): boolean {
  if (!url) return false;
  if (url.startsWith('blob:') || url.startsWith('data:image/')) return true;
  return /\.(png|jpe?g|webp|gif|avif)(?:[?#].*)?$/i.test(url);
}

export function outputStatus(output: WorkspaceOutputMetadata | undefined): WorkspaceOutputStatus {
  if (!output) return 'placeholder';
  if (output.status) return output.status;
  if (output.kind === 'video') return isPlayableVideoUrl(output.url) ? 'ready' : 'placeholder';
  return output.url || output.thumbUrl ? 'ready' : 'placeholder';
}

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
