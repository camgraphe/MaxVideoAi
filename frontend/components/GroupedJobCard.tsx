'use client';

/* eslint-disable @next/next/no-img-element */
import clsx from 'clsx';
import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { EngineCaps } from '@/types/engines';
import type { GroupSummary } from '@/types/groups';
import { Card } from '@/components/ui/Card';
import { EngineIcon } from '@/components/ui/EngineIcon';
import { CURRENCY_LOCALE } from '@/lib/intl';
import { getAspectRatioString } from '@/lib/aspect';

export type GroupedJobAction = 'open' | 'continue' | 'refine' | 'branch' | 'compare';

function ThumbImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const baseClass = clsx('object-cover', className);
  if (src.startsWith('data:')) {
    return <img src={src} alt={alt} className={clsx('absolute inset-0 h-full w-full', baseClass)} />;
  }
  return <Image src={src} alt={alt} fill className={baseClass} />;
}

function GroupPreviewMedia({ preview }: { preview: GroupSummary['previews'][number] | undefined }) {
  if (preview?.videoUrl) {
    const poster = preview.thumbUrl ?? undefined;
    return (
      <video
        src={preview.videoUrl}
        poster={poster}
        className="absolute inset-0 h-full w-full object-cover pointer-events-none"
        muted
        playsInline
        autoPlay
        loop
      />
    );
  }
  if (preview?.thumbUrl) {
    return <ThumbImage src={preview.thumbUrl} alt="" className="absolute inset-0 pointer-events-none object-cover" />;
  }
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#dfe7ff] via-white to-[#f1f4ff] text-[10px] font-semibold uppercase tracking-micro text-text-muted pointer-events-none">
      En attente
    </div>
  );
}

export interface GroupedJobCardProps {
  group: GroupSummary;
  engine?: EngineCaps | null;
  onOpen?: (group: GroupSummary) => void;
  onAction?: (group: GroupSummary, action: GroupedJobAction) => void;
  actionMenu?: boolean;
}

export function GroupedJobCard({ group, engine, onOpen, onAction, actionMenu = true }: GroupedJobCardProps) {
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

  const heroAspectRatioStyle = getAspectRatioString(hero.aspectRatio);

  const showMenu = Boolean(onAction) && actionMenu;

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
        <div className="relative w-full" style={{ aspectRatio: heroAspectRatioStyle }}>
          <div className="absolute inset-0 grid grid-cols-2 gap-1 bg-[#E7ECF7] p-1">
            {Array.from({ length: Math.max(1, Math.min(4, group.count)) }).map((_, index) => {
              const preview = previews[index];
              const member = preview ? group.members.find((entry) => entry.id === preview.id) : undefined;
              return (
                <div key={preview?.id ?? index} className="relative overflow-hidden rounded-[10px] bg-white/80">
                  <GroupPreviewMedia preview={preview} />
                  {member && member.status !== 'completed' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/45 px-2 text-center text-[10px] text-white backdrop-blur-sm">
                      <span className="uppercase tracking-micro">Processing</span>
                      {member.message && <span className="mt-1 line-clamp-2 text-[10px] text-white/80">{member.message}</span>}
                      {typeof member.progress === 'number' && (
                        <span className="mt-1 text-[10px] font-semibold">{member.progress}%</span>
                      )}
                    </div>
                  )}
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
      <div className="flex items-center justify-between gap-3 border-t border-hairline bg-white px-3 py-2 text-sm text-text-secondary">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="inline-flex items-center gap-2 font-semibold text-text-primary">
            <EngineIcon engine={engine ?? undefined} label={hero.engineLabel} size={28} className="shrink-0" />
            <span className="truncate">{hero.engineLabel}</span>
          </span>
          <span className="text-[11px] uppercase tracking-micro text-text-muted">
            {splitModeLabel} • {splitLabel}
          </span>
        </div>
        {formattedPrice && <span className="flex-shrink-0 text-[12px] font-semibold text-text-primary">{formattedPrice}</span>}
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
        </div>
      )}
    </Card>
  );
}
