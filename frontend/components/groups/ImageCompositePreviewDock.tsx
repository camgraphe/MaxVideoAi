'use client';

/* eslint-disable @next/next/no-img-element */

import clsx from 'clsx';
import { Copy, Download, ExternalLink, Minus, Plus } from 'lucide-react';
import { UIIcon } from '@/components/ui/UIIcon';
import { resolveCssAspectRatio } from '@/lib/aspect';
import { useI18n } from '@/lib/i18n/I18nProvider';

type PreviewImage = {
  url: string;
  width?: number | null;
  height?: number | null;
};

export type ImageCompositePreviewEntry = {
  id: string;
  engineLabel: string;
  prompt: string;
  createdAt: number;
  mode?: 't2i' | 'i2i' | string;
  aspectRatio?: string | null;
  images: PreviewImage[];
};

interface ImageCompositePreviewDockProps {
  entry: ImageCompositePreviewEntry | null;
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  onOpenModal?: () => void;
  onDownload?: (url: string) => void;
  onCopyLink?: (url: string) => void;
  onAddToLibrary?: (url: string) => void;
  onRemoveFromLibrary?: () => void;
  isInLibrary?: boolean;
  isSavingToLibrary?: boolean;
  isRemovingFromLibrary?: boolean;
  copiedUrl?: string | null;
}

const ICON_BUTTON_BASE =
  'flex h-10 w-10 items-center justify-center rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export function ImageCompositePreviewDock({
  entry,
  selectedIndex,
  onSelectIndex,
  onOpenModal,
  onDownload,
  onCopyLink,
  onAddToLibrary,
  onRemoveFromLibrary,
  isInLibrary = false,
  isSavingToLibrary = false,
  isRemovingFromLibrary = false,
  copiedUrl,
}: ImageCompositePreviewDockProps) {
  const { t } = useI18n();
  const title = t('workspace.generate.preview.title', 'Composite Preview');
  const empty = t('workspace.generate.preview.empty', 'Select a take to preview');
  const copyLabel = t('workspace.image.preview.copyLink', 'Copy link');
  const copiedLabel = t('workspace.image.preview.copied', 'Copied');
  const downloadLabel = t('workspace.image.preview.download', 'Download');
  const modalLabel = t('workspace.image.preview.openModal', 'Open modal');
  const addToLibraryLabel = t('workspace.jobs.actions.addToLibrary', 'Add to Library');
  const removeFromLibraryLabel = t('workspace.jobs.actions.removeFromLibrary', 'Remove from Library');
  const savingLabel = t('workspace.jobs.actions.saving', 'Saving…');
  const removingLabel = t('workspace.jobs.actions.removing', 'Removing…');

  const images = entry?.images ?? [];
  const safeIndex = Math.min(Math.max(0, selectedIndex), Math.max(0, images.length - 1));
  const selected = images.length ? images[safeIndex] : null;
  const aspectRatioCss = resolveCssAspectRatio({
    value: entry?.aspectRatio ?? null,
    width: selected?.width ?? null,
    height: selected?.height ?? null,
    fallback: '1 / 1',
  });

  const canOpenModal = Boolean(entry && images.length && onOpenModal);
  const canDownload = Boolean(selected?.url && onDownload);
  const canCopy = Boolean(selected?.url && onCopyLink);
  const canAddToLibrary = Boolean(selected?.url && onAddToLibrary) && !isSavingToLibrary && !isRemovingFromLibrary && !isInLibrary;
  const canRemoveFromLibrary = Boolean(onRemoveFromLibrary) && !isSavingToLibrary && !isRemovingFromLibrary && isInLibrary;

  return (
    <section className="overflow-hidden rounded-card border border-border bg-white/80 shadow-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
          <p className="text-xs text-text-muted">{images.length ? `${images.length} variant${images.length === 1 ? '' : 's'}` : empty}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isInLibrary ? (
            <button
              type="button"
              onClick={onRemoveFromLibrary}
              disabled={!canRemoveFromLibrary}
              className={clsx(
                'inline-flex items-center gap-2 rounded-full border border-border bg-state-warning/10 px-3 py-1 text-xs font-semibold uppercase tracking-micro text-state-warning transition hover:bg-state-warning/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                !canRemoveFromLibrary ? 'cursor-not-allowed opacity-50' : null
              )}
              aria-label={removeFromLibraryLabel}
            >
              <UIIcon icon={Minus} size={16} />
              <span>{isRemovingFromLibrary ? removingLabel : removeFromLibraryLabel}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => (selected?.url && onAddToLibrary ? onAddToLibrary(selected.url) : undefined)}
              disabled={!canAddToLibrary}
              className={clsx(
                'inline-flex items-center gap-2 rounded-full border border-border bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-micro text-accent transition hover:bg-accent/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                !canAddToLibrary ? 'cursor-not-allowed opacity-50' : null
              )}
              aria-label={addToLibraryLabel}
            >
              <UIIcon icon={Plus} size={16} />
              <span>{isSavingToLibrary ? savingLabel : addToLibraryLabel}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => (selected?.url && onDownload ? onDownload(selected.url) : undefined)}
            disabled={!canDownload}
            className={clsx(ICON_BUTTON_BASE, 'text-text-secondary hover:text-text-primary', 'disabled:opacity-50')}
            aria-label={downloadLabel}
          >
            <UIIcon icon={Download} />
            <span className="sr-only">{downloadLabel}</span>
          </button>
          <button
            type="button"
            onClick={() => (selected?.url && onCopyLink ? onCopyLink(selected.url) : undefined)}
            disabled={!canCopy}
            className={clsx(ICON_BUTTON_BASE, 'text-text-secondary hover:text-text-primary', 'disabled:opacity-50')}
            aria-label={copyLabel}
          >
            <UIIcon icon={Copy} />
            <span className="sr-only">{copyLabel}</span>
          </button>
          <button
            type="button"
            onClick={onOpenModal}
            disabled={!canOpenModal}
            className={clsx(ICON_BUTTON_BASE, 'text-text-secondary hover:text-text-primary', 'disabled:opacity-50')}
            aria-label={modalLabel}
          >
            <UIIcon icon={ExternalLink} />
            <span className="sr-only">{modalLabel}</span>
          </button>
        </div>
      </header>

      <div className="px-4 py-4">
        <div
          className="relative w-full overflow-hidden rounded-[16px] border border-hairline bg-[#f2f4f8] max-h-[320px] sm:max-h-[420px]"
          style={{ aspectRatio: aspectRatioCss ?? '1 / 1' }}
        >
          {selected ? (
            <img
              src={selected.url}
              alt={entry?.prompt ?? ''}
              className="h-full w-full object-contain"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-text-muted">{empty}</div>
          )}
        </div>

        {images.length > 1 ? (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {images.map((image, index) => {
              const isActive = index === safeIndex;
              const buttonLabel = `Take ${index + 1}`;
              return (
                <button
                  key={`${entry?.id ?? 'preview'}-${index}`}
                  type="button"
                  onClick={() => onSelectIndex(index)}
                  className={clsx(
                    'relative h-14 w-14 flex-none overflow-hidden rounded-[12px] border bg-white shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isActive ? 'border-accent' : 'border-border hover:border-accentSoft/60'
                  )}
                  aria-label={buttonLabel}
                  aria-pressed={isActive}
                >
                  <img src={image.url} alt="" className="h-full w-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
                </button>
              );
            })}
          </div>
        ) : null}

        {copiedUrl && selected?.url && copiedUrl === selected.url ? (
          <p className="mt-3 text-xs text-text-muted">{copiedLabel}</p>
        ) : null}
      </div>
    </section>
  );
}
