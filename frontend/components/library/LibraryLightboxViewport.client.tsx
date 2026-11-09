'use client';
import Lightbox, { type Slide } from 'yet-another-react-lightbox';
import Inline from 'yet-another-react-lightbox/plugins/inline';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import Video from 'yet-another-react-lightbox/plugins/video';
import type { ImageDisplay } from '@/lib/image-display';
import type { AssetBrowserAsset } from './AssetLibraryBrowser';
const plugins = [Inline, Zoom, Video];
const hidden = () => null;
/** One active slide: siblings are thumbnail-only and navigation is parent-controlled. */
export default function LibraryLightboxViewport({
  asset,
  display,
  source,
  poster,
  label,
  locale,
}: {
  asset: AssetBrowserAsset;
  display?: ImageDisplay;
  source: string;
  poster?: string;
  label: string;
  locale: string;
}) {
  const slide: Slide =
    asset.kind === 'video'
      ? {
          type: 'video',
          sources: [{ src: source, type: asset.mime ?? 'video/mp4' }],
          poster,
          controls: true,
          playsInline: true,
          preload: 'none',
          autoPlay: false,
        }
      : {
          src: source,
          alt: label,
          width: display?.width ?? asset.width ?? undefined,
          height: display?.height ?? asset.height ?? undefined,
        };
  return (
    <Lightbox
      plugins={plugins}
      slides={[slide]}
      carousel={{ finite: true, preload: 0, imageFit: 'contain' }}
      controller={{ focus: false, aria: false, closeOnBackdropClick: false }}
      toolbar={{ buttons: asset.kind === 'image' ? ['zoom'] : [] }}
      render={{ buttonPrev: hidden, buttonNext: hidden, iconLoading: hidden }}
      styles={{ container: { background: 'transparent' } }}
      labels={
        locale.startsWith('fr')
          ? { 'Zoom in': 'Agrandir', 'Zoom out': 'Réduire', 'Photo gallery': 'Galerie photo', Carousel: 'Carrousel', '{index} of {total}': '{index} sur {total}' }
          : locale.startsWith('es')
            ? { 'Zoom in': 'Ampliar', 'Zoom out': 'Reducir', 'Photo gallery': 'Galería de fotos', Carousel: 'Carrusel', '{index} of {total}': '{index} de {total}' }
            : {}
      }
      animation={{ fade: 0, swipe: 0, zoom: 0 }}
      zoom={{ maxZoomPixelRatio: 2 }}
    />
  );
}
