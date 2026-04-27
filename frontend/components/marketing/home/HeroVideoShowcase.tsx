'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { Maximize2, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { Link, type LocalizedLinkHref } from '@/i18n/navigation';
import { UIIcon } from '@/components/ui/UIIcon';

export type HeroVideoShowcaseItem = {
  id: string;
  engineId?: string;
  name: string;
  provider: string;
  bestFor: string;
  chips?: string[];
  mediaInfo?: string;
  price: string;
  estimateLabel: string;
  estimateValue: string;
  estimateMeta: string;
  priceNote?: string;
  examplesHref?: LocalizedLinkHref;
  modelHref?: LocalizedLinkHref;
  examplesLabel?: string;
  modelLabel?: string;
  posterSrc: string;
  videoSrc?: string | null;
  duration: string;
  resolution: string;
  imageAlt: string;
};

function parsePriceAmount(value?: string | null) {
  if (!value) return null;
  const match = value.match(/([$€£])?\s*([0-9]+(?:[.,][0-9]+)?)/);
  if (!match) return null;
  const amount = Number(match[2].replace(',', '.'));
  if (!Number.isFinite(amount)) return null;
  return { amount, symbol: match[1] ?? '$' };
}

function parseDurationSeconds(value?: string | null) {
  if (!value) return null;
  const clock = value.match(/(\d+):(\d{2})/);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  const seconds = value.match(/(\d+(?:[.,]\d+)?)\s*s\b/i);
  if (seconds) {
    const parsed = Number(seconds[1].replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatPlaybackTime(seconds: number) {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const remaining = String(safeSeconds % 60).padStart(2, '0');
  return `${minutes}:${remaining}`;
}

function buildRatePerSecondLabel(selected: HeroVideoShowcaseItem, primaryPrice: string, fallbackPrice: string | null) {
  const durationSeconds = parseDurationSeconds(selected.duration) ?? parseDurationSeconds(selected.estimateMeta);
  const total = parsePriceAmount(primaryPrice);
  if (durationSeconds && durationSeconds > 0 && total) {
    return `${total.symbol}${(total.amount / durationSeconds).toFixed(2)}/sec`;
  }

  const rateSource = selected.priceNote ?? fallbackPrice ?? selected.price;
  const rateAmount = parsePriceAmount(rateSource);
  const rateDurationSeconds = parseDurationSeconds(rateSource);
  if (rateAmount && rateDurationSeconds && rateDurationSeconds > 0) {
    return `${rateAmount.symbol}${(rateAmount.amount / rateDurationSeconds).toFixed(2)}/sec`;
  }
  return null;
}

function getDurationShortLabel(value: string) {
  const seconds = parseDurationSeconds(value);
  return seconds ? `${seconds}s` : value;
}

export function HeroVideoShowcase({
  items,
  playLabel,
  pauseLabel,
}: {
  items: HeroVideoShowcaseItem[];
  playLabel: string;
  pauseLabel: string;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasUserPaused, setHasUserPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const selected = items[selectedIndex] ?? items[0];

  useEffect(() => {
    let cancelled = false;

    setHasUserPaused(false);
    setIsMuted(true);
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
    const video = videoRef.current;
    if (!video || !selected?.videoSrc) {
      return () => {
        cancelled = true;
      };
    }

    video.pause();
    video.currentTime = 0;
    video.muted = true;
    video.load();
    video
      .play()
      .then(() => {
        if (!cancelled) setIsPlaying(!video.paused);
      })
      .catch(() => {
        if (!cancelled) setIsPlaying(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selected?.id, selected?.videoSrc]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.muted = isMuted;
  }, [isMuted, selected?.id]);

  if (!selected) return null;

  const primaryPrice = selected.estimateValue || selected.price;
  const ratePrice = selected.price && selected.price !== primaryPrice ? selected.price : null;
  const [modeLabel, , formatLabelFromMedia] = (selected.mediaInfo ?? '').split(' · ');
  const quoteRenderMeta = [getDurationShortLabel(selected.duration), modeLabel?.toLowerCase(), formatLabelFromMedia ?? selected.resolution]
    .filter(Boolean)
    .join(' · ');
  const ratePerSecond = buildRatePerSecondLabel(selected, primaryPrice, ratePrice);

  async function handlePlayToggle() {
    const video = videoRef.current;
    if (!video || !selected.videoSrc) {
      setIsPlaying((value) => {
        const next = !value;
        setHasUserPaused(!next);
        return next;
      });
      setProgress((value) => (value > 0 ? 0 : 38));
      return;
    }

    if (video.paused) {
      await video.play().catch(() => undefined);
      setIsPlaying(!video.paused);
      if (!video.paused) setHasUserPaused(false);
    } else {
      video.pause();
      setIsPlaying(false);
      setHasUserPaused(true);
    }
  }

  function handleMuteToggle() {
    setIsMuted((value) => !value);
  }

  function selectEngine(index: number) {
    setSelectedIndex(index);
  }

  const timeLabel = formatPlaybackTime(currentTime);

  return (
    <div className="relative mx-auto w-full max-w-[710px] overflow-visible px-0 xl:mr-0">
      <div className="absolute -inset-5 rounded-[38px] bg-[radial-gradient(circle_at_58%_10%,rgba(17,24,39,0.14),transparent_34%),radial-gradient(circle_at_38%_92%,rgba(120,113,108,0.10),transparent_36%)] blur-2xl dark:bg-[radial-gradient(circle_at_58%_10%,rgba(255,255,255,0.09),transparent_34%),radial-gradient(circle_at_38%_92%,rgba(148,163,184,0.10),transparent_36%)]" />
      <div className="relative">
        <div
          data-hero-player="main"
          className="relative z-10 overflow-hidden rounded-[22px] border border-white/24 bg-[#070b14] shadow-[0_30px_86px_-44px_rgba(15,23,42,0.95)]"
        >
          <div className="relative overflow-hidden bg-[#050912]" style={{ aspectRatio: '1.62 / 1' }}>
          {selected.videoSrc ? (
            <video
              ref={videoRef}
              key={selected.id}
              className="absolute inset-0 h-full w-full object-cover"
              poster={selected.posterSrc}
              preload="metadata"
              autoPlay
              muted={isMuted}
              playsInline
              loop
              onPause={() => setIsPlaying(false)}
              onPlay={() => setIsPlaying(true)}
              onTimeUpdate={(event) => {
                const video = event.currentTarget;
                setCurrentTime(video.currentTime);
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
              sizes="(max-width: 767px) 100vw, (max-width: 1399px) 52vw, 710px"
              className="object-cover"
            />
          )}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,7,18,0.34)_0%,rgba(3,7,18,0.04)_38%,rgba(3,7,18,0.72)_100%)]" />

          <div className="absolute left-5 top-5 max-w-[58%] text-white sm:left-7 sm:top-7">
            <p className="text-xl font-semibold leading-none tracking-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.72)]">
              {selected.name}
            </p>
            <p className="mt-2 text-sm font-medium text-white/86 drop-shadow-[0_2px_10px_rgba(0,0,0,0.72)]">
              {selected.mediaInfo ?? `${selected.provider} · ${selected.bestFor}`}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(selected.chips?.length ? selected.chips : [selected.bestFor, selected.provider]).slice(0, 3).map((chip) => (
                <span key={chip} className="rounded-full bg-black/36 px-2.5 py-1 text-[11px] font-semibold text-white/88 backdrop-blur-md">
                  {chip}
                </span>
              ))}
            </div>
          </div>

          <div className="absolute right-4 top-4 min-w-[124px] rounded-[16px] border border-white/18 bg-black/50 px-3.5 py-3 text-left text-white shadow-[0_18px_48px_-24px_rgba(0,0,0,0.95)] backdrop-blur-lg sm:right-6 sm:top-6 sm:min-w-[142px]">
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/68">{selected.estimateLabel}</p>
            <p className="mt-1 text-2xl font-semibold leading-none tracking-tight sm:text-[28px]">
              {primaryPrice}
            </p>
            <p className="mt-1.5 text-[10px] font-medium leading-tight text-white/78 sm:text-[11px]">{quoteRenderMeta}</p>
            {ratePerSecond ? <p className="mt-1.5 text-[10px] font-semibold leading-tight text-white/84 sm:text-[11px]">{ratePerSecond}</p> : null}
          </div>

          {hasUserPaused ? (
            <button
              type="button"
              aria-label={playLabel}
              aria-pressed={false}
              onClick={handlePlayToggle}
              className="absolute left-1/2 top-1/2 inline-flex h-[72px] w-[72px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/75 bg-white/94 text-[#161a2d] shadow-[0_18px_46px_-18px_rgba(0,0,0,0.88)] backdrop-blur-md transition hover:scale-105 hover:bg-white focus:outline-none focus:ring-2 focus:ring-white/90 focus:ring-offset-2 focus:ring-offset-[#070b14]"
            >
              <UIIcon icon={Play} size={28} />
            </button>
          ) : null}

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
                  className="h-full rounded-full bg-[linear-gradient(90deg,rgba(255,255,255,0.88),rgba(229,231,235,0.98))] transition-[width] duration-300"
                  style={{ width: `${Math.max(12, progress)}%` }}
                />
              </div>
              <span className="hidden rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white sm:inline-flex">
                {selected.resolution}
              </span>
              <button
                type="button"
                aria-label={isMuted ? 'Turn preview sound on' : 'Turn preview sound off'}
                aria-pressed={!isMuted}
                onClick={handleMuteToggle}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white/90 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/80"
              >
                <UIIcon icon={isMuted ? VolumeX : Volume2} size={18} />
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

      <div className="relative z-20 mt-4">
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5">
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
                    ? 'relative aspect-[0.9] min-w-0 overflow-hidden rounded-[13px] border border-white/90 bg-[#070b14] shadow-[0_0_0_2px_rgba(17,24,39,0.24),0_18px_34px_-24px_rgba(3,7,18,0.76)] focus:outline-none focus:ring-2 focus:ring-slate-400/70 dark:border-white/70 dark:shadow-[0_0_0_2px_rgba(255,255,255,0.20),0_18px_34px_-24px_rgba(0,0,0,0.9)]'
                    : 'relative aspect-[0.9] min-w-0 overflow-hidden rounded-[13px] border border-white/70 bg-[#070b14] shadow-[0_12px_26px_-24px_rgba(15,23,42,0.7)] transition hover:-translate-y-0.5 hover:border-white/90 hover:shadow-[0_14px_30px_-24px_rgba(3,7,18,0.6)] focus:outline-none focus:ring-2 focus:ring-slate-400/60 dark:border-white/14'
                }
              >
                <Image
                  src={item.posterSrc}
                  alt={item.imageAlt}
                  fill
                  sizes="(max-width: 639px) 33vw, 118px"
                  className="object-cover"
                  loading="eager"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/86 via-black/10 to-transparent" />
                <span className="absolute bottom-7 left-2.5 inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-white/92 text-[#151827]">
                  <UIIcon icon={Play} size={10} />
                </span>
                <span className="absolute bottom-2 left-2.5 right-2 truncate text-left text-[10.5px] font-semibold leading-tight text-white">
                  {item.name}
                </span>
                {selectedThumb ? <span className="absolute bottom-3 right-2.5 h-2 w-2 rounded-full bg-white" /> : null}
              </button>
            );
          })}
        </div>
        {(selected.examplesHref || selected.modelHref) ? (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-sm font-semibold">
            {selected.examplesHref ? (
              <Link
                href={selected.examplesHref}
                className="inline-flex items-center gap-1 rounded-full border border-white/70 bg-white/90 px-3 py-1.5 text-text-primary shadow-[0_12px_30px_-22px_rgba(15,23,42,0.55)] transition hover:border-text-muted hover:bg-white dark:border-white/12 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
              >
                {selected.examplesLabel ?? `View ${selected.name} examples`}
                <span aria-hidden="true">→</span>
              </Link>
            ) : null}
            {selected.modelHref ? (
              <Link
                href={selected.modelHref}
                className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-text-secondary transition hover:text-text-primary"
              >
                {selected.modelLabel ?? `Open ${selected.name} model`}
                <span aria-hidden="true">→</span>
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
      </div>
    </div>
  );
}
