import React from 'react';

export type CreatorResultImage = {
  original: string; width: number; height: number;
  variants: { src: string; width: number }[];
};
export type CreatorResultVideoMedia = {
  original: string; poster: string; width: number; height: number; duration: number; hasAudio: boolean;
};

/** Responsive display copies; links and generation inputs keep the exact original. */
export function CreatorResultImage({ media, alt, priority = false, sizes = '(max-width: 760px) 100vw, 48vw' }: {
  media: CreatorResultImage; alt: string; priority?: boolean; sizes?: string;
}) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={media.variants[1]?.src ?? media.variants[0].src} srcSet={media.variants.map(variant => `${variant.src} ${variant.width}w`).join(', ')} sizes={sizes}
    width={media.width} height={media.height} alt={alt} loading={priority ? 'eager' : 'lazy'} decoding="async" {...priority ? { fetchpriority: 'high' } : {}} />;
}
