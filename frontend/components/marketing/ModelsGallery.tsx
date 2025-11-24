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
  const initial = cards.slice(0, INITIAL_COUNT);
  const remaining = cards.slice(INITIAL_COUNT);
  const [visibleCards, setVisibleCards] = useState<ModelGalleryCard[]>(initial);
  const [pendingCards, setPendingCards] = useState<ModelGalleryCard[]>(remaining);
  const observerRef = useRef<HTMLDivElement | null>(null);

  const appendCards = useCallback(() => {
    setPendingCards((current) => {
      if (!current.length) return current;
      setVisibleCards((prev) => [...prev, ...current.slice(0, LOAD_COUNT)]);
      return current.slice(LOAD_COUNT);
    });
  }, []);

  useEffect(() => {
    if (!pendingCards.length) return undefined;
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
  }, [appendCards, pendingCards.length]);

  return (
    <>
      <div className="mt-12 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {visibleCards.map((card) => (
          <ModelCard key={card.id} card={card} ctaLabel={ctaLabel} />
        ))}
      </div>
      <div ref={observerRef} className="h-4 w-full" aria-hidden />
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
        <h2 className="text-xl font-semibold leading-snug text-neutral-900">{card.label}</h2>
        <p className="mt-1 text-sm text-neutral-600">{card.description}</p>
        {card.priceNote ? (
          card.priceNoteHref ? (
            <Link
              href={card.priceNoteHref}
              prefetch={false}
              className="mt-2 inline-flex text-xs font-semibold text-accent hover:text-accentSoft"
              onClick={(event) => event.stopPropagation()}
            >
              {card.priceNote}
            </Link>
          ) : (
            <span className="mt-2 inline-flex text-xs font-semibold text-accent">{card.priceNote}</span>
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
