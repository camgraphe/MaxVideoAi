'use client';
import { useMemo, type CSSProperties } from 'react';
import { Pause, Play } from 'lucide-react';
import { getImageAlt } from '@/lib/image-alt';
import { ExampleGalleryCard } from './ExampleGalleryCard';
import { dedupeExamples } from './examples-gallery-helpers';
import { buildGalleryOpening, galleryVideoRatio } from './examples-discovery-layout';
import { useGalleryPreviewBudget } from './useGalleryPreviewBudget';
import type { ExamplesGalleryProps } from './examples-gallery-props';
import type { ExampleGalleryVideo } from './examples-gallery-types';
import styles from './examples-masonry.module.css';
export type { ExampleGalleryVideo } from './examples-gallery-types';

export default function ExamplesGalleryGridClient({initialExamples,detailsCtaLabel='View settings & price',
  noPreviewLabel='No preview',prioritizeFirstPoster=false,audioAvailableLabel='Audio available on playback',
  openingEnabled,sort,locale}:ExamplesGalleryProps) {
  const videos=useMemo(()=>dedupeExamples(initialExamples),[initialExamples]);
  const {opening,rest}=useMemo(()=>buildGalleryOpening(videos,openingEnabled??(prioritizeFirstPoster&&sort==='playlist')),[videos,openingEnabled,prioritizeFirstPoster,sort]);
  const visibleVideos=useMemo(()=>[...opening,...rest],[opening,rest]);
  const ids=useMemo(()=>visibleVideos.filter(video=>video.previewVideoUrl).map(video=>video.id),[visibleVideos]);
  const preview=useGalleryPreviewBudget(ids);
  const firstVisibleId=visibleVideos[0]?.id;
  const card=(video:ExampleGalleryVideo,frame?:'lead'|'portrait'|'side')=><ExampleGalleryCard key={video.id} video={video} locale={locale}
    altText={getImageAlt({kind:'renderThumb',engine:video.engineLabel,label:video.prompt,locale})}
    detailsCtaLabel={detailsCtaLabel} audioAvailableLabel={audioAvailableLabel} noPreviewLabel={noPreviewLabel}
    prioritizePoster={prioritizeFirstPoster && video.id === firstVisibleId} requested={preview.active.has(video.id)} frame={frame}
    onVisibility={preview.onVisibility} onIntent={preview.setIntent} />;
  const pauseLabel=locale==='fr'?'Pause des aperçus':locale==='es'?'Pausar vistas previas':'Pause previews';
  const resumeLabel=locale==='fr'?'Animer les aperçus':locale==='es'?'Animar vistas previas':'Animate previews';
  return <div>
    <div className="mb-3 flex justify-end">
      <button type="button" aria-pressed={!preview.paused} onClick={preview.togglePaused}
        className="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface px-3 py-2 text-xs font-medium text-text-secondary transition hover:border-text-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {preview.paused?<Play size={13}/>:<Pause size={13}/>}{preview.paused?resumeLabel:pauseLabel}
      </button>
    </div>
    {opening.length?<div className={styles.opening} data-gallery-opening>{opening.map((video,index)=>card(video,index===0?'lead':index===1?'portrait':'side'))}</div>:null}
    <div className={styles.gallery}>{rest.map(video=><div key={video.id} className={styles.item} style={{'--video-ratio':galleryVideoRatio(video)} as CSSProperties}>{card(video)}</div>)}</div>
  </div>;
}
