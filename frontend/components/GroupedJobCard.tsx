'use client';

/* eslint-disable @next/next/no-img-element */
import clsx from 'clsx';
import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { EngineCaps } from '@/types/engines';
import type { GroupSummary } from '@/types/groups';
import { Card } from '@/components/ui/Card';
import { EngineIcon } from '@/components/ui/EngineIcon';
import { ProcessingOverlay } from '@/components/groups/ProcessingOverlay';
import { CURRENCY_LOCALE } from '@/lib/intl';

export type GroupedJobAction = 'open' | 'continue' | 'refine' | 'branch' | 'compare' | 'remove';

function ThumbImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const baseClass = clsx('h-full w-full pointer-events-none', className);
  if (src.startsWith('data:')) {
    return <img src={src} alt={alt} className={baseClass} />;
  }
  return <Image src={src} alt={alt} fill className={baseClass} />;
}

function GroupPreviewMedia({ preview }: { preview: GroupSummary['previews'][number] | undefined }) {
  const baseClass = 'h-full w-full pointer-events-none object-contain';
  if (preview?.videoUrl) {
    const poster = preview.thumbUrl ?? undefined;
    return (
      <video
        src={preview.videoUrl}
        poster={poster}
        className={baseClass}
        muted
        playsInline
        autoPlay
        loop
        preload="metadata"
      />
    );
  }
  if (preview?.thumbUrl) {
    return <ThumbImage src={preview.thumbUrl} alt="" className="object-contain" />;
  }
  return null;
}

export interface GroupedJobCardProps {
  group: GroupSummary;
  engine?: EngineCaps | null;
  onOpen?: (group: GroupSummary) => void;
  onAction?: (group: GroupSummary, action: GroupedJobAction) => void;
  actionMenu?: boolean;
  allowRemove?: boolean;
}

