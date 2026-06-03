/* eslint-disable @next/next/no-img-element */

import { Download, Loader2, Pencil, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { ImageGenerationResponse } from '@/types/image-generation';
import type { StoryboardCopy } from '../_lib/storyboard-workspace-copy';
import type { StoryboardOrientation } from '../_lib/storyboard-templates';
import type { StoryboardRecentOutput } from '../_hooks/useStoryboardRecentOutputs';
import { StoryboardRecentRail } from './StoryboardRecentRail';

type StoryboardGeneratedImage = ImageGenerationResponse['images'][number];

type StoryboardResultPanelProps = {
  activeRecentOutputId: string | null;
  copy: StoryboardCopy;
  durationSec: number;
  editInstruction: string;
  editPriceLabel: string;
  frameCount: number;
  orientation: StoryboardOrientation;
  onApplyEdit: () => void;
  onDownload: () => void;
  onEditInstructionChange: (value: string) => void;
  onSave: () => void;
  onSelectRecentOutput: (output: StoryboardRecentOutput) => void;
  recentOutputs: StoryboardRecentOutput[];
  recentOutputsLoading: boolean;
  result: ImageGenerationResponse | null;
  running: boolean;
  saveLabel: string;
  saving: boolean;
  selectedImage: StoryboardGeneratedImage | null;
  templateImagePath: string;
};

export function StoryboardResultPanel({
  activeRecentOutputId,
  copy,
  durationSec,
  editInstruction,
  editPriceLabel,
  frameCount,
  orientation,
  onApplyEdit,
  onDownload,
  onEditInstructionChange,
  onSave,
  onSelectRecentOutput,
  recentOutputs,
  recentOutputsLoading,
  result,
  running,
  saveLabel,
  saving,
  selectedImage,
  templateImagePath,
}: StoryboardResultPanelProps) {
  const selectedWidth = typeof selectedImage?.width === 'number' ? selectedImage.width : null;
  const selectedHeight = typeof selectedImage?.height === 'number' ? selectedImage.height : null;
  const previewOrientation =
    selectedWidth && selectedHeight ? (selectedWidth >= selectedHeight ? 'landscape' : 'portrait') : orientation;
  const orientationLabel = previewOrientation === 'landscape' ? copy.landscapeLabel : copy.portraitLabel;
  const previewFrameClass =
    previewOrientation === 'portrait'
      ? 'relative mx-auto flex aspect-[9/16] min-h-[520px] max-h-[720px] w-full max-w-[460px] items-center justify-center overflow-hidden rounded-[12px] border border-border bg-bg'
      : 'relative flex aspect-[16/9] min-h-[360px] items-center justify-center overflow-hidden rounded-[12px] border border-border bg-bg';
  const title = selectedImage ? copy.outputTitle : copy.emptyTitle;
  const subtitle = selectedImage
    ? result?.engineLabel ?? copy.generatedPreviewLabel
    : `${durationSec}s · ${frameCount} ${copy.framesLabel} · ${orientationLabel}`;

  return (
    <section className="min-w-0 rounded-[18px] border border-border bg-surface p-5 shadow-card">
      <div className="flex min-h-[620px] flex-col">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">{copy.previewTitle}</h2>
            <p className="mt-1 text-sm text-text-secondary">{title} · {subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={!selectedImage} onClick={onDownload}>
              <Download className="h-4 w-4" />
              {copy.download}
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={!selectedImage || saving} onClick={onSave}>
              <Save className="h-4 w-4" />
              {saving ? copy.generating : saveLabel}
            </Button>
          </div>
        </div>

        <div className={previewFrameClass}>
          {selectedImage ? (
            <img src={selectedImage.url} alt="" className="h-full w-full object-contain" />
          ) : (
            <img src={templateImagePath} alt="" className="h-full w-full object-contain p-4" />
          )}
          {running ? (
            <div className="absolute inset-0 flex items-center justify-center bg-surface-on-media-dark-60 text-on-inverse">
              <div className="inline-flex items-center gap-2 rounded-full bg-surface-on-media-dark-70 px-4 py-2 text-sm font-semibold">
                <Loader2 className="h-4 w-4 animate-spin" />
                {copy.generating}
              </div>
            </div>
          ) : null}
          {!selectedImage ? (
            <div className="absolute bottom-3 left-3 rounded-full bg-surface/90 px-3 py-1 text-xs font-semibold text-text-primary shadow-sm">
              {frameCount} {copy.framesLabel} · {orientationLabel}
            </div>
          ) : null}
        </div>

        <StoryboardRecentRail
          activeOutputId={activeRecentOutputId}
          copy={copy}
          loading={recentOutputsLoading}
          outputs={recentOutputs}
          onSelect={onSelectRecentOutput}
        />

        {selectedImage ? (
          <div className="mt-3 border-t border-border pt-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <label className="block flex-1 space-y-2">
                <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.editLabel}</span>
                <input
                  value={editInstruction}
                  onChange={(event) => onEditInstructionChange(event.currentTarget.value)}
                  placeholder={copy.editPlaceholder}
                  className="h-10 w-full rounded-input border border-border bg-bg px-3 text-sm text-text-primary outline-none transition focus:border-brand"
                />
              </label>
              <Button
                type="button"
                variant="outline"
                disabled={!editInstruction.trim() || running}
                onClick={onApplyEdit}
                className="min-w-[160px] justify-between"
              >
                <span className="inline-flex items-center gap-2">
                  {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
                  {copy.editAction}
                </span>
                <span className="text-xs text-text-secondary">{editPriceLabel}</span>
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-xs text-text-muted">{copy.templateReferenceNote}</p>
        )}
      </div>
    </section>
  );
}
