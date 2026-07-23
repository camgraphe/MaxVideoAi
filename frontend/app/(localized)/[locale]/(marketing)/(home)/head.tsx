import { getImageProps } from 'next/image';
import {
  HOME_LCP_POSTER_HEIGHT,
  HOME_LCP_POSTER_SIZES,
  HOME_LCP_POSTER_SRC,
  HOME_LCP_POSTER_WIDTH,
} from '@/components/marketing/home/home-lcp-image';

const {
  props: { src: lcpPosterSrc, srcSet: lcpPosterSrcSet },
} = getImageProps({
  src: HOME_LCP_POSTER_SRC,
  alt: '',
  width: HOME_LCP_POSTER_WIDTH,
  height: HOME_LCP_POSTER_HEIGHT,
  sizes: HOME_LCP_POSTER_SIZES,
});

export default function Head() {
  return (
    <link
      rel="preload"
      as="image"
      href={lcpPosterSrc}
      imageSrcSet={lcpPosterSrcSet}
      imageSizes={HOME_LCP_POSTER_SIZES}
      fetchPriority="high"
    />
  );
}
