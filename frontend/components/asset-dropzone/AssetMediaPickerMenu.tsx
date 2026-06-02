'use client';

import { Images, UploadCloud, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { getLocalizedAssetDropzoneCopy } from '@/lib/ltx-localization';

type AssetDropzoneCopy = ReturnType<typeof getLocalizedAssetDropzoneCopy>;

type AssetMediaPickerMenuProps = {
  copy: AssetDropzoneCopy;
  canOpenLibrary: boolean;
  menuId: string;
  open: boolean;
  onClose: () => void;
  onLibrary: () => void;
  onUpload: () => void;
};

export function AssetMediaPickerMenu({
  copy,
  canOpenLibrary,
  menuId,
  open,
  onClose,
  onLibrary,
  onUpload,
}: AssetMediaPickerMenuProps) {
  if (!open) return null;

  return (
    <div
      id={menuId}
      role="dialog"
      aria-label={copy.chooseMedia}
      className="absolute left-1/2 top-1/2 z-30 w-[min(19rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-input border border-border bg-surface p-3 text-left shadow-xl dark:border-white/12 dark:bg-[#101826]"
      onClick={(event) => {
        event.stopPropagation();
      }}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text-primary dark:text-white/92">{copy.chooseMedia}</p>
          <p className="mt-1 text-[11px] leading-4 text-text-muted dark:text-white/58">{copy.chooseMediaHint}</p>
        </div>
        <button
          type="button"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-text-muted transition hover:bg-surface-2 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-white/58 dark:hover:bg-white/[0.08] dark:hover:text-white"
          aria-label={copy.remove}
          onClick={onClose}
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-[44px] justify-start rounded-input px-3 text-xs"
          onClick={onUpload}
        >
          <UploadCloud className="h-4 w-4" aria-hidden />
          {copy.upload}
        </Button>
        {canOpenLibrary ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-[44px] justify-start rounded-input px-3 text-xs"
            onClick={onLibrary}
          >
            <Images className="h-4 w-4" aria-hidden />
            {copy.library}
          </Button>
        ) : null}
      </div>
      <p className="mt-3 text-[10px] leading-4 text-text-muted dark:text-white/45">{copy.dragDropHint}</p>
    </div>
  );
}
