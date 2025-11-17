'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export type ModelGalleryCard = {
  id: string;
  label: string;
  description: string;
  versionLabel?: string;
  priceNote?: string | null;
  priceNoteHref?: string | null;
  href: string;
  media: {
    videoUrl?: string | null;
    optimizedPosterUrl?: string | null;
    posterUrl?: string | null;
  };
};

const INITIAL_COUNT = 6;
const LOAD_COUNT = 6;

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
        {visibleCards.map((card, index) => (
          <ModelCard key={card.id} card={card} isLcp={index === 0} ctaLabel={ctaLabel} />
        ))}
      </div>
      <div ref={observerRef} className="h-4 w-full" aria-hidden />
    </>
  );
}

function ModelCard({ card, isLcp, ctaLabel }: { card: ModelGalleryCard; isLcp: boolean; ctaLabel: string }) {
  const { videoUrl, optimizedPosterUrl, posterUrl } = card.media;
  const poster = optimizedPosterUrl ?? posterUrl ?? null;
  const [shouldLoadVideo, setShouldLoadVideo] = useState(isLcp);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!videoUrl) return undefined;
    const node = videoRef.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShouldLoadVideo(true);
          }
        });
      },
      { rootMargin: isLcp ? '0px' : '300px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [videoUrl, isLcp]);

  useEffect(() => {
    if (!videoUrl) return;
    const node = videoRef.current;
    if (!node) return;
    if (shouldLoadVideo && !node.src) {
      node.src = videoUrl;
      node.load();
    }
    if (shouldLoadVideo) {
      const playPromise = node.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => undefined);
      }
    } else {
      node.pause();
    }
  }, [videoUrl, shouldLoadVideo]);

  return (
    <article className="group relative min-h-[26rem] overflow-hidden rounded-3xl border border-black/5 bg-white text-neutral-900 shadow-lg transition hover:border-black/10 hover:shadow-xl">
      <div className="relative aspect-video overflow-hidden">
        {videoUrl ? (
          <>
            {poster ? (
              <Image
                src={poster}
                alt=""
                fill
                className="absolute inset-0 h-full w-full object-cover opacity-10"
                priority={isLcp}
                fetchPriority={isLcp ? 'high' : undefined}
                loading={isLcp ? 'eager' : 'lazy'}
                quality={80}
                sizes="(min-width: 1280px) 32rem, (min-width: 640px) 50vw, 100vw"
              />
            ) : null}
            <video
              ref={videoRef}
              className="h-full w-full object-cover opacity-0 transition duration-500 group-hover:scale-105 group-hover:opacity-15"
              playsInline
              muted
              loop
              preload="none"
            />
          </>
        ) : poster ? (
          <Image
            src={poster}
            alt=""
            fill
            className="object-cover opacity-10"
            priority={isLcp}
            fetchPriority={isLcp ? 'high' : undefined}
            loading={isLcp ? 'eager' : 'lazy'}
            quality={80}
            sizes="(min-width: 1280px) 32rem, (min-width: 640px) 50vw, 100vw"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-white via-white/70 to-white/50 opacity-95 transition group-hover:opacity-80" />
      </div>
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-6 pb-24">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-neutral-500">
          <span>{card.versionLabel}</span>
          <span className="rounded-full border border-black/10 px-2 py-1 text-[10px] font-semibold text-neutral-500">MaxVideoAI</span>
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-neutral-900 transition group-hover:text-neutral-800">{card.label}</h2>
          <p className="mt-1 text-sm text-neutral-500">{card.description}</p>
        </div>
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-neutral-900/70 transition group-hover:translate-x-1 group-hover:text-neutral-900">
          {ctaLabel}
        </span>
      </div>
      {card.priceNote ? (
        card.priceNoteHref ? (
          <Link
            href={card.priceNoteHref}
            className="absolute left-6 bottom-6 z-20 inline-flex text-xs font-semibold text-accent transition hover:text-accentSoft"
          >
            {card.priceNote}
          </Link>
        ) : (
          <span className="absolute left-6 bottom-6 z-20 inline-flex text-xs font-semibold text-accent transition group-hover:text-accentSoft">
            {card.priceNote}
          </span>
        )
      ) : null}
      <Link href={card.href} className="absolute inset-0 z-10" aria-label={`${ctaLabel} ${card.label}`}>
        <span className="sr-only">{ctaLabel}</span>
      </Link>
    </article>
  );
}
