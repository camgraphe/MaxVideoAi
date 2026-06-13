import clsx from 'clsx';
import { AlertCircle, FileVideo, FolderOpen, Link2, UploadCloud, Video } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { BACKGROUND_REMOVAL_WORKSPACE_UPLOAD_PLACEHOLDER } from '../_lib/background-removal-workspace-assets';
import type { BackgroundRemovalWorkspaceCopy } from '../_lib/background-removal-workspace-copy';
import type { BackgroundRemovalSourceAsset, BackgroundRemovalVideoMetadata } from '../_lib/background-removal-workspace-types';

export function BackgroundRemovalSourcePanel(props: {
  copy: BackgroundRemovalWorkspaceCopy;
  isAuthenticated: boolean;
  libraryAssets: BackgroundRemovalSourceAsset[];
  libraryError: string | null;
  libraryLoading: boolean;
  libraryOpen: boolean;
  librarySource: string;
  librarySourceOptions: Array<{ value: string; label: string }>;
  metadata: BackgroundRemovalVideoMetadata | null;
  metadataLoading: boolean;
  onFileUpload: (file: File | null | undefined) => void;
  onLibraryOpenChange: (open: boolean) => void;
  onLibraryRefresh: () => void;
  onLibrarySelect: (asset: BackgroundRemovalSourceAsset) => void;
  onLibrarySourceChange: (source: string) => void;
  onUrlChange: (url: string) => void;
  source: BackgroundRemovalSourceAsset | null;
  sourceError: string | null;
  uploading: boolean;
  videoUrl: string;
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-border bg-surface px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand text-[11px] font-semibold text-on-brand">
                {props.copy.sourceStep}
              </span>
              <h2 className="text-base font-semibold text-text-primary">{props.copy.sourceTitle}</h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-text-secondary">{props.copy.sourceBody}</p>
          </div>
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-slate-950 text-lime-300 dark:bg-white/[0.08]">
            <Video className="h-4 w-4" />
          </span>
        </div>
      </div>

      <div className="grid gap-3 p-5">
        <div className="flex border-b border-border text-sm font-semibold">
          <span className="border-b-2 border-brand px-4 pb-2 text-text-primary">{props.copy.upload}</span>
          <span className="px-4 pb-2 text-text-muted">{props.copy.urlLabel}</span>
        </div>

        <label
          className={clsx(
            'group flex min-h-[310px] cursor-pointer flex-col items-center justify-center rounded-[14px] border border-dashed border-border bg-bg px-4 py-5 text-center transition',
            props.isAuthenticated && !props.uploading
              ? 'hover:border-brand hover:bg-brand/5'
              : 'cursor-not-allowed opacity-70'
          )}
        >
          <span className="text-sm font-semibold text-text-primary">
            {props.uploading ? props.copy.metadataLoading : props.copy.dropzoneTitle}
          </span>
          <span className="mt-1 max-w-[260px] text-xs leading-5 text-text-secondary">{props.copy.dropzoneBody}</span>
          <span className="relative mt-4 block aspect-[16/9] w-full max-w-[360px] overflow-hidden rounded-[14px] border border-border bg-surface shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt=""
              className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.015]"
              src={BACKGROUND_REMOVAL_WORKSPACE_UPLOAD_PLACEHOLDER}
            />
            <span className="absolute left-1/2 top-1/2 inline-flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-slate-950 shadow-[0_10px_30px_rgba(15,23,42,0.2)]">
              <UploadCloud className="h-5 w-5" />
            </span>
          </span>
          <span className="mt-4 inline-flex min-h-[34px] items-center justify-center rounded-input border border-border bg-surface px-3 text-xs font-semibold text-text-primary group-hover:border-brand">
            {props.copy.upload}
          </span>
          <input
            accept="video/*"
            className="sr-only"
            disabled={!props.isAuthenticated || props.uploading}
            onChange={(event) => {
              props.onFileUpload(event.target.files?.[0]);
              event.currentTarget.value = '';
            }}
            type="file"
          />
        </label>

        <div className="rounded-[12px] border border-border bg-bg p-3">
          <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-micro text-text-muted">
            <Link2 className="h-3.5 w-3.5" />
            {props.copy.urlLabel}
          </label>
          <input
            className="mt-2 w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
            disabled={!props.isAuthenticated}
            onChange={(event) => props.onUrlChange(event.target.value)}
            placeholder={props.copy.urlPlaceholder}
            type="url"
            value={props.videoUrl}
          />
          <p className="mt-2 text-xs leading-5 text-text-secondary">{props.copy.urlHelp}</p>
        </div>

        <div className="rounded-[12px] border border-border bg-bg p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                <FolderOpen className="h-4 w-4 text-text-muted" />
                {props.copy.library}
              </p>
              <p className="mt-1 text-xs leading-5 text-text-secondary">{props.copy.libraryHelp}</p>
            </div>
            <Button
              disabled={!props.isAuthenticated}
              onClick={() => props.onLibraryOpenChange(!props.libraryOpen)}
              size="sm"
              variant="outline"
            >
              {props.copy.library}
            </Button>
          </div>
        </div>

        {props.sourceError ? (
          <div className="flex items-start gap-3 rounded-[12px] border border-danger/30 bg-danger/5 px-3 py-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
            <p className="min-w-0 text-xs font-semibold text-danger">{props.sourceError}</p>
          </div>
        ) : null}

        {props.libraryOpen ? (
          <div className="rounded-[12px] border border-border bg-bg p-3">
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="min-h-[36px] rounded-input border border-border bg-surface px-3 py-2 text-sm text-text-primary"
                onChange={(event) => props.onLibrarySourceChange(event.target.value)}
                value={props.librarySource}
              >
                {props.librarySourceOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Button onClick={props.onLibraryRefresh} size="sm" variant="ghost">
                {props.copy.libraryRefresh}
              </Button>
            </div>
            {props.libraryError ? <p className="mt-2 text-xs text-danger">{props.libraryError}</p> : null}
            <div className="mt-3 grid max-h-80 gap-2 overflow-y-auto pr-1">
              {props.libraryLoading ? <p className="text-sm text-text-secondary">Loading...</p> : null}
              {!props.libraryLoading && !props.libraryAssets.length ? (
                <p className="rounded-input border border-dashed border-border bg-surface p-3 text-sm text-text-secondary">{props.copy.recentEmpty}</p>
              ) : null}
              {props.libraryAssets.map((asset) => (
                <button
                  className="flex items-center gap-3 rounded-input border border-border bg-surface p-2 text-left transition hover:border-brand hover:bg-brand/5"
                  key={asset.id ?? asset.url}
                  onClick={() => props.onLibrarySelect(asset)}
                  type="button"
                >
                  {asset.thumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt="" className="h-12 w-16 rounded-[8px] object-cover" src={asset.thumbUrl} />
                  ) : (
                    <span className="flex h-12 w-16 items-center justify-center rounded-[8px] bg-surface-2">
                      <FileVideo className="h-4 w-4 text-text-muted" />
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-text-primary">{asset.name ?? asset.id ?? 'Video'}</span>
                    <span className="block truncate text-xs text-text-muted">{asset.url}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
