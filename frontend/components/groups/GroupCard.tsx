'use client';

import clsx from 'clsx';
import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { EngineCaps } from '@/types/engines';
import type { VideoGroup, VideoItem } from '@/types/video-groups';
import { EngineIcon } from '@/components/ui/EngineIcon';
import { CURRENCY_LOCALE } from '@/lib/intl';

export type GroupCardAction = 'open' | 'continue' | 'refine' | 'branch' | 'compare' | 'remove';

interface GroupCardProps {
  group: VideoGroup;
  engine?: EngineCaps | null;
  onOpen?: (group: VideoGroup) => void;
  onAction?: (group: VideoGroup, action: GroupCardAction) => void;
  allowRemove?: boolean;
  showActions?: boolean;
}

const LAYOUT_SLOTS: Record<VideoGroup['layout'], number> = {
  x1: 1,
  x2: 2,
  x3: 4,
  x4: 4,
};

function isVideo(item: VideoItem): boolean {
  const mediaType = typeof item.meta?.mediaType === 'string' ? String(item.meta.mediaType).toLowerCase() : null;
  if (mediaType === 'video') return true;
  if (mediaType === 'image') return false;
  const url = item.url.toLowerCase();
  return url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.mov');
}

function GroupMedia({ item, autoPlay = true }: { item: VideoItem; autoPlay?: boolean }) {
  const video = isVideo(item);
  if (video) {
    return (
      <video
        data-group-video
        src={item.url}
        poster={item.thumb}
        className="h-full w-full object-contain"
        muted
        playsInline
        preload="metadata"
        loop
        autoPlay={autoPlay}
      />
    );
  }
  if (item.thumb) {
    return <Image src={item.thumb} alt="" fill className="object-contain" />;
  }
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#e5ebf6] via-white to-[#f1f4ff] text-[11px] uppercase tracking-micro text-text-muted">
      Media
    </div>
  );
}

function formatCost(amount?: number, currency?: string | null): string | null {
  if (typeof amount !== 'number') return null;
  const currencyCode = currency ?? 'USD';
  try {
    return new Intl.NumberFormat(CURRENCY_LOCALE, { style: 'currency', currency: currencyCode }).format(amount / 100);
  } catch {
    return `${currencyCode} ${(amount / 100).toFixed(2)}`;
  }
}

