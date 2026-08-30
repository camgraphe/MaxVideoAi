import React from 'react';
import {
  HOME_LCP_MOBILE_POSTER_HEIGHT,
  HOME_LCP_MOBILE_POSTER_SRC,
  HOME_LCP_MOBILE_POSTER_WIDTH,
  HOME_LCP_POSTER_SRC,
} from './home-lcp-image';

export function HomeLcpPoster({ alt }: { alt: string }) {
  return (
    <picture className="absolute inset-0 block">
      <source
        media="(min-width: 768px)"
        srcSet={HOME_LCP_POSTER_SRC}
        type="image/webp"
      />
      <img
        src={HOME_LCP_MOBILE_POSTER_SRC}
        alt={alt}
        width={HOME_LCP_MOBILE_POSTER_WIDTH}
        height={HOME_LCP_MOBILE_POSTER_HEIGHT}
        loading="eager"
        fetchPriority="high"
        decoding="async"
        className="h-full w-full object-cover"
      />
    </picture>
  );
}
