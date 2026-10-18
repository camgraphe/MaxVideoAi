import { useCallback, useEffect, type ChangeEvent, type Dispatch, type SetStateAction } from 'react';
import type { AssetBrowserAsset } from '@/components/library/AssetLibraryBrowser';
import type {
  UpscaleMediaType,
  UpscaleToolResponse,
} from '@/types/tools-upscale';
import {
  inferMimeType,
  mediaTypeFromMime,
  uploadSourceFile,
} from '../_lib/upscale-workspace-helpers';
import type {
  PreviewMode,
  UploadedAsset,
} from '../_lib/upscale-workspace-types';
import { getUpscaleUploadErrorMessage } from '../_lib/upscale-upload-errors';

interface UseUpscaleSourceMediaParams {
  changeMediaType: (next: UpscaleMediaType) => void;
  onSourceChange: () => void;
  copy: {
    library: string;
  };
  locale: string;
  mediaType: UpscaleMediaType;
  mediaUrl: string;
  setError: Dispatch<SetStateAction<string | null>>;
  setLibraryModalOpen: Dispatch<SetStateAction<boolean>>;
  setMediaUrl: Dispatch<SetStateAction<string>>;
  setMessage: Dispatch<SetStateAction<string | null>>;
  setPreviewMode: Dispatch<SetStateAction<PreviewMode>>;
  setResult: Dispatch<SetStateAction<UpscaleToolResponse | null>>;
  setSource: Dispatch<SetStateAction<UploadedAsset | null>>;
  setUploading: Dispatch<SetStateAction<boolean>>;
  source: UploadedAsset | null;
}

export function useUpscaleSourceMedia({
  changeMediaType,
  onSourceChange,
  copy,
  locale,
  mediaType,
  mediaUrl,
  setError,
  setLibraryModalOpen,
  setMediaUrl,
  setMessage,
  setPreviewMode,
  setResult,
  setSource,
  setUploading,
  source,
}: UseUpscaleSourceMediaParams) {
  useEffect(() => {
    const url = mediaUrl.trim();
    if (mediaType !== 'image' || !url) return undefined;
    if (source?.url === url && source.width && source.height) return undefined;

    let cancelled = false;
    const image = new window.Image();
    image.onload = () => {
      if (cancelled || !image.naturalWidth || !image.naturalHeight) return;
      setSource((current) => {
        if (current?.url && current.url !== url) return current;
        return {
          ...(current ?? {}),
          url,
          width: current?.width ?? image.naturalWidth,
          height: current?.height ?? image.naturalHeight,
          mime: current?.mime ?? inferMimeType(url, 'image'),
        };
      });
    };
    image.src = url;
    return () => {
      cancelled = true;
    };
  }, [mediaType, mediaUrl, setSource, source?.height, source?.url, source?.width]);

  const handleUpload = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      onSourceChange();
      const detectedType = mediaTypeFromMime(file.type);
      const nextMediaType = detectedType ?? mediaType;
      if (nextMediaType !== mediaType) changeMediaType(nextMediaType);
      setUploading(true);
      setError(null);
      setMessage(null);
      try {
        const uploaded = await uploadSourceFile(file, nextMediaType);
        setSource(uploaded);
        setMediaUrl(uploaded.url);
        setResult(null);
        setPreviewMode('source');
        setMessage(null);
      } catch (uploadError) {
        setError(getUpscaleUploadErrorMessage(uploadError, nextMediaType, locale));
      } finally {
        setUploading(false);
      }
    },
    [
      changeMediaType,
      onSourceChange,
      locale,
      mediaType,
      setError,
      setMediaUrl,
      setMessage,
      setPreviewMode,
      setResult,
      setSource,
      setUploading,
    ]
  );

  const selectLibraryAsset = useCallback(
    (asset: AssetBrowserAsset) => {
      onSourceChange();
      const nextMediaType: UpscaleMediaType = asset.kind === 'video' || asset.mime?.startsWith('video/') ? 'video' : 'image';
      if (nextMediaType !== mediaType) {
        changeMediaType(nextMediaType);
      }
      setSource({
        id: asset.savedAssetId ?? (asset.sourceOutputId || asset.source === 'recent' || asset.id.startsWith('job:') ? null : asset.id),
        jobId: asset.jobId ?? (asset.id.startsWith('job:') ? asset.id.slice(4) : null),
        url: asset.url,
        width: asset.width ?? null,
        height: asset.height ?? null,
        mime: asset.mime ?? (nextMediaType === 'video' ? 'video/mp4' : 'image/png'),
        name: copy.library,
      });
      setMediaUrl(asset.url);
      setResult(null);
      setPreviewMode('source');
      setError(null);
      setMessage(null);
      setLibraryModalOpen(false);
    },
    [
      changeMediaType,
      onSourceChange,
      copy.library,
      mediaType,
      setError,
      setLibraryModalOpen,
      setMediaUrl,
      setMessage,
      setPreviewMode,
      setResult,
      setSource,
    ]
  );

  return {
    handleUpload,
    selectLibraryAsset,
  };
}
