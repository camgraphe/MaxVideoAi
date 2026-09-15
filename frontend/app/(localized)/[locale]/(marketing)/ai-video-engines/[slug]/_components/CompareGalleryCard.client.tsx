'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import type { AppLocale } from '@/i18n/locales';
const CompareVideoDialog = dynamic(() => import('./CompareVideoDialog.client'), { ssr: false });
import Link from 'next/link';
import { Play } from 'lucide-react';
import { useExampleCardPlayback } from '@/components/examples/useExampleCardPlayback';
import type { CompareGalleryVideo } from '../_lib/compare-gallery-data';

export function CompareGalleryCard({ item, name, watchLabel, returnPath, locale }: {
  locale: AppLocale; item: CompareGalleryVideo; name: string; watchLabel: string; returnPath: string;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const href = `/video/${encodeURIComponent(item.id)}?from=${encodeURIComponent(returnPath)}`;
  const link = useRef<HTMLAnchorElement>(null);
  const [visible, setVisible] = useState(false);
  const [intent, setIntent] = useState(false);
  const { videoRef, playbackAttempt, events, videoReady } = useExampleCardPlayback(item.preview ?? item.video, visible && intent && !open, true);
  useEffect(() => {
    if (!link.current) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: .25 });
    observer.observe(link.current);
    return () => observer.disconnect();
  }, []);
  return <><Link ref={link} href={href} prefetch={false}
    onClick={event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault(); setIntent(false); setOpen(true);
    }}
    className="compare-gallery-video" aria-haspopup="dialog" aria-label={`${watchLabel} · ${name}${item.duration > 0 ? ` · ${item.duration} s` : ''}`}
    onPointerEnter={event => { if (event.pointerType === 'mouse') setIntent(true); }} onPointerLeave={() => setIntent(false)}
    onFocus={() => setIntent(true)} onBlur={() => setIntent(false)}>
    <Image src={item.poster} alt={`${watchLabel} · ${name}`} fill sizes="(max-width: 700px) 33vw, (max-width: 1100px) 16vw, 200px" quality={52} className="object-cover" />
    {playbackAttempt ? <video key={playbackAttempt.id} ref={videoRef} src={playbackAttempt.rendition.src}
      muted loop playsInline preload="none" aria-hidden="true" data-examples-card {...events}
      className={`absolute inset-0 h-full w-full object-cover ${videoReady ? 'opacity-100' : 'opacity-0'}`} /> : null}
    <span className="compare-gallery-play"><Play size={16} fill="currentColor" aria-hidden="true" /></span>
    {item.duration > 0 ? <span className="compare-gallery-duration">{item.duration} s</span> : null}
  </Link>{open ? <CompareVideoDialog item={item} name={name} locale={locale} href={href} onClose={close} /> : null}</>;
}
