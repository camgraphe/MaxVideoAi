'use client';

/* eslint-disable @next/next/no-img-element */

import clsx from 'clsx';
import { Download, Plus } from 'lucide-react';
import type { AngleCopy } from '../_lib/angle-workspace-copy';
import type { AnglePreviewImage } from '../_lib/angle-workspace-types';

export function AngleOutputMosaic({
  outputs,
  selectedIndex,
  onSelect,
  onDownload,
  onAddToLibrary,
  libraryDisabled = false,
  compact = false,
  singleRow = false,
  copy,
}: {
  outputs: AnglePreviewImage[];
  selectedIndex?: number;
  onSelect?: (index: number) => void;
  onDownload?: (url: string) => void;
  onAddToLibrary?: (url: string) => void;
  libraryDisabled?: boolean;
  compact?: boolean;
  singleRow?: boolean;
  copy: AngleCopy;
}) {
  if (!outputs.length) return null;

  if (outputs.length === 1) {
    const output = outputs[0];
    return (
      <div className={clsx('overflow-hidden rounded-card border border-border bg-bg', compact ? 'h-full' : '')}>
        <div className="relative">
          <img
            src={output.thumbUrl ?? output.url}
            alt=""
            className={clsx('w-full', compact ? 'h-full object-cover' : 'h-[360px] object-contain')}
          />
          {!compact && (onDownload || onAddToLibrary) ? (
            <div className="absolute bottom-3 right-3 flex items-center gap-2">
              {onAddToLibrary ? (
                <button
                  type="button"
                  title={libraryDisabled ? copy.alreadyInLibrary : copy.addToLibrary}
                  onClick={() => onAddToLibrary(output.url)}
                  disabled={libraryDisabled}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-surface-on-media-25 bg-surface-on-media-dark-55 text-on-inverse transition hover:bg-surface-on-media-dark-70 disabled:cursor-default disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                </button>
              ) : null}
              {onDownload ? (
                <button
                  type="button"
                  title={copy.download}
                  onClick={() => onDownload(output.url)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-surface-on-media-25 bg-surface-on-media-dark-55 text-on-inverse transition hover:bg-surface-on-media-dark-70"
                >
                  <Download className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={clsx(singleRow ? 'grid grid-cols-4 gap-2' : 'grid grid-cols-2 gap-3')}>
      {outputs.slice(0, 4).map((output, index) => {
        const selected = index === selectedIndex;
        const content = (
          <>
            <div className={clsx('relative overflow-hidden bg-bg', singleRow ? 'aspect-[4/5]' : 'aspect-square')}>
              <img src={output.thumbUrl ?? output.url} alt="" className="h-full w-full object-cover" />
              {!compact && selected && (onDownload || onAddToLibrary) ? (
                <div className="absolute bottom-2 right-2 flex items-center gap-2">
                  {onAddToLibrary ? (
                    <button
                      type="button"
                      title={libraryDisabled ? copy.alreadyInLibrary : copy.addToLibrary}
                      onClick={(event) => {
                        event.stopPropagation();
                        onAddToLibrary(output.url);
                      }}
                      disabled={libraryDisabled}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-surface-on-media-25 bg-surface-on-media-dark-55 text-on-inverse transition hover:bg-surface-on-media-dark-70 disabled:cursor-default disabled:opacity-50"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                  {onDownload ? (
                    <button
                      type="button"
                      title={copy.download}
                      onClick={(event) => {
                        event.stopPropagation();
                        onDownload(output.url);
                      }}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-surface-on-media-25 bg-surface-on-media-dark-55 text-on-inverse transition hover:bg-surface-on-media-dark-70"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
            {!compact && !singleRow ? (
              <div className="px-2 py-1 text-left text-[11px] text-text-secondary">
                {copy.angleLabel.replace('{index}', String(index + 1))}
                {selected ? ` · ${copy.angleSelected}` : ''}
              </div>
            ) : null}
          </>
        );

        if (!onSelect) {
          return (
            <div key={`${output.url}-${index}`} className="overflow-hidden rounded-card border border-border bg-bg">
              {content}
            </div>
          );
        }

        return (
          <button
            key={`${output.url}-${index}`}
            type="button"
            onClick={() => onSelect(index)}
            className={clsx(
              'overflow-hidden rounded-card border bg-bg text-left transition',
              selected ? 'border-brand ring-1 ring-brand/40' : 'border-border hover:border-brand/40'
            )}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
