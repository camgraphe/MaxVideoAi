'use client';

/* eslint-disable @next/next/no-img-element */

import clsx from 'clsx';
import { Images, Loader2, Upload, X } from 'lucide-react';
import type {
  ChangeEvent,
  ClipboardEvent as ReactClipboardEvent,
  DragEvent as ReactDragEvent,
  Ref,
} from 'react';
import { Button } from '@/components/ui/Button';
import type { AngleCopy } from '../_lib/angle-workspace-copy';
import type { UploadedImage } from '../_lib/angle-workspace-types';

interface AngleSourceImagePanelProps {
  copy: AngleCopy;
  fileInputRef: Ref<HTMLInputElement>;
  onAuthRequired: () => void;
  onFileSelect: (event: ChangeEvent<HTMLInputElement>) => void;
  onLibraryOpen: () => void;
  onRemoveSource: () => void;
  onSourceDragActiveChange: (active: boolean) => void;
  onSourceDrop: (event: ReactDragEvent<HTMLDivElement>) => void;
  onSourcePaste: (event: ReactClipboardEvent<HTMLDivElement>) => void;
  onUploadRequest: () => void;
  sourceDragActive: boolean;
  sourceImage: UploadedImage | null;
  uploading: boolean;
  userPresent: boolean;
}

export function AngleSourceImagePanel({
  copy,
  fileInputRef,
  onAuthRequired,
  onFileSelect,
  onLibraryOpen,
  onRemoveSource,
  onSourceDragActiveChange,
  onSourceDrop,
  onSourcePaste,
  onUploadRequest,
  sourceDragActive,
  sourceImage,
  uploading,
  userPresent,
}: AngleSourceImagePanelProps) {
  const handleUploadClick = () => {
    onUploadRequest();
  };

  const handleLibraryClick = () => {
    if (!userPresent) {
      onAuthRequired();
      return;
    }
    onLibraryOpen();
  };

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.sourceImage}</p>
      <div
        className={clsx(
          'mt-2 rounded-card border border-dashed bg-bg p-4 transition',
          sourceDragActive ? 'border-brand bg-brand/5' : 'border-border'
        )}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
          onSourceDragActiveChange(true);
        }}
        onDragLeave={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
          onSourceDragActiveChange(false);
        }}
        onDrop={onSourceDrop}
        onPaste={onSourcePaste}
        tabIndex={0}
      >
        <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileSelect} className="hidden" />
        {sourceImage?.url ? (
          <div className="overflow-hidden rounded-card border border-border bg-bg">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
              <div>
                <p className="text-sm font-medium text-text-primary">{copy.sourceReady}</p>
                <p className="text-xs text-text-muted">
                  {sourceImage?.width && sourceImage?.height
                    ? `${sourceImage.width} x ${sourceImage.height}`
                    : sourceImage.source === 'library'
                      ? copy.sourceFromLibrary
                      : sourceImage.source === 'example'
                        ? copy.sourceFromExample
                        : sourceImage.source === 'paste'
                          ? copy.sourceFromPaste
                          : copy.sourceFromDevice}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" className="gap-2" onClick={handleUploadClick} disabled={uploading}>
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploading ? copy.uploading : copy.replace}
                </Button>
                <Button type="button" variant="outline" size="sm" className="gap-2" onClick={handleLibraryClick}>
                  <Images className="h-4 w-4" />
                  {copy.library}
                </Button>
                <Button type="button" variant="outline" size="sm" className="gap-2" onClick={onRemoveSource}>
                  <X className="h-4 w-4" />
                  {copy.remove}
                </Button>
              </div>
            </div>
            <div className="overflow-hidden bg-bg">
              <img src={sourceImage.url} alt={copy.sourceAlt} className="h-56 w-full object-contain" />
            </div>
          </div>
        ) : (
          <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-card border border-dashed border-border bg-bg px-4 text-center">
            <div>
              <p className="text-sm font-medium text-text-primary">{copy.addSourceTitle}</p>
              <p className="mt-1 text-xs text-text-muted">{copy.addSourceBody}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button type="button" variant="outline" size="sm" className="gap-2" onClick={handleUploadClick} disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploading ? copy.uploading : copy.upload}
              </Button>
              <Button type="button" variant="outline" size="sm" className="gap-2" onClick={handleLibraryClick}>
                <Images className="h-4 w-4" />
                {copy.library}
              </Button>
            </div>
            <p className="text-[11px] text-text-muted">{copy.formats}</p>
          </div>
        )}
      </div>
    </div>
  );
}
