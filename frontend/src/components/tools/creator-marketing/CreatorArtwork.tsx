import React from 'react';
import type { CreatorToolId } from '@/lib/toolbox/creator-availability';

/** Authored presentation art. Never an operation result, owned input, or provider benchmark. */
export function CreatorArtwork({ id, alt, priority = false, className, sizes = '(max-width: 760px) 100vw, 60vw' }: {
  id: CreatorToolId; alt: string; priority?: boolean; className?: string; sizes?: string;
}) {
  const base = `/assets/tools/creator-art/${id}`;
  // Authored WebP variants are already bounded/responsive; no second optimizer request.
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={className} src={`${base}-960.webp`} srcSet={`${base}-640.webp 640w, ${base}-960.webp 960w, ${base}-1536.webp 1536w`}
    sizes={sizes} width={1536} height={1024} alt={alt} loading={priority ? 'eager' : 'lazy'} {...priority ? { fetchpriority: 'high' } : {}} decoding="async" />;
}
