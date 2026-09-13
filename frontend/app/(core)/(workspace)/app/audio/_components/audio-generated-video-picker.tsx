'use client';

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAccessibleModal } from '@/components/ui/useAccessibleModal';
import { LibraryImageThumbnail } from '@/components/library/LibraryImageThumbnail.client';
import { AppGlyph } from '@/components/app/AppGlyph';
import { referencePickerCopy } from '@/components/library/reference-picker-copy';
import { formatAudioDurationLabel } from '@/lib/audio-generation';
import { formatDateTime } from '../_lib/audio-workspace-helpers';
import type { GeneratedSourceVideo } from '../_lib/audio-workspace-types';
import type { AudioWorkspaceCopy } from '../copy';

type PickerProps = {
  open: boolean;
  videos: GeneratedSourceVideo[];
  isLoading: boolean;
  error: string | null;
  locale: string;
  copy: AudioWorkspaceCopy;
  onClose: () => void;
  onSelect: (video: GeneratedSourceVideo) => void | Promise<void>;
};

export function AudioGeneratedVideoPickerModal(props: PickerProps) {
  return props.open ? <OpenAudioGeneratedVideoPicker {...props} /> : null;
}

function OpenAudioGeneratedVideoPicker({ videos, isLoading, error, locale, copy, onClose, onSelect }: PickerProps) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const pending = useRef(false);
  const close = () => { if (!pending.current) onClose(); };
  const { dialogRef, onDialogKeyDown } = useAccessibleModal({ onClose: close, closeDisabled: pendingId !== null });
  const pickerCopy = referencePickerCopy(locale);
  const filtered = videos.filter(video => `${video.label} ${video.aspectRatio ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()));
  return createPortal(<div className="app-experience app-library-picker-layer" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={copy.picker.title} tabIndex={-1} onKeyDown={onDialogKeyDown} className="app-reference-picker" aria-busy={pendingId !== null}>
      <header className="app-picker-heading"><div><h2>{copy.picker.title}</h2><p>{copy.picker.description}</p></div><button type="button" data-modal-initial-focus="true" disabled={pendingId !== null} aria-label={copy.picker.close} onClick={close}>×</button></header>
      <div className="app-picker-filters app-picker-search-only"><input type="search" value={query} onChange={event => setQuery(event.target.value)} aria-label={pickerCopy.search} placeholder={pickerCopy.search} disabled={pendingId !== null} /></div>
      <div className="app-picker-body app-scroll-surface">
        {error || failure ? <p role="alert" className="app-picker-error">{error ?? failure}</p> : null}
        {isLoading && !videos.length ? <div className="app-picker-grid">{Array.from({ length: 4 }, (_, index) => <div key={index} className="app-picker-skeleton skeleton" />)}</div> : null}
        {!isLoading && !filtered.length ? <p className="app-picker-empty">{copy.picker.empty}</p> : null}
        <div className="app-picker-grid">{filtered.map(video => <button key={video.jobId} type="button" className="app-picker-card" aria-pressed={pendingId === video.jobId} disabled={pendingId !== null} title={formatDateTime(video.createdAt, locale)}
          onClick={async () => {
            if (pending.current) return;
            pending.current = true; setPendingId(video.jobId); setFailure(null);
            try { await onSelect(video); } catch { setFailure(pickerCopy.error); } finally { pending.current = false; setPendingId(null); }
          }}>
          <span className="app-picker-cover">{video.thumbUrl ? <LibraryImageThumbnail asset={{ url: video.thumbUrl }} /> : <AppGlyph name="video" />}<span className="app-picker-check" aria-hidden>{pendingId === video.jobId ? '✓' : '+'}</span></span>
          <span className="app-picker-card-meta"><span>{video.label}</span><span>{video.durationSec ? formatAudioDurationLabel(video.durationSec) : copy.source.durationPending}{video.aspectRatio ? ` · ${video.aspectRatio}` : ''}</span>{video.hasAudio ? <span>{copy.picker.audioBadge}</span> : null}<span className="sr-only">{formatDateTime(video.createdAt, locale)}</span></span>
        </button>)}</div>
      </div>
      <footer className="app-picker-footer"><div className="app-picker-selection" role="status">{pendingId ? pickerCopy.busy : pickerCopy.instant}</div><div className="app-picker-footer-actions"><button type="button" disabled={pendingId !== null} onClick={close}>{copy.picker.close}</button></div></footer>
    </div>
  </div>, document.body);
}
