'use client';
import { useMemo, type CSSProperties } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useGalleryReader } from './useGalleryReader';
import { ArrowUpRight, MousePointer2, Pause, Play } from 'lucide-react';
import { getImageAlt } from '@/lib/image-alt';
import { ExampleGalleryCard } from './ExampleGalleryCard';
import { dedupeExamples } from './examples-gallery-helpers';
import { buildGalleryOpening, galleryVideoRatio } from './examples-discovery-layout';
import { useGalleryPreviewBudget } from './useGalleryPreviewBudget';
import type { ExamplesGalleryProps } from './examples-gallery-props';
import type { ExampleGalleryVideo } from './examples-gallery-types';
import styles from './examples-masonry.module.css';
export type { ExampleGalleryVideo } from './examples-gallery-types';

const ExampleReader = dynamic(() => import('./ExampleReader.client'), { ssr: false });

export default function ExamplesGalleryGridClient({initialExamples,detailsCtaLabel='View settings & price',
  noPreviewLabel='No preview',prioritizeFirstPoster=false,audioAvailableLabel='Audio available on playback',
  openingEnabled,sort,locale,engineFilter,initialOffset,familyLabel}:ExamplesGalleryProps) {
  const videos=useMemo(()=>dedupeExamples(initialExamples),[initialExamples]);
  const {opening,rest}=useMemo(()=>buildGalleryOpening(videos,openingEnabled??(prioritizeFirstPoster&&sort==='playlist')),[videos,openingEnabled,prioritizeFirstPoster,sort]);
  const visibleVideos=useMemo(()=>[...opening,...rest],[opening,rest]);
  const ids=useMemo(()=>visibleVideos.filter(video=>video.previewVideoUrl).map(video=>video.id),[visibleVideos]);
  const reader=useGalleryReader(visibleVideos,Math.max(0,initialOffset-videos.length),sort,engineFilter,locale);
  const preview=useGalleryPreviewBudget(ids,Boolean(reader.selected));
  const firstVisibleId=visibleVideos[0]?.id;
  const card=(video:ExampleGalleryVideo,frame?:'lead'|'portrait'|'side')=><ExampleGalleryCard key={video.id} video={video} locale={locale}
    altText={getImageAlt({kind:'renderThumb',engine:video.engineLabel,label:video.prompt,locale})}
    detailsCtaLabel={detailsCtaLabel} audioAvailableLabel={audioAvailableLabel} noPreviewLabel={noPreviewLabel}
    prioritizePoster={prioritizeFirstPoster && video.id === firstVisibleId} requested={preview.active.has(video.id)} frame={frame}
    onVisibility={preview.onVisibility} onIntent={preview.setIntent} onOpen={reader.open} />;
  const pauseLabel=locale==='fr'?'Pause des aperçus':locale==='es'?'Pausar vistas previas':'Pause previews';
  const resumeLabel=locale==='fr'?'Animer les aperçus':locale==='es'?'Animar vistas previas':'Animate previews';
  const continuationLabel=familyLabel
    ? locale==='fr'?`Plus de vidéos ${familyLabel}`:locale==='es'?`Más videos de ${familyLabel}`:`More ${familyLabel} videos`
    : locale==='fr'?'Encore des vidéos':locale==='es'?'Más vídeos':'More videos';
  const pageCountLabel=locale==='fr'?'sur cette page':locale==='es'?'en esta página':'on this page';
  const guideLabel=locale==='fr'?'Ouvrez une vidéo pour voir comment elle a été créée.':locale==='es'?'Abre un vídeo para ver cómo se creó.':'Open any video to see how it was made.';
  const guidePills=locale==='fr'?['Prompt','Réglages','Prix actuel']:locale==='es'?['Prompt','Ajustes','Precio actual']:['Prompt','Settings','Current price'];
  const createLabel=locale==='fr'?'Créer dans l’app':locale==='es'?'Crear en la app':'Create in the app';
  return <div>
    {reader.selected && <ExampleReader id={reader.selected} locale={locale} onClose={reader.close} navigationError={reader.navigationError} navigation={{previous:()=>void reader.step(-1),next:()=>void reader.step(1),canPrevious:reader.canPrevious,canNext:reader.canNext,busy:reader.busy}}/>}
    <div className="mb-3 flex justify-end">
      <button type="button" aria-pressed={!preview.paused} onClick={preview.togglePaused}
        className="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface px-3 py-2 text-xs font-medium text-text-secondary transition hover:border-text-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {preview.paused?<Play size={13}/>:<Pause size={13}/>}{preview.paused?resumeLabel:pauseLabel}
      </button>
    </div>
    {opening.length?<div className={styles.opening} data-gallery-opening>
      {card(opening[0],'lead')}
      {opening.slice(1).map((video,index)=>card(video,index===0?'portrait':'side'))}
      <div className={styles.openingAction} data-gallery-guide>
        <span className={styles.openingActionIntro}><MousePointer2 size={15} aria-hidden="true"/><span>{guideLabel}</span></span>
        <span className={styles.openingActionPills}>{guidePills.map(label=><span className={styles.openingActionPill} key={label}>{label}</span>)}</span>
        <Link className={styles.openingActionApp} href="/app" prefetch={false} data-analytics-event="cta_click"
          data-analytics-cta-name="create_from_examples" data-analytics-cta-location="examples_opening"
          data-analytics-target-family="workspace">{createLabel}<ArrowUpRight size={14} aria-hidden="true"/></Link>
      </div>
    </div>:null}
    {opening.length>0&&rest.length>0?<div className={styles.continuationHeading}><h2>{continuationLabel}</h2><span>{rest.length} {pageCountLabel}</span></div>:null}
    <div className={styles.gallery}>{rest.map(video=><div key={video.id} className={styles.item} style={{'--video-ratio':galleryVideoRatio(video)} as CSSProperties}>{card(video)}</div>)}</div>
  </div>;
}
