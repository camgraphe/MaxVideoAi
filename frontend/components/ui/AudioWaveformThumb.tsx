'use client';

/* eslint-disable @next/next/no-img-element */
import clsx from 'clsx';
import Image from 'next/image';
import { useMemo } from 'react';

function buildWaveformBars(seed: string, count = 36): number[] {
  let state = 0;
  for (let index = 0; index < seed.length; index += 1) {
    state = (state * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return Array.from({ length: count }, (_, index) => {
    state = (state * 1664525 + 1013904223 + index) >>> 0;
    const normalized = ((state >>> 8) % 1000) / 1000;
    return 0.18 + normalized * 0.82;
  });
}

function ThumbImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const baseClass = clsx('h-full w-full pointer-events-none', className);
  if (src.startsWith('data:')) {
    return <img src={src} alt={alt} className={baseClass} />;
  }
  return <Image src={src} alt={alt} fill className={baseClass} />;
}

export function AudioWaveformThumb({
  seed,
  thumbSrc,
  label,
  active,
  className,
}: {
  seed: string;
  thumbSrc?: string | null;
  label?: string | null;
  active: boolean;
  className?: string;
}) {
  const bars = useMemo(() => buildWaveformBars(seed), [seed]);

  return (
    <div className={clsx('relative h-full w-full overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.22),_rgba(15,23,42,0.96)_62%)]', className)}>
      {thumbSrc ? (
        <>
          <ThumbImage src={thumbSrc} alt="" className="object-cover opacity-25 blur-[1px] saturate-[0.85]" />
          <div className="absolute inset-0 bg-slate-950/60" />
        </>
      ) : null}
      <div className="absolute inset-x-0 bottom-0 top-0 flex items-center justify-center px-4">
        <div className="flex h-[48%] w-full items-end justify-between gap-[3px]">
          {bars.map((height, index) => (
            <span
              key={`${seed}-${index}`}
              className={clsx(
                'min-w-0 flex-1 rounded-full bg-white/75 transition-all duration-200 ease-out',
                active ? 'bg-white/90 shadow-[0_0_10px_rgba(255,255,255,0.18)]' : ''
              )}
              style={{
                height: `${Math.max(16, Math.round(height * 100))}%`,
                opacity: active ? 0.92 : 0.68,
              }}
            />
          ))}
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-950 via-slate-950/45 to-transparent" />
      {label ? (
        <div className="absolute inset-x-0 bottom-0 px-3 pb-2">
          <span className="inline-flex max-w-full items-center rounded-full border border-white/12 bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/82 backdrop-blur-sm">
            {label}
          </span>
        </div>
      ) : null}
    </div>
  );
}
