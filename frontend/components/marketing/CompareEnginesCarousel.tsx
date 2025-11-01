'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';

export type CompareEngineCard = {
  key: string;
  name: string;
  maxDuration: string;
  audio: string;
  bestFor: string;
  href: string;
  bg: string;
};

type CompareEnginesCarouselProps = {
  engines: CompareEngineCard[];
};

export function CompareEnginesCarousel({ engines }: CompareEnginesCarouselProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();

  const scrollByCard = (direction: number) => {
    const el = containerRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>('[data-card]');
    const width = card ? card.offsetWidth + 16 : 320;
    el.scrollBy({ left: direction * width, behavior: 'smooth' });
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let lastTime: number | null = null;
    const speed = 0.05; // pixels per millisecond for gentle drift

    const tick = (timestamp: number) => {
      if (!el) return;
      if (lastTime === null) {
        lastTime = timestamp;
      }
      const delta = timestamp - lastTime;
      lastTime = timestamp;
      el.scrollLeft += delta * speed;
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (el.scrollLeft >= maxScroll - 1) {
        el.scrollLeft = 0;
      }
      animationRef.current = requestAnimationFrame(tick);
    };

    animationRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [engines]);

  return (
    <section aria-labelledby="compare-engines" className="mx-auto mt-20 max-w-6xl px-4 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="compare-engines" className="text-xl font-semibold text-text-primary">
              Compare engines at a glance
            </h2>
            <p className="text-sm text-muted-foreground">Max duration · Audio · Best for</p>
          </div>
          <div className="hidden gap-2 sm:flex">
            <button
              type="button"
              onClick={() => scrollByCard(-1)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-hairline text-sm font-medium text-text-secondary transition hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              aria-label="Scroll to previous engine card"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => scrollByCard(1)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-hairline text-sm font-medium text-text-secondary transition hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              aria-label="Scroll to next engine card"
            >
              ›
            </button>
          </div>
        </div>

        <div
          ref={containerRef}
          className="compare-engines-scroll mt-4 flex gap-4 overflow-x-auto scroll-smooth pb-2"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {engines.map((engine) => (
            <Link
              key={engine.key}
              href={engine.href}
              aria-label={`See presets for ${engine.name}`}
              data-card
              className="group relative w-[260px] shrink-0 snap-start overflow-hidden rounded-3xl border border-black/5 bg-white text-neutral-900 shadow-lg transition hover:border-black/10 hover:shadow-xl sm:w-[300px]"
            >
              <div className="relative h-44 overflow-hidden">
                <div
                  className="absolute inset-0 bg-cover bg-center bg-neutral-200 opacity-10 transition duration-500 group-hover:opacity-25"
                  style={{ backgroundImage: engine.bg ? `url(${engine.bg})` : undefined }}
                  aria-hidden="true"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-white via-white/70 to-white/50 opacity-95 transition group-hover:opacity-80" />
                <div className="relative flex h-full flex-col justify-end p-4">
                  <div className="text-sm font-semibold">{engine.name}</div>
                  <dl className="mt-1 text-xs text-neutral-500">
                    <div className="flex justify-between gap-3">
                      <dt>Max</dt>
                      <dd>{engine.maxDuration}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt>Audio</dt>
                      <dd>{engine.audio}</dd>
                    </div>
                    <div className="mt-1">
                      <dt className="sr-only">Best for</dt>
                      <dd>{engine.bestFor}</dd>
                    </div>
                  </dl>
                  <div className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-neutral-900/70 transition group-hover:translate-x-1 group-hover:text-neutral-900">
                    See presets →
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
      <style jsx>{`
        .compare-engines-scroll::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </section>
  );
}
