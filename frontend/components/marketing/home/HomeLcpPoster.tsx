import React from 'react';
import {
  HOME_LCP_MOBILE_POSTER_HEIGHT,
  HOME_LCP_MOBILE_POSTER_WIDTH,
} from './home-lcp-image';
import { HOME_LCP_DESKTOP_DELIVERY_SRC, HOME_LCP_MOBILE_DELIVERY_SRC } from './home-lcp-delivery';

export function HomeLcpPoster({ alt }: { alt: string }) {
  return (
    <picture className="absolute inset-0 block">
      <source
        media="(min-width: 768px)"
        srcSet={HOME_LCP_DESKTOP_DELIVERY_SRC}
        type="image/webp"
      />
      <img
        src={HOME_LCP_MOBILE_DELIVERY_SRC}
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