export function GroupCard({
  group,
  engine,
  onOpen,
  onAction,
  allowRemove = false,
  showActions = true,
}: GroupCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

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

  const slots = useMemo(() => {
    const desired = LAYOUT_SLOTS[group.layout] ?? 1;
    const items = group.items.slice(0, desired);
    const result: Array<VideoItem | null> = [...items];
    while (result.length < desired) {
      result.push(null);
    }
    if (group.layout === 'x3' && result.length === 4 && result[3] !== null && !result[2]) {
      result[3] = null;
    }
    return result;
  }, [group.items, group.layout]);

  const gridClass = useMemo(() => {
    switch (group.layout) {
      case 'x2':
        return 'grid-cols-2';
      case 'x3':
        return 'md:grid-cols-2';
      case 'x4':
        return 'grid-cols-2';
      default:
        return 'grid-cols-1';
    }
  }, [group.layout]);

  const splitLabel = useMemo(() => {
    switch (group.layout) {
      case 'x1':
        return '×1';
      case 'x2':
        return '×2';
      case 'x3':
        return '×3';
      case 'x4':
        return '×4';
      default:
        return `×${group.items.length}`;
    }
  }, [group.layout, group.items.length]);

  const formattedCost = useMemo(
    () => formatCost(group.totalCostCents, group.currency ?? (typeof group.items[0]?.meta?.currency === 'string' ? String(group.items[0]?.meta?.currency) : undefined)),
    [group.totalCostCents, group.currency, group.items]
  );

  const providerLabel = group.provider === 'fal' ? 'Live' : 'Test';

  const handleAction = (action: GroupCardAction) => {
    setMenuOpen(false);
    onAction?.(group, action);
  };

  const showGroupOverlay = group.status === 'loading' || group.status === 'error';

  const engineLabel = String(group.paramsSnapshot?.engineLabel ?? engine?.label ?? '').trim() || undefined;
  const promptLabel = group.paramsSnapshot?.prompt ? String(group.paramsSnapshot.prompt) : undefined;

  return (
    <article className="relative overflow-hidden rounded-card border border-border bg-white/90 shadow-card">
      <figure
        role="button"
        tabIndex={0}
        className="relative cursor-pointer"
        onClick={() => onOpen?.(group)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onOpen?.(group);
          }
        }}
      >
        <div className="relative w-full" style={{ aspectRatio: '16 / 9' }}>
          <div className={clsx('absolute inset-0 grid gap-[6px] bg-[#E7ECF7] p-[6px]', gridClass)}>
            {slots.map((item, index) => {
              const itemStatusRaw = typeof item?.meta?.status === 'string' ? String(item.meta.status).toLowerCase() : null;
              const itemStatus: 'pending' | 'completed' | 'failed' | 'unknown' = (() => {
                if (!item) return 'unknown';
                if (itemStatusRaw === 'completed' || itemStatusRaw === 'ready') return 'completed';
                if (itemStatusRaw === 'failed') return 'failed';
                if (itemStatusRaw === 'pending') return 'pending';
                if (item.url) return 'completed';
                if (group.status === 'error') return 'failed';
                if (group.status === 'loading') return 'pending';
                return 'unknown';
              })();
              const itemProgress = typeof item?.meta?.progress === 'number' ? Math.max(0, Math.min(100, Math.round(item.meta.progress as number))) : undefined;
              const itemMessage = typeof item?.meta?.message === 'string' ? (item.meta.message as string) : undefined;
              const showItemOverlay = !showGroupOverlay && item && (itemStatus === 'pending' || (itemStatus === 'unknown' && !item.url));

              return (
                <div
                  key={item?.id ?? `slot-${group.id}-${index}`}
                  className="relative flex items-center justify-center overflow-hidden rounded-[12px] bg-[var(--surface-2)]"
                >
                  {item ? <GroupMedia item={item} autoPlay /> : null}
                  {showGroupOverlay && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/45 px-3 text-center text-[11px] text-white backdrop-blur-sm">
                      <span className="uppercase tracking-micro">
                        {group.status === 'loading' ? 'Processing…' : group.status === 'error' ? 'Error' : 'Pending'}
                      </span>
                      {group.errorMsg ? <span className="mt-1 line-clamp-2 text-white/80">{group.errorMsg}</span> : null}
                    </div>
                  )}
                  {showItemOverlay && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/45 px-3 text-center text-[11px] text-white backdrop-blur-sm">
                      <span className="uppercase tracking-micro">Processing…</span>
                      {itemMessage ? <span className="mt-1 line-clamp-2 text-white/80">{itemMessage}</span> : null}
                      {typeof itemProgress === 'number' ? (
                        <span className="mt-1 text-[12px] font-semibold">{itemProgress}%</span>
                      ) : null}
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
        {showActions && onAction ? (
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
        ) : null}
      </figure>

      <footer className="flex items-center justify-between gap-3 border-t border-hairline bg-white/85 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <EngineIcon engine={engine ?? undefined} label={engineLabel} size={28} className="shrink-0" />
          <div className="flex min-w-0 flex-col">
            <span className="text-[11px] uppercase tracking-micro text-text-muted">
              {providerLabel} • {splitLabel}
            </span>
            {promptLabel ? <span className="line-clamp-1 text-[12px] text-text-secondary">{promptLabel}</span> : null}
          </div>
        </div>
        {formattedCost ? <span className="flex-shrink-0 text-[12px] font-semibold text-text-primary">{formattedCost}</span> : null}
      </footer>

      {showActions && menuOpen && onAction ? (
        <div
          ref={menuRef}
          className="absolute right-3 top-12 z-20 w-48 rounded-card border border-border bg-white p-2 text-sm text-text-secondary shadow-card"
        >
          <button
            type="button"
            onClick={() => handleAction('open')}
            className="flex w-full items-center justify-between rounded-[8px] px-2 py-1.5 text-left transition hover:bg-accentSoft/10"
          >
            <span>Open</span>
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
          {allowRemove ? (
            <button
              type="button"
              onClick={() => handleAction('remove')}
              className="mt-2 flex w-full items-center justify-between rounded-[8px] px-2 py-1.5 text-left text-red-600 transition hover:bg-red-50"
            >
              <span>Remove</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
