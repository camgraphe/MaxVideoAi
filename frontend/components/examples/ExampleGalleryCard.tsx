'use client';

import { useEffect, useRef, type MouseEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Play } from 'lucide-react';
import { buildWatchAnchorText } from './examples-gallery-helpers';
import type { ExampleGalleryVideo } from './examples-gallery-types';
import { galleryVideoRatio } from './examples-discovery-layout';
import { useExampleCardPlayback } from './useExampleCardPlayback';
import styles from './examples-masonry.module.css';

type Props = {
  video: ExampleGalleryVideo; locale: string; altText: string; detailsCtaLabel: string;
  prioritizePoster: boolean; noPreviewLabel: string; audioAvailableLabel: string;
  requested: boolean; frame?: 'lead'|'portrait'|'side';
  onVisibility: (id:string,visible:boolean)=>void; onIntent:(id:string|null)=>void;
  onOpen?:(video:ExampleGalleryVideo)=>void;
};
export function ExampleGalleryCard({video,locale,altText,detailsCtaLabel,prioritizePoster,noPreviewLabel,audioAvailableLabel,
  requested,frame,onVisibility,onIntent,onOpen}:Props) {
  const cardRef=useRef<HTMLDivElement>(null);
  const {videoRef,playbackAttempt,events,videoReady}=useExampleCardPlayback(video.previewVideoUrl??null,requested,false);
  const watchAnchorText=buildWatchAnchorText(locale,video);
  useEffect(()=>{
    const node=cardRef.current;if(!node)return;
    const observer=new IntersectionObserver(([entry])=>onVisibility(video.id,entry.isIntersecting),{threshold:0.4});
    observer.observe(node);return ()=>{observer.disconnect();onVisibility(video.id,false);};
  },[video.id,onVisibility]);
  const open=(event:MouseEvent<HTMLAnchorElement>)=>{
    if(!onOpen||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button!==0)return;
    event.preventDefault();onOpen(video);
  };
  return <div ref={cardRef} className={styles.card} data-frame={frame} style={frame?undefined:{aspectRatio:galleryVideoRatio(video)}}
    onMouseEnter={()=>onIntent(video.id)} onMouseLeave={()=>onIntent(null)} onFocus={()=>onIntent(video.id)} onBlur={()=>onIntent(null)}>
    <Link href={video.href} onClick={open} prefetch={false} aria-label={watchAnchorText}
      className={styles.watchLink} data-analytics-event="cta_click" data-analytics-cta-name="view_example_details" data-analytics-cta-location="examples_gallery">
      {video.rawPosterUrl ? <Image src={video.rawPosterUrl} alt={altText} fill
        className={frame==='side'?styles.crop:styles.native} sizes={frame==='lead'?'(max-width: 767px) 100vw, 55vw':frame==='portrait'?'(max-width: 767px) 36vw, 18vw':'(max-width: 767px) 100vw, 33vw'}
        quality={52} priority={prioritizePoster} fetchPriority={prioritizePoster ? 'high' : undefined} />
        : <span className={styles.empty}>{noPreviewLabel}</span>}
      {playbackAttempt ? <video key={playbackAttempt.id} ref={videoRef} src={playbackAttempt.rendition.src}
        muted loop playsInline preload="none" aria-hidden="true" data-examples-card {...events}
        className={`${frame==='side'?styles.crop:styles.native} ${videoReady?styles.playing:styles.waiting}`} />:null}
      <span className={styles.playIcon} aria-hidden="true"><Play size={18} fill="currentColor" /></span>
      <span className={styles.caption}>
        <strong>{video.engineLabel}</strong><span>{video.aspectRatio??'Auto'} · {video.durationSec} s</span>
        <p aria-hidden="true" className={styles.detailLabel}>{detailsCtaLabel} ↗</p>
      </span>
      {video.hasAudio?<span className="sr-only">{audioAvailableLabel}</span>:null}
    </Link>
  </div>;
}
