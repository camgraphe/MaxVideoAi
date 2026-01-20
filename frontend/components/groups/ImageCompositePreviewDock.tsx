'use client';

/* eslint-disable @next/next/no-img-element */

import clsx from 'clsx';
import type { ReactNode } from 'react';
import { Copy, Download, ExternalLink, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
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
  engineSettings?: ReactNode;
  showTitle?: boolean;
}

const ICON_BUTTON_BASE =
  'flex h-9 w-9 items-center justify-center rounded-lg border border-hairline/50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-px';

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
  engineSettings,
  showTitle = true,
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

  const headerTitle = showTitle ? (
    <div>
      <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
      <p className="text-xs text-text-muted">{images.length ? `${images.length} variant${images.length === 1 ? '' : 's'}` : empty}</p>
    </div>
  ) : null;

  const toolbar = (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {isInLibrary ? (
        <span title={isRemovingFromLibrary ? removingLabel : removeFromLibraryLabel}>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onRemoveFromLibrary}
            disabled={!canRemoveFromLibrary}
            className={clsx(ICON_BUTTON_BASE, 'p-0 text-state-warning', 'disabled:opacity-50')}
            aria-label={isRemovingFromLibrary ? removingLabel : removeFromLibraryLabel}
          >
            <span className="inline-flex h-4 w-4 items-center justify-center">
              <UIIcon icon={Minus} size={16} />
            </span>
            <span className="sr-only">{isRemovingFromLibrary ? removingLabel : removeFromLibraryLabel}</span>
          </Button>
        </span>
      ) : (
        <span title={isSavingToLibrary ? savingLabel : addToLibraryLabel}>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => (selected?.url && onAddToLibrary ? onAddToLibrary(selected.url) : undefined)}
            disabled={!canAddToLibrary}
            className={clsx(ICON_BUTTON_BASE, 'p-0 text-brand', 'disabled:opacity-50')}
            aria-label={isSavingToLibrary ? savingLabel : addToLibraryLabel}
          >
            <span className="inline-flex h-4 w-4 items-center justify-center">
              <UIIcon icon={Plus} size={16} />
            </span>
            <span className="sr-only">{isSavingToLibrary ? savingLabel : addToLibraryLabel}</span>
          </Button>
        </span>
      )}
      <span title={downloadLabel}>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => (selected?.url && onDownload ? onDownload(selected.url) : undefined)}
          disabled={!canDownload}
          className={clsx(ICON_BUTTON_BASE, 'p-0 text-text-secondary hover:text-text-primary', 'disabled:opacity-50')}
          aria-label={downloadLabel}
        >
          <span className="inline-flex h-4 w-4 items-center justify-center">
            <UIIcon icon={Download} size={16} />
          </span>
          <span className="sr-only">{downloadLabel}</span>
        </Button>
      </span>
      <span title={copyLabel}>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => (selected?.url && onCopyLink ? onCopyLink(selected.url) : undefined)}
          disabled={!canCopy}
          className={clsx(ICON_BUTTON_BASE, 'p-0 text-text-secondary hover:text-text-primary', 'disabled:opacity-50')}
          aria-label={copyLabel}
        >
          <span className="inline-flex h-4 w-4 items-center justify-center">
            <UIIcon icon={Copy} size={16} />
          </span>
          <span className="sr-only">{copyLabel}</span>
        </Button>
      </span>
      <span title={modalLabel}>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onOpenModal}
          disabled={!canOpenModal}
          className={clsx(ICON_BUTTON_BASE, 'p-0 text-text-secondary hover:text-text-primary', 'disabled:opacity-50')}
          aria-label={modalLabel}
        >
          <span className="inline-flex h-4 w-4 items-center justify-center">
            <UIIcon icon={ExternalLink} size={16} />
          </span>
          <span className="sr-only">{modalLabel}</span>
        </Button>
      </span>
    </div>
  );

  return (
    <section className="overflow-hidden rounded-card border border-border bg-surface-glass-80 shadow-card">
      <header className="border-b border-hairline px-4 py-3">
        {engineSettings ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0 flex-1">{engineSettings}</div>
            </div>
            {showTitle ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                {headerTitle}
              </div>
            ) : null}
          </>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4">
            {headerTitle}
          </div>
        )}
      </header>

      <div className="px-4 py-4">
        <div className="flex flex-col items-center">
          <div
            className="relative w-full overflow-hidden rounded-card border border-hairline bg-placeholder max-h-[320px] sm:max-h-[420px]"
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
          <div className="mt-3 flex w-full">
            <div className="flex w-full items-center justify-center rounded-card border border-hairline/50 bg-surface-glass-80 px-3 py-2 shadow-sm backdrop-blur">
              {toolbar}
            </div>
          </div>
        </div>

        {images.length > 1 ? (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {images.map((image, index) => {
              const isActive = index === safeIndex;
              const buttonLabel = `Take ${index + 1}`;
              return (
                <Button
                  key={`${entry?.id ?? 'preview'}-${index}`}
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => onSelectIndex(index)}
                  className={clsx(
                    'relative h-14 w-14 flex-none overflow-hidden rounded-card border bg-surface p-0 shadow-sm transition',
                    isActive ? 'border-brand' : 'border-border hover:border-text-muted'
                  )}
                  aria-label={buttonLabel}
                  aria-pressed={isActive}
                >
                  <img src={image.url} alt="" className="h-full w-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
                </Button>
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
