import { useI18n } from '@/lib/i18n/I18nProvider';
import { toolboxCopy } from '../../toolbox-copy';
/* eslint-disable @next/next/no-img-element */

import type { KeyboardEventHandler, PointerEventHandler, Ref } from 'react';
import { ChevronsLeftRight, Download, Save, ZoomIn } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PREVIEW_ZOOM_OPTIONS } from '../_lib/upscale-workspace-helpers';
import type { PreviewMode, PreviewZoom } from '../_lib/upscale-workspace-types';

type UpscalePreviewCopy = {
  download: string;
  previewCompare: string;
  previewResult: string;
  previewSource: string;
  previewZoom: string;
  previewZoomFit: string;
  save: string;
};

export function UpscalePreviewCard({
  activePreviewMode,
  canCompare,
  compareDragging,
  compareEnabled,
  comparePosition,
  copy,
  hasResult,
  isPixelZoom,
  mediaFitClass,
  onCompareKeyDown,
  onComparePointerDown,
  onComparePointerMove,
  onComparePointerUp,
  onDownload,
  onPreviewModeChange,
  onPreviewZoomChange,
  onSave,
  outputSizeLabel,
  previewScrollerRef,
  previewZoom,
  previewZoomScale,
  resultPreviewIsVideo,
  resultPreviewUrl,
  sourcePreviewIsVideo,
  sourcePreviewUrl,
  sourceSizeLabel,
  zoomCanvasHeight,
  zoomCanvasWidth,
}: {
  activePreviewMode: PreviewMode;
  canCompare: boolean;
  compareDragging: boolean;
  compareEnabled: boolean;
  comparePosition: number;
  copy: UpscalePreviewCopy;
  hasResult: boolean;
  isPixelZoom: boolean;
  mediaFitClass: string;
  onCompareKeyDown: KeyboardEventHandler<HTMLDivElement>;
  onComparePointerDown: PointerEventHandler<HTMLDivElement>;
  onComparePointerMove: PointerEventHandler<HTMLDivElement>;
  onComparePointerUp: PointerEventHandler<HTMLDivElement>;
  onDownload: () => void;
  onPreviewModeChange: (mode: PreviewMode) => void;
  onPreviewZoomChange: (zoom: PreviewZoom) => void;
  onSave: () => void;
  outputSizeLabel: string;
  previewScrollerRef: Ref<HTMLDivElement>;
  previewZoom: PreviewZoom;
  previewZoomScale: number;
  resultPreviewIsVideo: boolean;
  resultPreviewUrl: string;
  sourcePreviewIsVideo: boolean;
  sourcePreviewUrl: string;
  sourceSizeLabel: string;
  zoomCanvasHeight: number;
  zoomCanvasWidth: number;
}) {
  const { locale } = useI18n();
  const labels = toolboxCopy(locale);
  return (
    <Card className="order-2 overflow-hidden rounded-[14px] border border-border bg-surface p-0 shadow-card xl:order-none">
      <div className="flex flex-wrap items-start justify-between gap-3 px-3 py-3">
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div className="flex rounded-[10px] border border-border bg-bg p-1">
            {([
              ['source', labels.original, false],
              ['result', labels.result, !hasResult],
              ['compare', labels.compare, !canCompare],
            ] as const).filter(([modeOption]) => modeOption !== 'compare' || (!sourcePreviewIsVideo && !resultPreviewIsVideo)).map(([modeOption, label, disabled]) => {
              const active = activePreviewMode === modeOption;
              return (
                <button
                  key={modeOption}
                  type="button"
                  disabled={disabled}
                  aria-pressed={active}
                  onClick={() => onPreviewModeChange(modeOption)}
                  className={`min-h-8 rounded-[8px] px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${
                    active ? 'bg-brand text-on-brand shadow-card' : 'text-text-secondary hover:bg-surface hover:text-text-primary'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {hasResult ? (
            <>
              <Button variant="outline" size="sm" aria-label={copy.save} title={copy.save} onClick={onSave} className="rounded-[10px] border-border bg-surface text-text-secondary hover:bg-surface-hover hover:text-text-primary">
                <Save className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" aria-label={copy.download} title={copy.download} onClick={onDownload} className="rounded-[10px] border-border bg-surface text-text-secondary hover:bg-surface-hover hover:text-text-primary">
                <Download className="h-4 w-4" />
              </Button>
            </>
          ) : null}
          {!sourcePreviewIsVideo && !resultPreviewIsVideo ? <label className="flex items-center gap-2 text-xs"><ZoomIn className="h-4 w-4" /><select aria-label={copy.previewZoom} value={previewZoom} onChange={event => onPreviewZoomChange(event.currentTarget.value as PreviewZoom)} className="min-h-11 rounded-lg border border-border bg-surface px-2 text-xs">{PREVIEW_ZOOM_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.value === 'fit' ? copy.previewZoomFit : option.label}</option>)}</select></label> : null}
        </div>
      </div>

      <div className="px-3 pb-3 sm:px-5 sm:pb-5">
        <div className="relative aspect-video min-h-[180px] max-h-[min(72vh,680px)] overflow-hidden rounded-[12px] border border-border bg-surface-3 sm:aspect-[16/9] sm:min-h-[340px] xl:aspect-[16/8] xl:min-h-[420px]">
          <div ref={previewScrollerRef} className={`absolute inset-0 ${isPixelZoom ? 'overflow-auto' : 'overflow-hidden'}`}>
            <div
              className={`relative h-full w-full ${compareEnabled ? 'cursor-ew-resize touch-none select-none' : ''} ${
                compareDragging ? 'ring-2 ring-ring' : ''
              }`}
              style={
                isPixelZoom
                  ? {
                      width: `${Math.round(zoomCanvasWidth * previewZoomScale)}px`,
                      height: `${Math.round(zoomCanvasHeight * previewZoomScale)}px`,
                    }
                  : undefined
              }
              role={compareEnabled ? 'slider' : 'group'}
              aria-label={compareEnabled ? 'Compare source and upscaled preview' : activePreviewMode === 'result' ? 'Upscaled result preview' : 'Source preview'}
              aria-valuemin={compareEnabled ? 8 : undefined}
              aria-valuemax={compareEnabled ? 92 : undefined}
              aria-valuenow={compareEnabled ? Math.round(comparePosition) : undefined}
              tabIndex={compareEnabled ? 0 : undefined}
              onPointerDown={compareEnabled ? onComparePointerDown : undefined}
              onPointerMove={compareEnabled ? onComparePointerMove : undefined}
              onPointerUp={compareEnabled ? onComparePointerUp : undefined}
              onPointerCancel={compareEnabled ? onComparePointerUp : undefined}
              onKeyDown={onCompareKeyDown}
            >
              {activePreviewMode === 'source' ? (
                sourcePreviewIsVideo ? (
                  <video className={`absolute inset-0 h-full w-full ${mediaFitClass}`} src={sourcePreviewUrl} controls preload="none" playsInline />
                ) : (
                  <img className={`absolute inset-0 h-full w-full ${mediaFitClass}`} src={sourcePreviewUrl} alt="" draggable={false} />
                )
              ) : activePreviewMode === 'result' ? (
                resultPreviewIsVideo ? (
                  <video className={`absolute inset-0 h-full w-full ${mediaFitClass}`} src={resultPreviewUrl} controls preload="none" playsInline />
                ) : (
                  <img className={`absolute inset-0 h-full w-full ${mediaFitClass}`} src={resultPreviewUrl} alt="" draggable={false} />
                )
              ) : resultPreviewIsVideo ? (
                <>
                  <video className={`absolute inset-0 h-full w-full ${mediaFitClass}`} src={resultPreviewUrl} muted preload="none" playsInline />
                  <video
                    className={`absolute inset-0 h-full w-full ${mediaFitClass}`}
                    src={sourcePreviewUrl}
                    muted
                    playsInline
                    style={{ clipPath: `inset(0 ${100 - comparePosition}% 0 0)` }}
                  />
                </>
              ) : (
                <>
                  <img className={`absolute inset-0 h-full w-full ${mediaFitClass}`} src={resultPreviewUrl} alt="" draggable={false} />
                  <img
                    className={`absolute inset-0 h-full w-full ${mediaFitClass}`}
                    src={sourcePreviewUrl}
                    alt=""
                    draggable={false}
                    style={{ clipPath: `inset(0 ${100 - comparePosition}% 0 0)` }}
                  />
                </>
              )}

              {activePreviewMode === 'compare' ? (
                <>
                  <div className="absolute inset-y-0 w-px bg-on-inverse shadow-[0_0_0_1px_var(--surface-on-media-dark-40)]" style={{ left: `${comparePosition}%` }} />
                  <div
                    className="absolute top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-surface-on-media-70 bg-on-inverse text-brand shadow-float transition-transform hover:scale-105"
                    style={{ left: `${comparePosition}%` }}
                    aria-hidden="true"
                  >
                    <ChevronsLeftRight className="h-5 w-5" />
                  </div>
                </>
              ) : null}

              <div className="absolute left-3 top-3 rounded-[8px] bg-surface-on-media-dark-80 px-3 py-2 text-on-inverse shadow-lg backdrop-blur sm:left-6 sm:top-6 sm:px-4 sm:py-3">
                <p className="text-xs font-semibold">
                  {activePreviewMode === 'result' ? copy.previewResult : copy.previewSource}
                </p>
                <p className="mt-1 text-xs text-on-media-85">
                  {activePreviewMode === 'result' ? outputSizeLabel : sourceSizeLabel}
                </p>
              </div>
              {activePreviewMode === 'compare' ? (
                <div className="absolute right-3 top-3 rounded-[8px] bg-surface-on-media-dark-80 px-3 py-2 text-on-inverse shadow-lg backdrop-blur sm:right-6 sm:top-6 sm:px-4 sm:py-3">
                  <p className="text-xs font-semibold">{copy.previewResult}</p>
                  <p className="mt-1 text-xs text-on-media-85">{outputSizeLabel}</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
