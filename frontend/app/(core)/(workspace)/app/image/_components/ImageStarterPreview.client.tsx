'use client';

import Image from 'next/image';
import { useI18n } from '@/lib/i18n/I18nProvider';
import type { StarterMedia } from '@/lib/starter-media';

export type ImageStarterNavigation = { index: number; total: number; onPrev?: () => void; onNext?: () => void };

export function ImageStarterPreview({ item, navigation }: { item: StarterMedia; navigation: ImageStarterNavigation }) {
  const { locale } = useI18n();
  const copy = locale === 'fr' ? { sample: 'Exemple', prev: 'Exemple précédent', next: 'Exemple suivant' }
    : locale === 'es' ? { sample: 'Ejemplo', prev: 'Ejemplo anterior', next: 'Ejemplo siguiente' }
      : { sample: 'Sample', prev: 'Previous sample', next: 'Next sample' };
  return <section className="rounded-card border border-hairline bg-surface p-3" aria-label={`${copy.sample}: ${item.title}`} data-image-starter-preview={item.id}>
    <div className="relative mx-auto aspect-square w-full max-w-[280px] sm:max-w-[320px]">
      <Image src={item.src} alt={item.title} fill sizes="(max-width: 640px) 280px, 320px" className="object-contain" loading="eager" />
    </div>
    <div className="mt-2 flex items-center justify-between gap-2 text-sm">
      <span>{copy.sample} · {item.title}</span>
      <div className="flex items-center gap-2">
        <button type="button" aria-label={copy.prev} disabled={!navigation.onPrev} onClick={navigation.onPrev} className="min-h-11 min-w-11 rounded-input border border-hairline disabled:opacity-40">←</button>
        <span className="tabular-nums">{navigation.index + 1}/{navigation.total}</span>
        <button type="button" aria-label={copy.next} disabled={!navigation.onNext} onClick={navigation.onNext} className="min-h-11 min-w-11 rounded-input border border-hairline disabled:opacity-40">→</button>
      </div>
    </div>
  </section>;
}
