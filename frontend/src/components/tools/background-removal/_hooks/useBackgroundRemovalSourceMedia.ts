import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchBackgroundRemovalLibraryAssets,
  readBackgroundRemovalVideoMetadata,
  uploadSourceVideo,
} from '../_lib/background-removal-workspace-helpers';
import type {
  BackgroundRemovalSourceAsset,
  BackgroundRemovalVideoMetadata,
} from '../_lib/background-removal-workspace-types';

type LibrarySource = 'all' | 'upload' | 'generated' | 'background-removal';

export function useBackgroundRemovalSourceMedia(params: {
  onSourceChanged?: () => void;
  maxDurationSeconds: number;
}) {
  const [videoUrl, setVideoUrl] = useState('');
  const [source, setSource] = useState<BackgroundRemovalSourceAsset | null>(null);
  const [metadata, setMetadata] = useState<BackgroundRemovalVideoMetadata | null>(null);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [librarySource, setLibrarySource] = useState<LibrarySource>('all');
  const [libraryAssets, setLibraryAssets] = useState<BackgroundRemovalSourceAsset[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);

  const librarySourceOptions = useMemo(
    () =>
      [
        { value: 'all' as const, label: 'All videos' },
        { value: 'upload' as const, label: 'Uploaded' },
        { value: 'generated' as const, label: 'Generated' },
        { value: 'background-removal' as const, label: 'Background removal' },
      ],
    []
  );

  const applySource = useCallback(
    (asset: BackgroundRemovalSourceAsset | null, url: string) => {
      setSource(asset);
      setVideoUrl(url);
      setMetadata(null);
      setSourceError(null);
      params.onSourceChanged?.();
    },
    [params]
  );

  const changeVideoUrl = useCallback(
    (url: string) => {
      applySource(null, url);
    },
    [applySource]
  );

  const handleUpload = useCallback(
    async (file: File | null | undefined) => {
      if (!file) return;
      setUploading(true);
      setSourceError(null);
      try {
        const uploaded = await uploadSourceVideo(file);
        applySource(uploaded, uploaded.url);
      } catch (error) {
        setSourceError(error instanceof Error ? error.message : 'Upload failed.');
      } finally {
        setUploading(false);
      }
    },
    [applySource]
  );

  const refreshLibrary = useCallback(async () => {
    setLibraryLoading(true);
    setLibraryError(null);
    try {
      setLibraryAssets(await fetchBackgroundRemovalLibraryAssets(librarySource));
    } catch (error) {
      setLibraryError(error instanceof Error ? error.message : 'Could not load library videos.');
    } finally {
      setLibraryLoading(false);
    }
  }, [librarySource]);

  useEffect(() => {
    if (!libraryOpen) return;
    void refreshLibrary();
  }, [libraryOpen, refreshLibrary]);

  const selectLibraryAsset = useCallback(
    (asset: BackgroundRemovalSourceAsset) => {
      applySource(asset, asset.url);
      setLibraryOpen(false);
    },
    [applySource]
  );

  useEffect(() => {
    const url = videoUrl.trim();
    if (!url) {
      setMetadata(null);
      setMetadataLoading(false);
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      setMetadata(null);
      setMetadataLoading(false);
      setSourceError('Use an absolute HTTP(S) video URL.');
      return;
    }

    let cancelled = false;
    setMetadata(null);
    setMetadataLoading(true);
    setSourceError(null);
    readBackgroundRemovalVideoMetadata(url)
      .then((nextMetadata) => {
        if (cancelled) return;
        setMetadata(nextMetadata);
        if (nextMetadata.durationSec > params.maxDurationSeconds) {
          setSourceError(`Studio mode supports clips up to ${params.maxDurationSeconds} seconds.`);
        }
      })
      .catch(() => {
        if (!cancelled) setSourceError('Video metadata is required before background removal.');
      })
      .finally(() => {
        if (!cancelled) setMetadataLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [params.maxDurationSeconds, videoUrl]);

  return {
    changeVideoUrl,
    handleUpload,
    libraryAssets,
    libraryError,
    libraryLoading,
    libraryOpen,
    librarySource,
    librarySourceOptions,
    metadata,
    metadataLoading,
    refreshLibrary,
    selectLibraryAsset,
    setLibraryOpen,
    setLibrarySource,
    source,
    sourceError,
    uploading,
    videoUrl,
  };
}
