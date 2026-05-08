'use client';

import type { RefObject } from 'react';
import { CheckCircle2, FileVideo, Upload, Video } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { UIIcon } from '@/components/ui/UIIcon';
import { formatAudioDurationLabel } from '@/lib/audio-generation';
import type { SourceVideoState } from '../_lib/audio-workspace-types';
import type { AudioWorkspaceCopy } from '../copy';

export function AudioSourceVideoSection({
  copy,
  inputRef,
  isUploading,
  onClear,
  onFileSelect,
  onOpenGeneratedPicker,
  required,
  sourceVideo,
}: {
  copy: AudioWorkspaceCopy;
  inputRef: RefObject<HTMLInputElement>;
  isUploading: boolean;
  onClear: () => void;
  onFileSelect: (fileList: FileList | null) => void | Promise<void>;
  onOpenGeneratedPicker: () => void;
  required: boolean;
  sourceVideo: SourceVideoState | null;
}) {
  return (
    <section className="rounded-[12px] border border-hairline bg-surface p-4 shadow-card">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[9px] bg-brand-soft text-brand">
            <UIIcon icon={FileVideo} size={22} />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-text-primary">{copy.source.title}</h2>
            <p className="mt-1 text-sm text-text-secondary">
              {required ? copy.source.required : copy.source.optional}
            </p>
            {sourceVideo ? (
              <p className="mt-2 truncate text-sm font-semibold text-text-primary">
                {sourceVideo.label}
                <span className="ml-2 text-xs font-medium text-text-muted">
                  {sourceVideo.durationSec ? formatAudioDurationLabel(sourceVideo.durationSec) : copy.source.durationPending}
                </span>
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isUploading}
            onClick={() => inputRef.current?.click()}
          >
            <UIIcon icon={Upload} size={16} />
            {isUploading ? copy.source.uploading : copy.source.upload}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onOpenGeneratedPicker}>
            <UIIcon icon={Video} size={16} />
            {copy.source.useGenerated}
          </Button>
          {sourceVideo ? (
            <Button type="button" variant="ghost" size="sm" onClick={onClear}>
              {copy.source.clear}
            </Button>
          ) : null}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="sr-only"
        onChange={(event) => {
          void onFileSelect(event.target.files);
        }}
      />
      {sourceVideo ? (
        <div className="mt-3 flex items-center gap-3 rounded-[10px] border border-hairline bg-bg px-3 py-2">
          <div className="h-12 w-20 overflow-hidden rounded-[8px] border border-hairline bg-surface">
            <video src={sourceVideo.url} poster={sourceVideo.thumbUrl ?? undefined} className="h-full w-full object-cover" muted playsInline preload="metadata" />
          </div>
          <p className="min-w-0 flex-1 truncate text-xs text-text-secondary">
            {sourceVideo.aspectRatio ? `${sourceVideo.aspectRatio} · ` : ''}
            {sourceVideo.durationSec ? formatAudioDurationLabel(sourceVideo.durationSec) : copy.source.durationPending}
          </p>
          <CheckCircle2 className="h-5 w-5 text-success" aria-hidden />
        </div>
      ) : null}
    </section>
  );
}