export function GroupedJobCard({ group, engine, onOpen, onAction, actionMenu = true, allowRemove = true }: GroupedJobCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const hero = group.hero;
  const splitLabel = `×${group.count}`;

  useEffect(() => {
    if (!menuOpen) return undefined;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || menuButtonRef.current?.contains(target)) {
        return;
      }
      setMenuOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [menuOpen]);

  const formattedPrice = useMemo(() => {
    if (typeof group.totalPriceCents === 'number') {
      const currency = group.currency ?? hero.currency ?? 'USD';
      try {
        return new Intl.NumberFormat(CURRENCY_LOCALE, { style: 'currency', currency }).format(group.totalPriceCents / 100);
      } catch {
        return `${currency} ${(group.totalPriceCents / 100).toFixed(2)}`;
      }
    }
    if (typeof hero.priceCents === 'number') {
      const currency = hero.currency ?? group.currency ?? 'USD';
      try {
        return new Intl.NumberFormat(CURRENCY_LOCALE, { style: 'currency', currency }).format(hero.priceCents / 100);
      } catch {
        return `${currency} ${(hero.priceCents / 100).toFixed(2)}`;
      }
    }
    return null;
  }, [group.currency, group.totalPriceCents, hero.currency, hero.priceCents]);

  const previews = useMemo(() => {
    if (group.previews.length >= 4) return group.previews.slice(0, 4);
    return group.previews;
  }, [group.previews]);
  const previewCount = useMemo(() => Math.max(1, Math.min(4, group.count)), [group.count]);
  const previewGridClass = useMemo(() => {
    if (previewCount === 1) return 'grid-cols-1';
    if (previewCount === 3) return 'grid-cols-3';
    return 'grid-cols-2';
  }, [previewCount]);

  const showMenu = Boolean(onAction) && actionMenu;
  const isCurated = Boolean(hero.job?.curated);

  const handleAction = (action: GroupedJobAction) => {
    setMenuOpen(false);
    onAction?.(group, action);
  };

  const splitModeLabel = group.splitMode ? group.splitMode.charAt(0).toUpperCase() + group.splitMode.slice(1) : 'Split mode';

  return (
    <Card className="relative overflow-hidden rounded-card border border-border bg-white/90 p-0 shadow-card">
      <figure
        className="relative cursor-pointer"
        role="button"
        tabIndex={0}
        onClick={() => onOpen?.(group)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onOpen?.(group);
          }
        }}
      >
        <div className="relative w-full" style={{ aspectRatio: '16 / 9' }}>
          <div className={clsx('absolute inset-0 grid gap-1 bg-[#E7ECF7] p-1', previewGridClass)}>
            {Array.from({ length: previewCount }).map((_, index) => {
              const preview = previews[index];
              const member = preview ? group.members.find((entry) => entry.id === preview.id) : undefined;
              const memberStatus = member?.status ?? 'completed';
              const isCompleted = memberStatus === 'completed';
              const previewKey = preview?.id ? `${preview.id}-${index}` : `preview-${index}`;
              return (
                <div key={previewKey} className="relative flex items-center justify-center overflow-hidden rounded-[10px] bg-[var(--surface-2)]">
                  <div className="absolute inset-0">
                    {isCompleted ? (
                      <GroupPreviewMedia preview={preview} />
                    ) : preview?.thumbUrl ? (
                      <Image src={preview.thumbUrl} alt="" fill className="pointer-events-none object-contain" />
                    ) : null}
                  </div>
                  <div className="pointer-events-none block" style={{ width: '100%', aspectRatio: '16 / 9' }} aria-hidden />
                  {!isCompleted && member ? (
                    <ProcessingOverlay
                      className="absolute inset-0"
                      state={memberStatus === 'failed' ? 'error' : 'pending'}
                      message={member.message}
                      progress={member.progress ?? undefined}
                      tone="light"
                      tileIndex={index + 1}
                      tileCount={previewCount}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
        <div className="absolute left-3 top-3 inline-flex items-center rounded-full bg-black/65 px-2.5 py-0.5 text-[11px] font-semibold text-white shadow">
          {splitLabel}
        </div>
        {showMenu && (
          <button
            type="button"
            ref={menuButtonRef}
            onClick={(event) => {
              event.stopPropagation();
              setMenuOpen((prev) => !prev);
            }}
            className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/30 bg-black/55 text-white transition hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Group actions"
          >
            <span className="text-lg leading-none">•••</span>
          </button>
        )}
      </figure>
      <div className="flex items-center justify-between gap-3 border-t border-hairline bg-white/80 px-3 py-2 text-sm text-text-secondary">
        <div className="flex items-center gap-2">
          <EngineIcon engine={engine ?? undefined} label={hero.engineLabel} size={28} className="shrink-0" />
          <span className="text-[11px] uppercase tracking-micro text-text-muted">{splitModeLabel} • {splitLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          {isCurated ? (
            <span className="rounded-pill border border-hairline bg-bg px-2 py-0.5 text-[11px] font-semibold uppercase tracking-micro text-text-secondary">
              Sample
            </span>
          ) : null}
          {formattedPrice ? (
            <span className="flex-shrink-0 text-[12px] font-semibold text-text-primary">{formattedPrice}</span>
          ) : null}
        </div>
      </div>

      {showMenu && menuOpen && (
        <div
          ref={menuRef}
          className="absolute right-3 top-12 z-20 w-48 rounded-card border border-border bg-white p-2 text-sm text-text-secondary shadow-card"
        >
          <button
            type="button"
            onClick={() => handleAction('open')}
            className="flex w-full items-center justify-between rounded-[8px] px-2 py-1.5 text-left transition hover:bg-accentSoft/10"
          >
            <span>Open group</span>
            <span className="text-[11px] text-text-muted">↵</span>
          </button>
          <button
            type="button"
            onClick={() => handleAction('continue')}
            className="mt-1 flex w-full items-center justify-between rounded-[8px] px-2 py-1.5 text-left transition hover:bg-accentSoft/10"
          >
            <span>Continue (Hero)</span>
          </button>
          <button
            type="button"
            onClick={() => handleAction('refine')}
            className="mt-1 flex w-full items-center justify-between rounded-[8px] px-2 py-1.5 text-left transition hover:bg-accentSoft/10"
          >
            <span>Refine (Hero)</span>
          </button>
          <button
            type="button"
            onClick={() => handleAction('branch')}
            className="mt-1 flex w-full items-center justify-between rounded-[8px] px-2 py-1.5 text-left transition hover:bg-accentSoft/10"
          >
            <span>Branch</span>
          </button>
          <button
            type="button"
            onClick={() => handleAction('compare')}
            className="mt-1 flex w-full items-center justify-between rounded-[8px] px-2 py-1.5 text-left transition hover:bg-accentSoft/10"
          >
            <span>Compare</span>
          </button>
          {allowRemove && group.count <= 1 && (
            <button
              type="button"
              onClick={() => handleAction('remove')}
              className="mt-2 flex w-full items-center justify-between rounded-[8px] px-2 py-1.5 text-left text-red-600 transition hover:bg-red-50"
            >
              <span>Remove</span>
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
