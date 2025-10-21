'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import type { MemberTier as PricingMemberTier } from '@maxvideoai/pricing';
import { getPricingKernel } from '@/lib/pricing-kernel';
import { useI18n } from '@/lib/i18n/I18nProvider';
import type { PricingScenario } from '@/lib/pricing-scenarios';
import { getModelBySlug } from '@/lib/model-roster';

const GRADIENTS = [
  'from-blue-100 via-blue-50 to-white',
  'from-purple-100 via-white to-amber-50',
  'from-rose-100 via-white to-slate-100',
  'from-slate-200 via-white to-slate-50',
  'from-teal-100 via-white to-blue-50',
  'from-amber-100 via-white to-rose-50',
];

function formatCurrency(currency: string, cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

type FeaturedItemOverride = {
  id: string;
  title: string;
  description?: string;
  videoUrl?: string;
  posterUrl?: string;
  alt?: string;
  meta?: string;
};

type GalleryShowcaseProps = {
  featuredItems?: FeaturedItemOverride[];
};

export function GalleryShowcase({ featuredItems }: GalleryShowcaseProps) {
  const { t, dictionary } = useI18n();
  const gallery = t('home.gallery', {
    title: 'Gallery',
    subtitle: '',
    caption: '',
    hoverLabel: 'Hover loop preview',
    items: [],
  }) as {
    title: string;
    subtitle: string;
    caption: string;
    hoverLabel: string;
    items: Array<{
      id: string;
      label: string;
      description: string;
      alt: string;
      meta: { slug: string; pricing: PricingScenario };
      media?: {
        videoSrc: string;
        posterSrc?: string;
      };
    }>;
  };

  const kernel = useMemo(() => getPricingKernel(), []);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setPrefersReducedMotion(mediaQuery.matches);
    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  type RenderItem = {
    id: string;
    label: string;
    description: string;
    videoSrc?: string;
    posterSrc?: string;
    alt: string;
    meta: string;
  };

  const renderItems: RenderItem[] = featuredItems && featuredItems.length
    ? featuredItems.map((item) => ({
        id: item.id,
        label: item.title,
        description: item.description ?? '',
        videoSrc: item.videoUrl,
        posterSrc: item.posterUrl,
        alt: item.alt ?? item.title,
        meta: item.meta ?? '',
      }))
    : gallery.items.map((item) => {
        const pricingScenario = item.meta.pricing;
        const quote = kernel.quote({
          engineId: pricingScenario.engineId,
          durationSec: pricingScenario.durationSec,
          resolution: pricingScenario.resolution,
          memberTier: (pricingScenario.memberTier ?? 'member').toString().toLowerCase() as PricingMemberTier,
        });
        const rosterEntry = getModelBySlug(item.meta.slug);
        const localizedMeta = dictionary.models.meta?.[item.meta.slug];
        const displayName = localizedMeta?.displayName ?? rosterEntry?.marketingName ?? item.label;
        const versionLabel = localizedMeta?.versionLabel ?? rosterEntry?.versionLabel;
        const costLabel = formatCurrency(quote.snapshot.currency, quote.snapshot.totalCents);
        const durationLabel = `${pricingScenario.durationSec} s`;

        return {
          id: item.id,
          label: item.label,
          description: item.description,
          videoSrc: item.media?.videoSrc,
          posterSrc: item.media?.posterSrc,
          alt: item.alt,
          meta: `Model: ${displayName}${versionLabel ? ` · ${versionLabel}` : ''} | Duration: ${durationLabel} | Cost: ${costLabel}`,
        } satisfies RenderItem;
      });

  return (
    <section className="mx-auto mt-20 max-w-6xl px-4 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-text-primary sm:text-3xl">{gallery.title}</h2>
          <p className="text-sm text-text-secondary sm:text-base">{gallery.subtitle}</p>
        </div>
        <span className="hidden rounded-pill border border-hairline px-3 py-1 text-xs font-semibold uppercase tracking-micro text-text-muted sm:inline-flex">
          {gallery.caption}
        </span>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {renderItems.map((item, index) => (
          <figure
            key={item.id}
            className="group relative overflow-hidden rounded-card border border-border bg-white shadow-card"
            aria-labelledby={`${item.id}-label`}
          >
            <div className="relative aspect-video w-full overflow-hidden bg-black">
              {item.videoSrc ? (
                prefersReducedMotion && item.posterSrc ? (
                  <Image
                    src={item.posterSrc}
                    alt={item.alt}
                    fill
                    className="object-cover"
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  />
                ) : (
                  <video
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    poster={item.posterSrc}
                    aria-label={item.alt}
                  >
                    <source src={item.videoSrc} type="video/mp4" />
                  </video>
                )
              ) : (
                <div className={`h-full w-full bg-gradient-to-br ${GRADIENTS[index % GRADIENTS.length]}`} aria-hidden />
              )}
            </div>
            <div className="flex flex-col gap-1 border-t border-hairline p-4">
              <span id={`${item.id}-label`} className="text-sm font-semibold text-text-primary">
                {item.label}
              </span>
              {item.description ? <p className="text-xs text-text-muted">{item.description}</p> : null}
              {item.meta ? <p className="text-[11px] font-medium text-text-secondary">{item.meta}</p> : null}
              <span className="sr-only">{item.alt}</span>
            </div>
            <div className="pointer-events-none absolute inset-0 hidden items-center justify-center bg-black/70 text-white opacity-0 transition duration-200 group-hover:flex group-hover:opacity-100">
              <span className="rounded-pill border border-white/50 px-3 py-1 text-sm">{gallery.hoverLabel}</span>
            </div>
          </figure>
        ))}
      </div>
    </section>
  );
}
