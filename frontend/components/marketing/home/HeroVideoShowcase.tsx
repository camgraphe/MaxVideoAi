'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { ChevronRight, Maximize2, Pause, Play, Volume2 } from 'lucide-react';
import { UIIcon } from '@/components/ui/UIIcon';

export type HeroVideoShowcaseItem = {
  id: string;
  name: string;
  provider: string;
  bestFor: string;
  price: string;
  estimateLabel: string;
  estimateValue: string;
  estimateMeta: string;
  posterSrc: string;
  videoSrc?: string | null;
  duration: string;
  resolution: string;
  imageAlt: string;
};

export function HeroVideoShowcase({
  items,
  playLabel,
  pauseLabel,
  nextLabel,
}: {
  items: HeroVideoShowcaseItem[];
  playLabel: string;
  pauseLabel: string;
  nextLabel: string;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const selected = items[selectedIndex] ?? items[0];

  useEffect(() => {
    setIsPlaying(false);
    setProgress(0);
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.currentTime = 0;
      video.load();
    }
  }, [selected?.id]);

  if (!selected) return null;

  async function handlePlayToggle() {
    const video = videoRef.current;
    if (!video || !selected.videoSrc) {
      setIsPlaying((value) => !value);
      setProgress((value) => (value > 0 ? 0 : 38));
      return;
    }

    if (video.paused) {
      await video.play().catch(() => undefined);
      setIsPlaying(!video.paused);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }

  function selectEngine(index: number) {
    setSelectedIndex(index);
  }

  function selectNext() {
    setSelectedIndex((index) => (items.length ? (index + 1) % items.length : 0));
  }

  const timeLabel = progress > 0 ? '0:02' : '0:00';
  const stackItems = [
    items[(selectedIndex + 1) % items.length],
    items[(selectedIndex + 2) % items.length],
    items[(selectedIndex + 3) % items.length],
  ].filter(Boolean);
  const stackCardTransforms = [
    'translate3d(48px, 12px, -42px) rotateX(2deg) rotateY(-11deg) rotateZ(-0.65deg) scale(0.992)',
    'translate3d(94px, 22px, -84px) rotateX(2deg) rotateY(-16deg) rotateZ(-1deg) scale(0.986)',
    'translate3d(138px, 32px, -126px) rotateX(2deg) rotateY(-21deg) rotateZ(-1.35deg) scale(0.98)',
  ];

  return (
    <div className="relative mx-auto w-full max-w-[800px] overflow-visible px-0 xl:pr-[112px]">
      <div className="absolute -inset-8 rounded-[46px] bg-[radial-gradient(circle_at_62%_8%,rgba(99,102,241,0.34),transparent_32%),radial-gradient(circle_at_20%_95%,rgba(14,165,233,0.20),transparent_34%)] blur-2xl" />

      <div className="relative overflow-visible [perspective:760px] [transform-style:preserve-3d]">
        {stackItems.map((item, index) => (
          <div
            key={`${item.id}-stack`}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 hidden overflow-hidden rounded-[28px] border border-white/18 bg-[#070b14] shadow-[0_38px_96px_-48px_rgba(15,23,42,0.95)] xl:block"
            style={{
              transform: stackCardTransforms[index],
              transformOrigin: 'center center',
              transformStyle: 'preserve-3d',
            }}
          >
            <Image
              src={item.posterSrc}
              alt=""
              fill
              sizes="660px"
              className="object-cover opacity-95"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,7,18,0.08),rgba(3,7,18,0.52)),linear-gradient(180deg,rgba(3,7,18,0.10),rgba(3,7,18,0.72))]" />
            <div className="absolute right-4 top-4 rounded-[12px] border border-white/14 bg-black/36 px-3 py-2 text-right text-white backdrop-blur-md">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/72">{item.name}</p>
              <p className="mt-1 text-sm font-semibold">{item.price}</p>
            </div>
          </div>
        ))}

      <div
        data-hero-player="main"
        className="relative z-10 overflow-hidden rounded-[28px] border border-white/24 bg-[#070b14] shadow-[0_36px_104px_-44px_rgba(15,23,42,0.95)]"
        style={{
          transform: 'translateZ(64px) rotateX(2deg) rotateY(-8.8deg) rotateZ(-0.8deg)',
          transformOrigin: 'center center',
          transformStyle: 'preserve-3d',
        }}
      >
        <div className="relative overflow-hidden bg-[#050912]" style={{ aspectRatio: '1.42 / 1' }}>
          {selected.videoSrc ? (
            <video
              ref={videoRef}
              key={selected.id}
              className="absolute inset-0 h-full w-full object-cover"
              poster={selected.posterSrc}
              preload="none"
              muted
              playsInline
              loop
              onPause={() => setIsPlaying(false)}
              onPlay={() => setIsPlaying(true)}
              onTimeUpdate={(event) => {
                const video = event.currentTarget;
                if (video.duration && Number.isFinite(video.duration)) {
                  setProgress(Math.min(100, (video.currentTime / video.duration) * 100));
                }
              }}
            >
              <source src={selected.videoSrc} type="video/mp4" />
            </video>
          ) : (
            <Image
              src={selected.posterSrc}
              alt={selected.imageAlt}
              fill
              priority
              sizes="(max-width: 1023px) 100vw, 660px"
              className="object-cover"
            />
          )}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,7,18,0.34)_0%,rgba(3,7,18,0.04)_38%,rgba(3,7,18,0.72)_100%)]" />

          <div className="absolute left-5 top-5 text-white sm:left-6 sm:top-6">
            <p className="text-lg font-semibold leading-none tracking-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.72)]">
              {selected.name}
            </p>
            <p className="mt-2 text-sm font-medium text-white/86 drop-shadow-[0_2px_10px_rgba(0,0,0,0.72)]">{selected.price}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-black/36 px-2.5 py-1 text-[11px] font-semibold text-white/88 backdrop-blur-md">
                {selected.bestFor}
              </span>
              <span className="rounded-full bg-black/36 px-2.5 py-1 text-[11px] font-semibold text-white/88 backdrop-blur-md">
                {selected.provider}
              </span>
            </div>
          </div>

          <div className="absolute right-4 top-4 min-w-[124px] rounded-[16px] border border-white/18 bg-black/52 px-3.5 py-3 text-left text-white shadow-[0_18px_48px_-24px_rgba(0,0,0,0.95)] backdrop-blur-lg sm:right-6 sm:top-6 sm:min-w-[142px]">
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/68">{selected.estimateLabel}</p>
            <p className="mt-1 flex items-end gap-1.5 text-2xl font-semibold leading-none tracking-tight sm:text-[28px]">
              {selected.estimateValue}
              <span className="pb-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white/74">USD</span>
            </p>
            <p className="mt-1.5 text-[10px] font-medium leading-tight text-white/78 sm:text-[11px]">{selected.estimateMeta}</p>
          </div>

          <button
            type="button"
            aria-label={isPlaying ? pauseLabel : playLabel}
            aria-pressed={isPlaying}
            onClick={handlePlayToggle}
            className="absolute left-1/2 top-1/2 inline-flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/75 bg-white/94 text-[#161a2d] shadow-[0_18px_46px_-18px_rgba(0,0,0,0.88)] backdrop-blur-md transition hover:scale-105 hover:bg-white focus:outline-none focus:ring-2 focus:ring-white/90 focus:ring-offset-2 focus:ring-offset-[#070b14]"
          >
            <UIIcon icon={isPlaying ? Pause : Play} size={28} />
          </button>

          <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.72))] px-3 pb-3 pt-9 text-white sm:px-5">
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label={isPlaying ? pauseLabel : playLabel}
                onClick={handlePlayToggle}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/80"
              >
                <UIIcon icon={isPlaying ? Pause : Play} size={20} />
              </button>
              <span className="min-w-[72px] text-xs font-semibold text-white/85">
                {timeLabel} / {selected.duration}
              </span>
              <div
                className="h-1.5 min-w-[88px] flex-1 overflow-hidden rounded-full bg-white/13"
                role="progressbar"
                aria-label={`${selected.name} preview progress`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress)}
              >
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#6d5dfc,#9d8cff)] transition-[width] duration-300"
                  style={{ width: `${Math.max(12, progress)}%` }}
                />
              </div>
              <span className="hidden rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white sm:inline-flex">
                {selected.resolution}
              </span>
              <button
                type="button"
                aria-label="Muted preview"
                className="hidden h-9 w-9 items-center justify-center rounded-full text-white/90 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/80 sm:inline-flex"
              >
                <UIIcon icon={Volume2} size={18} />
              </button>
              <button
                type="button"
                aria-label="Fullscreen preview"
                className="hidden h-9 w-9 items-center justify-center rounded-full text-white/90 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/80 sm:inline-flex"
              >
                <UIIcon icon={Maximize2} size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>

      <div className="relative z-20 mt-4">
        <div className="grid grid-cols-3 gap-2.5 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
          {items.map((item, index) => {
            const selectedThumb = index === selectedIndex;
            return (
              <button
                key={item.id}
                type="button"
                aria-label={`${playLabel}: ${item.name}`}
                aria-pressed={selectedThumb}
                onClick={() => selectEngine(index)}
                className={
                  selectedThumb
                    ? 'relative aspect-[11/12] min-w-0 overflow-hidden rounded-[15px] border border-[#6d5dfc] bg-[#070b14] shadow-[0_0_0_2px_rgba(109,93,252,0.28),0_20px_38px_-24px_rgba(29,32,88,0.78)] focus:outline-none focus:ring-2 focus:ring-brand/60 sm:h-[104px] sm:w-[96px] xl:h-[108px] xl:w-[100px]'
                    : 'relative aspect-[11/12] min-w-0 overflow-hidden rounded-[15px] border border-white/70 bg-[#070b14] shadow-[0_14px_30px_-28px_rgba(15,23,42,0.72)] transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-[0_16px_34px_-28px_rgba(79,70,229,0.58)] focus:outline-none focus:ring-2 focus:ring-brand/50 sm:h-[104px] sm:w-[96px] xl:h-[108px] xl:w-[100px] dark:border-white/14'
                }
              >
                <Image
                  src={item.posterSrc}
                  alt={item.imageAlt}
                  fill
                  sizes="(max-width: 639px) 50vw, 100px"
                  className="object-cover"
                  loading="eager"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/86 via-black/10 to-transparent" />
                <span className="absolute bottom-8 left-2.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/92 text-[#151827]">
                  <UIIcon icon={Play} size={10} />
                </span>
                <span className="absolute bottom-2.5 left-2.5 right-2 truncate text-left text-[11px] font-semibold leading-tight text-white">
                  {item.name}
                </span>
                {selectedThumb ? <span className="absolute bottom-3 right-2.5 h-2 w-2 rounded-full bg-white" /> : null}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          aria-label={nextLabel}
          onClick={selectNext}
          className="absolute right-2 top-1/2 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-hairline bg-surface/95 text-brand shadow-card backdrop-blur transition hover:border-brand/30 hover:bg-brand/5 focus:outline-none focus:ring-2 focus:ring-brand/50 2xl:grid"
        >
          <UIIcon icon={ChevronRight} size={18} />
        </button>
      </div>
    </div>
  );
}
