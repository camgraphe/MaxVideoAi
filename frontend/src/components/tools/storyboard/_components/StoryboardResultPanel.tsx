/* eslint-disable @next/next/no-img-element */

import { Download, Loader2, Pencil, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { ImageGenerationResponse } from '@/types/image-generation';
import type { StoryboardCopy } from '../_lib/storyboard-workspace-copy';
import type { StoryboardShotPlan } from '../_lib/storyboard-shot-plan';
import { StoryboardShotMap } from './StoryboardShotMap';

type StoryboardGeneratedImage = ImageGenerationResponse['images'][number];

type StoryboardResultPanelProps = {
  copy: StoryboardCopy;
  editInstruction: string;
  onApplyEdit: () => void;
  onDownload: () => void;
  onEditInstructionChange: (value: string) => void;
  onSave: () => void;
  result: ImageGenerationResponse | null;
  running: boolean;
  saveLabel: string;
  saving: boolean;
  selectedImage: StoryboardGeneratedImage | null;
  shotPlan: StoryboardShotPlan;
};

export function StoryboardResultPanel({
  copy,
  editInstruction,
  onApplyEdit,
  onDownload,
  onEditInstructionChange,
  onSave,
  result,
  running,
  saveLabel,
  saving,
  selectedImage,
  shotPlan,
}: StoryboardResultPanelProps) {
  return (
    <section className="min-w-0">
      <Card className="flex min-h-[620px] flex-col border border-border bg-surface p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">
              {selectedImage ? copy.outputTitle : copy.shotMapEmptyTitle}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-text-primary">{selectedImage ? result?.engineLabel : copy.shotMapTitle}</h2>
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

        <div
          className={`flex min-h-[420px] flex-1 rounded-card border border-border bg-bg ${
            selectedImage || running ? 'items-center justify-center overflow-hidden' : 'items-stretch justify-stretch overflow-y-auto'
          }`}
        >
          {selectedImage ? (
            <img src={selectedImage.url} alt="" className="max-h-[620px] w-full object-contain" />
          ) : running ? (
            <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
              <Loader2 className="h-4 w-4 animate-spin" />
              {copy.generating}
            </div>
          ) : (
            <StoryboardShotMap
              emptyBody={copy.shotMapEmptyBody}
              emptyTitle={copy.shotMapEmptyTitle}
              plan={shotPlan}
              title={copy.shotMapTitle}
            />
          )}
        </div>

        {selectedImage ? (
          <div className="mt-4 rounded-card border border-border bg-bg p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <label className="block flex-1 space-y-2">
                <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.editLabel}</span>
                <input
                  value={editInstruction}
                  onChange={(event) => onEditInstructionChange(event.currentTarget.value)}
                  placeholder={copy.editPlaceholder}
                  className="h-10 w-full rounded-input border border-border bg-surface px-3 text-sm text-text-primary outline-none transition focus:border-brand"
                />
              </label>
              <Button type="button" variant="outline" disabled={!editInstruction.trim() || running} onClick={onApplyEdit}>
                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
                {copy.editAction}
              </Button>
            </div>
          </div>
        ) : null}
      </Card>
    </section>
  );
}
