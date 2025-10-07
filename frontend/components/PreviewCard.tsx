'use client';

import clsx from 'clsx';
import Image from 'next/image';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { EngineCaps } from '@/types/engines';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { OverlayButton } from '@/components/ui/OverlayButton';
import type { PreflightResponse } from '@/types/engines';
import type { PriceFactorKind } from '@/components/PriceFactorsBar';
import { PriceFactorsBar } from '@/components/PriceFactorsBar';
import { CURRENCY_LOCALE } from '@/lib/intl';

interface Props {
  engine: EngineCaps;
  price: number | null;
  currency: string;
  preflight: PreflightResponse | null;
  isPricing: boolean;
  onNavigateFactor?: (kind: PriceFactorKind) => void;
  iterations?: number;
  renderPending?: boolean;
  renderProgress?: number;
  renderMessage?: string;
  renderVideoUrl?: string;
  aspectRatio?: string;
}

export function PreviewCard({ engine, price: _price, currency: _currency, preflight: _preflight, isPricing: _isPricing, onNavigateFactor: _onNavigateFactor, iterations = 1, renderPending, renderProgress = 0, renderMessage, renderVideoUrl, aspectRatio }: Props) {
  const [upscaleOpen, setUpscaleOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHoveringPreview, setIsHoveringPreview] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);

  // Price breakdown overlay state
  const [priceOpen, setPriceOpen] = useState(false);
  const priceCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const priceButtonRef = useRef<HTMLButtonElement>(null);
  const pricePopoverRef = useRef<HTMLDivElement>(null);
  const [priceAnchorRect, setPriceAnchorRect] = useState<DOMRect | null>(null);

  const updatePriceAnchorRect = useCallback(() => {
    if (!priceButtonRef.current) return;
    setPriceAnchorRect(priceButtonRef.current.getBoundingClientRect());
  }, []);

  useEffect(() => {
    function handleGlobalClick(event: MouseEvent | TouchEvent) {
      if (!upscaleOpen) return;
      if (!containerRef.current) return;
      if (containerRef.current.contains(event.target as Node)) return;
      setUpscaleOpen(false);
    }

    document.addEventListener('mousedown', handleGlobalClick);
    document.addEventListener('touchstart', handleGlobalClick);

    return () => {
      document.removeEventListener('mousedown', handleGlobalClick);
      document.removeEventListener('touchstart', handleGlobalClick);
      if (closeTimer.current) {
        clearTimeout(closeTimer.current);
      }
    };
  }, [upscaleOpen]);

  useEffect(() => {
    function handleGlobalClick(event: MouseEvent | TouchEvent) {
      if (!priceOpen) return;
      const target = event.target as Node;
      if (priceButtonRef.current?.contains(target)) return;
      if (pricePopoverRef.current?.contains(target)) return;
      setPriceOpen(false);
    }

    document.addEventListener('mousedown', handleGlobalClick);
    document.addEventListener('touchstart', handleGlobalClick);
    window.addEventListener('resize', updatePriceAnchorRect);
    window.addEventListener('scroll', updatePriceAnchorRect, true);
    return () => {
      document.removeEventListener('mousedown', handleGlobalClick);
      document.removeEventListener('touchstart', handleGlobalClick);
      window.removeEventListener('resize', updatePriceAnchorRect);
      window.removeEventListener('scroll', updatePriceAnchorRect, true);
      if (priceCloseTimer.current) clearTimeout(priceCloseTimer.current);
    };
  }, [priceOpen, updatePriceAnchorRect]);

  const openUpscale = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
    }
    setUpscaleOpen(true);
  };

  const scheduleCloseUpscale = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
    }
    closeTimer.current = setTimeout(() => setUpscaleOpen(false), 120);
  };

  const priceHoverOpen = () => {
    if (priceCloseTimer.current) clearTimeout(priceCloseTimer.current);
    updatePriceAnchorRect();
    setPriceOpen(true);
  };

  const scheduleClosePrice = () => {
    if (priceCloseTimer.current) clearTimeout(priceCloseTimer.current);
    priceCloseTimer.current = setTimeout(() => setPriceOpen(false), 120);
  };

  const formatMoney = useCallback((amount?: number | null) => {
    if (typeof amount !== 'number' || !isFinite(amount)) return '—';
    try {
      return new Intl.NumberFormat(CURRENCY_LOCALE, { style: 'currency', currency: _currency || 'USD' }).format(amount);
    } catch {
      return `${_currency || 'USD'} ${amount.toFixed(2)}`;
    }
  }, [_currency]);

  const formatSigned = useCallback(
    (amount: number) => {
      if (amount < 0) {
        return `− ${formatMoney(Math.abs(amount))}`;
      }
      return `+ ${formatMoney(amount)}`;
    },
    [formatMoney]
  );

  const aspectClass = useMemo(() => {
    if (aspectRatio === '9:16') return 'aspect-[9/16]';
    if (aspectRatio === '1:1') return 'aspect-square';
    return 'aspect-[16/9]';
  }, [aspectRatio]);

  const frameSrc = useMemo(() => {
    if (aspectRatio === '9:16') return '/assets/frames/thumb-9x16.svg';
    if (aspectRatio === '1:1') return '/assets/frames/thumb-1x1.svg';
    return '/assets/frames/poster-16x9.svg';
  }, [aspectRatio]);

  useEffect(() => {
    if (!renderVideoUrl) {
      setIsVideoPlaying(false);
      return;
    }
    setIsVideoPlaying(true);
    const el = videoRef.current;
    if (el) {
      const playPromise = el.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise.catch(() => {
          setIsVideoPlaying(false);
        });
      }
    }
  }, [renderVideoUrl]);

  const togglePlayback = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      const playPromise = el.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise
          .then(() => setIsVideoPlaying(true))
          .catch(() => setIsVideoPlaying(false));
      } else {
        setIsVideoPlaying(true);
      }
    } else {
      el.pause();
      setIsVideoPlaying(false);
    }
  }, []);

  return (
    <Card className="space-y-5 p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-[12px] font-semibold uppercase tracking-micro text-text-muted">Preview</h2>
          <p className="text-sm text-text-secondary">Preflight • {engine.label}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {_price != null && (
            <div className="relative" onMouseEnter={priceHoverOpen} onMouseLeave={scheduleClosePrice}>
              <button
                type="button"
                ref={priceButtonRef}
                className="inline-flex items-center gap-2 rounded-input border border-border bg-white px-3 py-1.5 font-semibold text-text-primary shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-expanded={priceOpen}
                aria-haspopup="dialog"
              >
                <Image src="/assets/icons/wallet.svg" alt="" width={14} height={14} />
                <span>{formatMoney(_price)}</span>
              </button>

              {priceOpen && priceAnchorRect && (
                <div
                  ref={pricePopoverRef}
                  style={{
                    position: 'fixed',
                    top: priceAnchorRect.bottom + 8,
                    left: Math.min(
                      priceAnchorRect.left,
                      window.innerWidth - 280 - 16
                    ),
                    width: 280
                  }}
                  className="z-[9999] rounded-card border border-border bg-white p-4 text-sm text-text-secondary shadow-float"
                  role="dialog"
                  aria-label="Price breakdown"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-[12px] font-semibold uppercase tracking-micro text-text-muted">Price breakdown</h3>
                    <button
                      type="button"
                      className="rounded-[8px] border border-transparent px-2 py-1 text-[11px] text-text-muted transition hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => setPriceOpen(false)}
                    >
                      Close
                    </button>
                  </div>

                  {_preflight?.itemization ? (
                    <div className="mt-3 space-y-2 text-[13px]">
                      <OptionRow label="Base" value={formatMoney(_preflight.itemization.base.subtotal)} />
                      {_preflight.itemization.addons?.map((line, idx) => (
                        <OptionRow
                          key={`addon-${idx}`}
                          label={line.type ? `Add-on: ${String(line.type)}` : 'Add-on'}
                          value={formatSigned(line.subtotal ?? 0)}
                        />
                      ))}
                      {_preflight.itemization.fees?.map((line, idx) => (
                        <OptionRow
                          key={`fee-${idx}`}
                          label={line.type ? `Fee: ${titleCase(String(line.type))}` : 'Fee'}
                          value={formatSigned(line.subtotal ?? 0)}
                        />
                      ))}
                      {_preflight.itemization.discounts?.map((line, idx) => (
                        <OptionRow
                          key={`discount-${idx}`}
                          label={line.tier ? `Discount: ${String(line.tier)}` : 'Discount'}
                          value={formatSigned(line.subtotal ?? 0)}
                        />
                      ))}
                      {_preflight.itemization.taxes?.map((line, idx) => (
                        <OptionRow
                          key={`tax-${idx}`}
                          label={line.type ? `Tax: ${String(line.type)}` : 'Tax'}
                          value={formatSigned(line.subtotal ?? 0)}
                        />
                      ))}

                      <div className="mt-3 border-t border-hairline pt-2">
                        <OptionRow label="Total" value={<span className="font-semibold text-text-primary">{formatMoney(_price ?? 0)}</span>} />
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-[13px] text-text-muted">No breakdown available.</p>
                  )}
                </div>
              )}
            </div>
          )}
          {_preflight?.pricing?.discount && (
            <Chip className="bg-accent/10 text-accent">
              Member price — you save {Math.round((_preflight.pricing.discount.percentApplied ?? 0) * 100)}%
            </Chip>
          )}
        </div>
      </header>
      <div className="mt-3">
        <PriceFactorsBar preflight={_preflight} currency={_currency} isLoading={_isPricing} onNavigate={_onNavigateFactor} iterations={iterations} />
      </div>

      <div className="relative" ref={containerRef}>
        <div className="relative overflow-hidden rounded-card border border-border bg-[#EFF3FA]">
          <div
            className="relative mx-auto h-[360px] md:h-[420px]"
            onMouseEnter={() => setIsHoveringPreview(true)}
            onMouseLeave={() => setIsHoveringPreview(false)}
          >
            <div className={clsx('relative mx-auto h-full w-auto', aspectClass)}>
              {renderVideoUrl ? (
                <video
                  ref={videoRef}
                  src={renderVideoUrl}
                  className="absolute inset-0 h-full w-full object-cover"
                  loop
                  muted
                  playsInline
                  autoPlay
                  preload="metadata"
                />
              ) : (
                <>
                  <Image
                    src="/assets/placeholders/preview-16x9.png"
                    alt="Preview placeholder"
                    fill
                    className="object-cover"
                    priority
                  />
                  <Image src={frameSrc} alt="" fill className="pointer-events-none select-none" />
                </>
              )}
            </div>
            {renderVideoUrl && (
              <div
                className={clsx(
                  'pointer-events-none absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/45 via-transparent to-transparent px-4 pb-4 transition-opacity',
                  isHoveringPreview || !isVideoPlaying ? 'opacity-100' : 'opacity-0'
                )}
              >
                <button
                  type="button"
                  onClick={togglePlayback}
                  className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-hairline bg-white/90 px-3 py-1.5 text-xs font-medium text-text-primary shadow-card backdrop-blur-sm transition hover:bg-white"
                  aria-label={isVideoPlaying ? 'Pause preview' : 'Play preview'}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/15 text-accent">
                    <Image src={isVideoPlaying ? '/assets/icons/pause.svg' : '/assets/icons/play.svg'} alt="" width={12} height={12} />
                  </span>
                  <span>{isVideoPlaying ? 'Pause' : 'Play'}</span>
                </button>
              </div>
            )}
            {!renderVideoUrl && (
              <div className="absolute inset-4 flex items-center justify-center">
                {renderPending ? (
                  <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-card border border-border bg-white/85 p-4 text-sm text-text-secondary shadow-card backdrop-blur-sm">
                    <div className="inline-flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-micro text-white">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-[#10B981]" aria-hidden />
                      Live
                    </div>
                    <div className="relative h-2 w-full overflow-hidden rounded-full bg-hairline">
                      <div className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${Math.max(5, Math.min(100, renderProgress))}%` }} />
                    </div>
                    <div className="text-[12px] text-text-muted">{renderMessage ?? 'Preparing your video…'}</div>
                  </div>
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-card border border-border bg-white/80 text-xs uppercase tracking-micro text-text-muted shadow-card backdrop-blur-sm">
                    Preview
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="absolute inset-x-4 bottom-4 flex flex-wrap gap-2 text-xs">
            {engine.aspectRatios[0] && (
              <Chip className="bg-white/85 text-text-secondary">
                AR {engine.aspectRatios[0]}
              </Chip>
            )}
            {engine.resolutions[0] && (
              <Chip className="bg-white/85 text-text-secondary">{engine.resolutions[0]}</Chip>
            )}
            {engine.fps[0] && (
              <Chip className="bg-white/85 text-text-secondary">{engine.fps[0]} fps</Chip>
            )}
            {engine.motionControls && <Chip className="bg-white/85 text-text-secondary">Motion</Chip>}
            {engine.keyframes && <Chip className="bg-white/85 text-text-secondary">Keyframes</Chip>}
          </div>
        </div>

        <div className="absolute right-4 top-4 flex flex-col gap-2">
          {engine.upscale4k && (
            <div
              onMouseEnter={openUpscale}
              onMouseLeave={scheduleCloseUpscale}
              className="relative"
            >
              <OverlayButton
                icon={<OverlayIcon src="/assets/icons/upscale.svg" alt="" />}
                label="Upscale"
                onClick={() => setUpscaleOpen((value) => !value)}
                onFocus={openUpscale}
                onBlur={scheduleCloseUpscale}
                aria-expanded={upscaleOpen}
                aria-haspopup="dialog"
              />
              {upscaleOpen && (
                <div className="absolute right-0 top-[calc(100%+8px)] w-56 rounded-card border border-border bg-white p-4 text-sm text-text-secondary shadow-float">
                  <h3 className="text-[12px] font-semibold uppercase tracking-micro text-text-muted">Upscale options</h3>
                  <dl className="mt-3 space-y-2 text-[13px]">
                    <OptionRow label="Method" value="Neural 4x" />
                    <OptionRow label="Intensity" value="Medium" />
                  </dl>
                </div>
              )}
            </div>
          )}

          {engine.audio && (
            <OverlayButton icon={<OverlayIcon src="/assets/icons/audio.svg" alt="" />} label="Audio" />
          )}
        </div>
      </div>

      <footer className="flex flex-wrap justify-between gap-3 text-xs text-text-secondary">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" aria-hidden />
          <span>Status: Preflight ✓</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionLink label="Save" icon="/assets/icons/save.svg" />
          <ActionLink label="Download" icon="/assets/icons/download.svg" />
          <ActionLink label="Copy prompt" icon="/assets/icons/remix.svg" />
          <ActionLink label="Extend" icon="/assets/icons/extend.svg" disabled={!engine.extend} />
        </div>
      </footer>
    </Card>
  );
}

function ActionLink({ label, icon, disabled }: { label: string; icon: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={clsx(
        'inline-flex items-center gap-2 rounded-input border border-transparent px-3 py-2 text-xs font-medium text-text-muted transition hover:border-border hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        disabled && 'cursor-not-allowed border-transparent text-text-muted/60 hover:border-transparent hover:text-text-muted/60'
      )}
    >
      <OverlayIcon src={icon} alt="" className="h-3.5 w-3.5" />
      <span>{label}</span>
    </button>
  );
}

function OptionRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between text-[13px] text-text-secondary">
      <span className="text-[12px] uppercase tracking-micro text-text-muted">{label}</span>
      <span className="font-medium text-text-primary">{value}</span>
    </div>
  );
}

function OverlayIcon({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return <Image src={src} alt={alt} width={16} height={16} className={clsx('h-4 w-4', className)} />;
}

function titleCase(value: string) {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
