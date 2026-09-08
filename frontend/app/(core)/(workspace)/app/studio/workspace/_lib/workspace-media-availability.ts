import type {
  WorkspaceOutputMetadata,
  WorkspaceOutputStatus,
} from './workspace-types';

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
  if (output.kind === 'audio') return isPlayableAudioUrl(output.url) ? 'ready' : 'placeholder';
  return output.url || output.thumbUrl ? 'ready' : 'placeholder';
}
