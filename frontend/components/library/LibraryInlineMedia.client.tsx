'use client';
import type { ComponentProps } from 'react';
import { useLibraryDisplayAccess } from '@/hooks/useLibraryMediaAccess';
import type { AssetBrowserAsset } from './AssetLibraryBrowser';
/** Caller retains mount/intent ownership; this adapter only renews the exact read. */
export function LibraryInlineVideo({ asset, ...props }: { asset: AssetBrowserAsset } & Omit<ComponentProps<'video'>, 'src' | 'poster' | 'onError'>) {
  const { access, refresh, retired } = useLibraryDisplayAccess(asset);
  if (retired) return null;
  return <video {...props} src={access.previewAccessUrl ?? asset.previewUrl ?? undefined} poster={access.thumbnailAccessUrl ?? asset.thumbUrl ?? undefined} onError={() => { void refresh(); }} />;
}
export function LibraryInlineAudio({ asset, ...props }: { asset: AssetBrowserAsset } & Omit<ComponentProps<'audio'>, 'src' | 'onError'>) {
  const { access, refresh, retired } = useLibraryDisplayAccess(asset);
  if (retired) return null;
  return <audio {...props} src={access.accessUrl ?? asset.url} onError={() => { void refresh(); }} />;
}
