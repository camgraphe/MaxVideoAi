'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link, type LocalizedLinkHref } from '@/i18n/navigation';
import type { CinematicPresentation } from '../_lib/model-page-cinematic-data';
import type { buildCinematicGalleryItems } from '../_lib/model-page-cinematic-gallery';
import { ModelCinematicVideoPrompt } from './ModelCinematicVideoPrompt.client';
import { CinematicArrow } from './ModelCinematicMarks';
import { ModelCinematicFilm } from './ModelCinematicFilm.client';

export function ModelCinematicGallery({ title, items, ui, examplesHref, examplesLabel }: {
  title: string; items: ReturnType<typeof buildCinematicGalleryItems>; ui: CinematicPresentation['ui'];
  examplesHref: LocalizedLinkHref | null; examplesLabel: string;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });
  useEffect(() => {
    const node = rail.current;
    if (!node) return;
    const update = () => setEdges({ start: node.scrollLeft <= 2, end: node.scrollLeft + node.clientWidth >= node.scrollWidth - 2 });
    update();
    node.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => { node.removeEventListener('scroll', update); observer.disconnect(); };
  }, [items.length]);
  const move = (direction: number) => rail.current?.scrollBy({ left: direction * rail.current.clientWidth * .8,
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  return <div className="cinema-wrap cinema-gallery">
    <header className="cinema-gallery-heading"><h2>{title}</h2><div className="cinema-gallery-actions">
      {examplesHref ? <Link href={examplesHref} prefetch={false} className="cinema-source-link" data-analytics-event="cta_click" data-analytics-cta-name="see_examples" data-analytics-cta-location="model_related" data-analytics-target-family="examples">{examplesLabel}<CinematicArrow /></Link> : null}
      {!(edges.start && edges.end) ? <div className="cinema-gallery-navigation">
        <button type="button" disabled={edges.start} onClick={() => move(-1)} aria-label={ui.previousExamples}><ChevronLeft size={18} aria-hidden="true" /></button>
        <button type="button" disabled={edges.end} onClick={() => move(1)} aria-label={ui.nextExamples}><ChevronRight size={18} aria-hidden="true" /></button>
      </div> : null}
    </div></header>
    {items.length ? <div className="cinema-gallery-rail" ref={rail} role="region" aria-label={title} tabIndex={0}>
      {items.map(item => {
        const [width, height] = (item.aspectRatio ?? '16:9').split(':').map(Number);
        const ratio = width > 0 && height > 0 ? width / height : 16 / 9;
        return <figure key={item.id} className="cinema-gallery-card" style={{ '--frame-ratio': ratio } as CSSProperties}>
          <div className="cinema-gallery-image">
            {item.videoUrl ? <ModelCinematicFilm video={item.videoUrl} poster={item.posterUrl} title={item.title} ui={ui} mask="gallery" /> : <Link href={item.href as LocalizedLinkHref} prefetch={false} aria-label={item.title}>
              {item.posterUrl ? <Image src={item.posterUrl} alt={item.alt} fill loading="lazy" sizes={ratio > 1 ? '(min-width: 768px) 370px, 320px' : '(min-width: 768px) 120px, 105px'} /> : null}
            </Link>}
            {item.prompt ? <ModelCinematicVideoPrompt title={item.title} prompt={item.prompt} note={item.metadata}
              imageDetailsLabel={ui.sourcePrompt} ui={ui} creation={item.creation} compactTrigger /> : null}
          </div>
          <figcaption><Link href={item.href as LocalizedLinkHref} prefetch={false}>{item.title}</Link><small>{item.metadata}</small></figcaption>
        </figure>;
      })}
    </div> : null}
  </div>;
}
