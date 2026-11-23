import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import type { ReactNode } from 'react';
import { CinematicArrow } from './ModelCinematicMarks';
import type { CinematicAsset, CinematicPresentation } from '../_lib/model-page-cinematic-data';
import { ModelCinematicPrompt } from './ModelCinematicPrompt.client';
export { ModelCinematicPrompt } from './ModelCinematicPrompt.client';
import { ModelCinematicZoom } from './ModelCinematicZoom.client';
import { ModelCinematicShotPlan } from './ModelCinematicShotPlan.client';
import { ModelCinematicFilm } from './ModelCinematicFilm.client';

export function ModelCinematicAsset({ asset, ui, plan, compact = false, inspect = false, details, sizes }: {
  asset: CinematicAsset; ui: CinematicPresentation['ui']; plan?: { motion: string; sound: string }; compact?: boolean; inspect?: boolean;
  details?: ReactNode; sizes?: string;
}) {
  return <figure className={`cinema-asset${compact ? ' cinema-asset--compact' : ''}`}>
    {asset.video ? <ModelCinematicFilm video={asset.video.src} poster={asset.video.poster} title={asset.title} ui={ui} mask="frame" /> : inspect ? <ModelCinematicZoom asset={asset} ui={ui} /> : <a className="cinema-asset-image" href={asset.original.url} target="_blank" rel="noopener noreferrer" aria-label={`${ui.original} — ${asset.title}`}>
      <Image src={asset.display.url} width={asset.display.width} height={asset.display.height} alt={asset.title}
        sizes={sizes ?? (compact ? '(min-width: 768px) 42vw, 90vw' : '(min-width: 1440px) 1280px, 90vw')} loading="lazy" />
      <span aria-hidden="true"><CinematicArrow direction="external" /></span>
    </a>}
    <figcaption><h4>{asset.watchHref ? <Link href={asset.watchHref} prefetch={false} className="cinema-watch-title">{asset.title}<CinematicArrow /></Link> : asset.title}</h4><p>{asset.metadataLabel}</p></figcaption>
    {details ?? <>{plan ? <ModelCinematicShotPlan plan={plan} ui={ui} /> : null}<ModelCinematicPrompt asset={asset} ui={ui} /></>}
  </figure>;
}
