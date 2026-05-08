import { useEffect, useRef } from 'react';
import type { PreviewMode, PreviewZoom } from '../_lib/upscale-workspace-types';

export function useUpscalePreviewScroller({
  activePreviewMode,
  isPixelZoom,
  previewZoom,
  resultPreviewUrl,
  sourcePreviewUrl,
}: {
  activePreviewMode: PreviewMode;
  isPixelZoom: boolean;
  previewZoom: PreviewZoom;
  resultPreviewUrl: string;
  sourcePreviewUrl: string;
}) {
  const previewScrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const scroller = previewScrollerRef.current;
    if (!scroller) return undefined;
    if (!isPixelZoom) {
      scroller.scrollLeft = 0;
      scroller.scrollTop = 0;
      return undefined;
    }
    const frame = window.requestAnimationFrame(() => {
      scroller.scrollLeft = Math.max(0, (scroller.scrollWidth - scroller.clientWidth) / 2);
      scroller.scrollTop = Math.max(0, (scroller.scrollHeight - scroller.clientHeight) / 2);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activePreviewMode, isPixelZoom, previewZoom, resultPreviewUrl, sourcePreviewUrl]);

  return previewScrollerRef;
}
