'use client';

import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Play, ArrowUpRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import { buildVideoWatchPath } from '@/lib/video-seo-canonical';
import { EDITORIAL_COPY as C } from '../_lib/best-for-editorial-copy';
import type { ExamplePreviewPick } from '../_lib/best-for-detail-config';

const SceneDialog = dynamic(() => import('./BestForSceneDialog.client'), { ssr: false });

export function BestForSceneCard({ slug, name, scene, locale, priority = false, wide = false }: {
  slug: string; name: string; scene: NonNullable<ExamplePreviewPick['example']>; locale: AppLocale; priority?: boolean; wide?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const href = buildVideoWatchPath(scene.id);
  return <article className="bf-scene">
    <a href={href} className="bf-scene-cover" aria-label={C.play[locale] + ': ' + scene.title}
      onClick={event => { if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); setOpen(true); } }}>
      <Image src={scene.poster} alt={scene.title} fill sizes={wide ? "(max-width: 767px) calc(100vw - 48px), 760px" : "(max-width: 767px) calc(100vw - 48px), (max-width: 1023px) 46vw, 390px"}
        priority={priority} className="object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.02]" />
      <span className="bf-play"><Play size={20} fill="currentColor" aria-hidden /></span>
      <span className="bf-duration">{scene.duration > 0 ? scene.duration + ' s' : C.play[locale]}</span>
    </a>
    <div className="bf-scene-body">
      <Link href={{ pathname: '/models/[slug]', params: { slug } }} className="bf-model-credit">{name}<ArrowUpRight size={13} aria-hidden /></Link>
      <h3>{scene.title}</h3>
      <p>{scene.watchFor}</p>
      <a href={href} className="bf-text-link">{C.prompt[locale]}<ArrowUpRight size={15} aria-hidden /></a>
    </div>
    {open ? <SceneDialog scene={scene} name={name} locale={locale} href={href} onClose={() => setOpen(false)} /> : null}
  </article>;
}
