import { Upload, Video } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
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
  const metadataLabel = props.metadata
    ? `${Math.ceil(props.metadata.durationSec)}s · ${props.metadata.width ?? '-'}x${props.metadata.height ?? '-'}`
    : props.metadataLoading
      ? props.copy.metadataLoading
      : props.copy.metadataRequired;

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text-primary">{props.copy.sourceTitle}</h2>
          <p className="mt-1 text-sm text-text-secondary">{props.copy.sourceBody}</p>
        </div>
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-input bg-brand/10 text-brand">
          <Video className="h-4 w-4" />
        </span>
      </div>

      <label className="mt-4 block text-xs font-semibold uppercase tracking-micro text-text-muted">
        {props.copy.urlLabel}
      </label>
      <input
        className="mt-2 w-full rounded-input border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand"
        disabled={!props.isAuthenticated}
        onChange={(event) => props.onUrlChange(event.target.value)}
        placeholder={props.copy.urlPlaceholder}
        type="url"
        value={props.videoUrl}
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="inline-flex min-h-[40px] cursor-pointer items-center justify-center gap-2 rounded-input border border-border bg-surface px-3 py-2 text-sm font-semibold text-text-primary hover:bg-surface-hover">
          <Upload className="h-4 w-4" />
          {props.uploading ? props.copy.metadataLoading : props.copy.upload}
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
        <Button
          disabled={!props.isAuthenticated}
          onClick={() => props.onLibraryOpenChange(!props.libraryOpen)}
          size="sm"
          variant="outline"
        >
          {props.copy.library}
        </Button>
      </div>

      <p className="mt-3 text-xs text-text-secondary">{metadataLabel}</p>
      {props.source?.name ? <p className="mt-1 text-xs text-text-muted">{props.source.name}</p> : null}
      {props.sourceError ? <p className="mt-2 text-xs font-semibold text-danger">{props.sourceError}</p> : null}

      {props.libraryOpen ? (
        <div className="mt-4 rounded-card border border-border bg-bg p-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="rounded-input border border-border bg-surface px-3 py-2 text-sm"
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
              Refresh
            </Button>
          </div>
          {props.libraryError ? <p className="mt-2 text-xs text-danger">{props.libraryError}</p> : null}
          <div className="mt-3 grid max-h-80 gap-2 overflow-y-auto">
            {props.libraryLoading ? <p className="text-sm text-text-secondary">Loading...</p> : null}
            {!props.libraryLoading && !props.libraryAssets.length ? (
              <p className="text-sm text-text-secondary">{props.copy.recentEmpty}</p>
            ) : null}
            {props.libraryAssets.map((asset) => (
              <button
                className="flex items-center gap-3 rounded-input border border-border bg-surface p-2 text-left hover:bg-surface-hover"
                key={asset.id ?? asset.url}
                onClick={() => props.onLibrarySelect(asset)}
                type="button"
              >
                {asset.thumbUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt="" className="h-12 w-16 rounded object-cover" src={asset.thumbUrl} />
                ) : (
                  <span className="flex h-12 w-16 items-center justify-center rounded bg-surface-2">
                    <Video className="h-4 w-4 text-text-muted" />
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
    </Card>
  );
}
