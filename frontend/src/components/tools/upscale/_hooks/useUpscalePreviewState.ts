import { useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { UpscaleMediaType, UpscaleMode, UpscaleToolResponse } from '@/types/tools-upscale';
import {
  clampComparePosition,
  isOutputVideo,
  SAMPLE_IMAGE_URL,
  SOURCE_FALLBACK_HEIGHT,
  SOURCE_FALLBACK_WIDTH,
} from '../_lib/upscale-workspace-helpers';
import type { PreviewMode, PreviewZoom, UploadedAsset } from '../_lib/upscale-workspace-types';

export function useUpscalePreviewState({
  mediaType,
  mediaUrl,
  mode,
  previewMode,
  previewZoom,
  result,
  source,
  upscaleFactor,
}: {
  mediaType: UpscaleMediaType;
  mediaUrl: string;
  mode: UpscaleMode;
  previewMode: PreviewMode;
  previewZoom: PreviewZoom;
  result: UpscaleToolResponse | null;
  source: UploadedAsset | null;
  upscaleFactor: number;
}) {
  const [comparePosition, setComparePosition] = useState(50);
  const [compareDragging, setCompareDragging] = useState(false);
  const output = result?.output ?? null;
  const hasResult = Boolean(output?.url);
  const hasSourcePreview = Boolean(mediaUrl.trim());
  const canCompare = hasResult && hasSourcePreview && result?.mediaType === mediaType;
  const activePreviewMode: PreviewMode = hasResult ? (previewMode === 'compare' && !canCompare ? 'result' : previewMode) : 'source';
  const sourcePreviewUrl = mediaUrl || SAMPLE_IMAGE_URL;
  const resultPreviewUrl = output?.url || mediaUrl || SAMPLE_IMAGE_URL;
  const sourcePreviewIsVideo = mediaType === 'video' && Boolean(mediaUrl);
  const resultPreviewIsVideo = output ? isOutputVideo(output) : sourcePreviewIsVideo;
  const compareEnabled = activePreviewMode === 'compare' && canCompare;
  const previewZoomScale = previewZoom === 'fit' ? 1 : Number(previewZoom) / 100;
  const isPixelZoom = previewZoom !== 'fit';
  const mediaFitClass = 'object-contain';
  const sourceWidth = source?.width ?? SOURCE_FALLBACK_WIDTH;
  const sourceHeight = source?.height ?? SOURCE_FALLBACK_HEIGHT;
  const previewFactor = mode === 'factor' ? upscaleFactor : 2;
  const outputWidth = output?.width ?? Math.round(sourceWidth * previewFactor);
  const outputHeight = output?.height ?? Math.round(sourceHeight * previewFactor);
  const sourceSizeLabel = `${sourceWidth} x ${sourceHeight}`;
  const outputSizeLabel = `${outputWidth} x ${outputHeight}`;
  const zoomCanvasWidth = activePreviewMode === 'source' ? sourceWidth : outputWidth;
  const zoomCanvasHeight = activePreviewMode === 'source' ? sourceHeight : outputHeight;
  const mediaTypeLabel = mediaType === 'video' ? 'Video' : 'Image';

  function updateComparePosition(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const nextPosition = ((event.clientX - rect.left) / rect.width) * 100;
    setComparePosition(clampComparePosition(nextPosition));
  }

  function handleComparePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    setCompareDragging(true);
    updateComparePosition(event);
  }

  function handleComparePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!compareDragging) return;
    updateComparePosition(event);
  }

  function handleComparePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setCompareDragging(false);
  }

  function handleCompareKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!compareEnabled) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setComparePosition((current) => clampComparePosition(current - 4));
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setComparePosition((current) => clampComparePosition(current + 4));
    }
    if (event.key === 'Home') {
      event.preventDefault();
      setComparePosition(8);
    }
    if (event.key === 'End') {
      event.preventDefault();
      setComparePosition(92);
    }
  }

  return {
    activePreviewMode,
    canCompare,
    compareEnabled,
    compareDragging,
    comparePosition,
    handleCompareKeyDown,
    handleComparePointerDown,
    handleComparePointerMove,
    handleComparePointerUp,
    hasResult,
    hasSourcePreview,
    isPixelZoom,
    mediaFitClass,
    mediaTypeLabel,
    output,
    outputHeight,
    outputSizeLabel,
    outputWidth,
    previewZoomScale,
    resultPreviewIsVideo,
    resultPreviewUrl,
    sourceHeight,
    sourcePreviewIsVideo,
    sourcePreviewUrl,
    sourceSizeLabel,
    sourceWidth,
    zoomCanvasHeight,
    zoomCanvasWidth,
  };
}
