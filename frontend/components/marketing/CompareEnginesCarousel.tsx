'use client';

import { useRef } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { ENGINES_MINI } from '@/content/engines';

export function CompareEnginesCarousel() {
  const containerRef = useRef<HTMLDivElement>(null);

  const scrollByCard = (direction: number) => {
    const el = containerRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>('[data-card]');
    const width = card ? card.offsetWidth + 16 : 320;
    el.scrollBy({ left: direction * width, behavior: 'smooth' });
  };

  return (
    <section aria-labelledby="compare-engines" className="mx-auto mt-20 max-w-6xl px-4 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-hairline bg-white p-6 shadow-card">
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
          {ENGINES_MINI.map((engine) => (
            <Link
              key={engine.key}
              href={engine.href}
              aria-label={`See presets for ${engine.name}`}
              data-card
              className={clsx(
                'relative w-[260px] shrink-0 snap-start overflow-hidden rounded-xl border border-hairline bg-white/70 sm:w-[300px]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white'
              )}
            >
              <div
                className="h-40 w-full bg-cover bg-center bg-neutral-200"
                style={{ backgroundImage: engine.bg ? `url(${engine.bg})` : undefined }}
                aria-hidden="true"
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/65 via-black/30 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                <div className="text-sm font-medium">{engine.name}</div>
                <dl className="mt-1 text-[11px] leading-5 opacity-90">
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
                <div className="mt-2 text-xs underline underline-offset-2">See presets</div>
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
