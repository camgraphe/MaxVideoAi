'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useRouter } from '@/i18n/navigation';
import type { LocalizedLinkHref } from '@/i18n/navigation';

export type ModelGalleryCard = {
  id: string;
  label: string;
  description: string;
  versionLabel?: string;
  priceNote?: string | null;
  priceNoteHref?: string | null;
  href: LocalizedLinkHref;
  backgroundColor?: string | null;
  textColor?: string | null;
};

const INITIAL_COUNT = 6;
const LOAD_COUNT = 6;
const CTA_ARROW = '→';

function normalizeCtaLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed.length) {
    return `Explore model ${CTA_ARROW}`;
  }
  return trimmed.endsWith(CTA_ARROW) ? trimmed : `${trimmed} ${CTA_ARROW}`;
}

export function ModelsGallery({
  cards,
  ctaLabel,
}: {
  cards: ModelGalleryCard[];
  ctaLabel: string;
}) {
  const [visibleCount, setVisibleCount] = useState(Math.min(INITIAL_COUNT, cards.length));
  const observerRef = useRef<HTMLDivElement | null>(null);

  const appendCards = useCallback(() => {
    setVisibleCount((current) => {
      if (current >= cards.length) return current;
      return Math.min(cards.length, current + LOAD_COUNT);
    });
  }, [cards.length]);

  useEffect(() => {
    setVisibleCount(Math.min(INITIAL_COUNT, cards.length));
  }, [cards]);

  useEffect(() => {
    if (visibleCount >= cards.length) return undefined;
    const node = observerRef.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          appendCards();
        }
      },
      { rootMargin: '300px 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [appendCards, cards.length, visibleCount]);

  return (
    <>
      <div className="mt-12 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {cards.slice(0, visibleCount).map((card) => (
          <ModelCard key={card.id} card={card} ctaLabel={ctaLabel} />
        ))}
      </div>
      {visibleCount < cards.length ? <div ref={observerRef} className="h-4 w-full" aria-hidden /> : null}
    </>
  );
}

function ModelCard({ card, ctaLabel }: { card: ModelGalleryCard; ctaLabel: string }) {
  const router = useRouter();
  type RouterPushInput = Parameters<typeof router.push>[0];
  const background = card.backgroundColor ?? '#F5F7FB';
  const textColor = card.textColor ?? '#1F2633';
  const normalizedCtaLabel = normalizeCtaLabel(ctaLabel);
  const handleClick = () => router.push(card.href as RouterPushInput);
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      router.push(card.href as RouterPushInput);
    }
  };
  return (
    <article
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="flex min-h-[11rem] cursor-pointer flex-col justify-between rounded-2xl border border-black/5 p-4 text-neutral-900 shadow-lg transition hover:border-black/10 hover:shadow-xl"
      style={{ backgroundColor: background, color: textColor }}
      aria-label={`${normalizedCtaLabel} ${card.label}`}
    >
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-micro text-neutral-600">
        <span>{card.versionLabel}</span>
        <span className="rounded-full border border-black/10 px-2 py-1 text-[10px] font-semibold text-neutral-600">MaxVideoAI</span>
      </div>
      <div className="mt-3">
        <h3 className="text-lg font-semibold leading-snug text-neutral-900 sm:text-xl">{card.label}</h3>
        <p className="mt-1 text-sm text-neutral-600">{card.description}</p>
        {card.priceNote ? (
          card.priceNoteHref ? (
            <Link
              href={card.priceNoteHref}
              prefetch={false}
              className="mt-2 inline-flex text-xs font-semibold text-neutral-700 hover:text-neutral-900"
              onClick={(event) => event.stopPropagation()}
            >
              {card.priceNote}
            </Link>
          ) : (
            <span className="mt-2 inline-flex text-xs font-semibold text-neutral-700">{card.priceNote}</span>
          )
        ) : null}
      </div>
      <Link
        href={card.href}
        prefetch={false}
        className="mt-3 inline-flex items-center rounded-full px-2 py-1 text-sm font-semibold text-neutral-900/80 underline decoration-transparent underline-offset-4 transition hover:decoration-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        aria-label={`Explore ${card.label}`}
        onClick={(event) => event.stopPropagation()}
      >
        {normalizedCtaLabel}
      </Link>
    </article>
  );
}
