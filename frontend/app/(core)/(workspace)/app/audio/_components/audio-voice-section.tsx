'use client';

import type { Ref, RefObject } from 'react';
import { Upload } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { UIIcon } from '@/components/ui/UIIcon';
import type { AudioWorkspaceCopy } from '../copy';

export function AudioVoiceSection({
  copy,
  inputRef,
  isUploading,
  onClear,
  onFileSelect,
  voiceSample,
}: {
  copy: AudioWorkspaceCopy;
  inputRef: RefObject<HTMLInputElement | null>;
  isUploading: boolean;
  onClear: () => void;
  onFileSelect: (fileList: FileList | null) => void | Promise<void>;
  voiceSample: { url: string; name: string } | null;
}) {
  return (
    <div className="rounded-[12px] border border-hairline bg-surface p-4 shadow-card lg:col-span-2">
      <div>
        <p className="text-base font-semibold text-text-primary">{copy.controls.voiceSample}</p>
        <p className="mt-1 text-sm text-text-secondary">{copy.controls.uploadVoiceSampleHint}</p>
      </div>
      <div className="mt-4">
        <div className="rounded-[10px] border border-hairline bg-bg px-3 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text-primary">{copy.controls.voiceSample}</p>
              <p className="mt-1 truncate text-xs text-text-secondary">
                {voiceSample ? voiceSample.name : copy.controls.uploadVoiceSampleHint}
              </p>
            </div>
            {voiceSample ? (
              <Button type="button" variant="ghost" size="sm" onClick={onClear}>
                {copy.source.clear}
              </Button>
            ) : null}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 w-full justify-center"
            disabled={isUploading}
            onClick={() => inputRef.current?.click()}
          >
            <UIIcon icon={Upload} size={16} />
            {isUploading ? copy.source.uploading : copy.controls.uploadVoiceSample}
          </Button>
          <input
            ref={inputRef as Ref<HTMLInputElement>}
            type="file"
            accept="audio/*"
            className="sr-only"
            aria-hidden="true"
            tabIndex={-1}
            onChange={(event) => {
              void onFileSelect(event.target.files);
            }}
          />
        </div>
      </div>
    </div>
  );
}
