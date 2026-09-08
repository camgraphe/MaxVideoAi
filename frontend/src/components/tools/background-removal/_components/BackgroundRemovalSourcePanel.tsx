/* eslint-disable @next/next/no-img-element */
import { useI18n } from '@/lib/i18n/I18nProvider';
import { ToolSourceInput } from '../../ToolWorkbench';
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
  running?: boolean;
  videoUrl: string;
}) {
  const { locale } = useI18n();
  return <div className="order-1 w-full">
    <ToolSourceInput locale={locale} kind="video" url={props.videoUrl} name={props.source?.name} disabled={!props.isAuthenticated || props.running} uploading={props.uploading} onUpload={event => { props.onFileUpload(event.target.files?.[0]); event.currentTarget.value = ''; }} onLibrary={() => props.onLibraryOpenChange(!props.libraryOpen)} onUrlChange={props.onUrlChange} />
    {props.sourceError ? <p role="alert" className="mb-4 text-xs text-danger">{props.sourceError}</p> : null}
    {props.metadataLoading ? <p role="status" className="mb-4 text-xs text-text-secondary">{props.copy.metadataLoading}</p> : null}
    {props.libraryOpen ? <section className="mb-4 rounded-xl border border-border p-3" aria-label={props.copy.library}>
      <div className="flex flex-wrap gap-2"><label className="min-w-0 flex-1"><span className="sr-only">{props.copy.library}</span><select className="w-full rounded-lg border border-border bg-surface px-2 text-xs" value={props.librarySource} onChange={event => props.onLibrarySourceChange(event.target.value)}>{props.librarySourceOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><button type="button" className="px-2 text-xs" onClick={props.onLibraryRefresh}>{props.copy.libraryRefresh}</button></div>
      {props.libraryError ? <p role="alert" className="my-2 text-xs text-danger">{props.libraryError}</p> : null}
      {props.libraryLoading ? <p role="status" className="my-2 text-xs">{props.copy.metadataLoading}</p> : !props.libraryAssets.length ? <p className="my-3 text-xs text-text-secondary">{props.copy.recentEmpty}</p> : <div className="mt-3 grid max-h-80 gap-2 overflow-y-auto">{props.libraryAssets.map(asset => <button type="button" disabled={props.running} key={asset.id ?? asset.url} onClick={() => props.onLibrarySelect(asset)} className="flex min-w-0 items-center gap-3 rounded-lg border border-border p-2 text-left hover:border-brand">
        {asset.thumbUrl ? <img alt="" loading="lazy" className="h-12 w-16 rounded-md object-cover" src={asset.thumbUrl} /> : <span aria-hidden="true" className="grid h-12 w-16 place-content-center rounded-md bg-surface-2">▷</span>}
        <span className="min-w-0 truncate text-xs">{asset.name ?? asset.id ?? props.copy.sourceTitle}</span>
      </button>)}</div>}
    </section> : null}
  </div>;
}
