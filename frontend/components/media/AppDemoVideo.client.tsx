'use client';
import { useEffect } from 'react';
import { usePublicVideoPlayback } from './usePublicVideoPlayback';

type Props = {
  src: string; muted: boolean; loop: boolean; className: string;
  register: (node: HTMLVideoElement | null) => void;
  onLoadedData: (node: HTMLVideoElement) => void;
  onCanPlay: (node: HTMLVideoElement) => void;
};
/** Mounted by the preview dock only after Play; original URLs remain on the VideoItem. */
export function AppDemoVideo({ src, muted, loop, className, register, onLoadedData, onCanPlay }: Props) {
  const { attempt, begin, fail } = usePublicVideoPlayback('workspace-preview');
  useEffect(() => { begin(src, 'user'); }, [begin, src]);
  if (attempt?.rendition.originalSrc !== src) return null;
  return <video key={attempt.id} ref={register} data-preview-video="active" src={attempt.rendition.src}
    className={className} muted={muted} loop={loop} playsInline autoPlay preload="none"
    onLoadedData={event => onLoadedData(event.currentTarget)} onCanPlay={event => onCanPlay(event.currentTarget)}
    onError={event => fail(attempt.id, event.currentTarget.error?.code)} />;
}
