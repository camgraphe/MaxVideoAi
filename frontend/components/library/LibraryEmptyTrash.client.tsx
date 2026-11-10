'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Trash2 } from 'lucide-react';
import { ownedAuthFetch } from '@/lib/owned-auth-fetch';
import { invalidateLibraryMedia } from '@/hooks/useLibraryCacheRevision';
import { useAccessibleModal } from '@/components/ui/useAccessibleModal';
import type { LibrarySelectionSnapshot } from '@/lib/library-browse';
import { libraryTrashCopy } from './library-trash-copy';

type Snapshot = Pick<LibrarySelectionSnapshot, 'id' | 'totalCount' | 'expiresAt'>;
type Result = { requestedCount: number; queuedCount: number; alreadyQueuedCount: number };
type Props = { userId: string; locale: string; disabled?: boolean; onRequested?: () => void };

/** The frozen scope is all Trash; visible filters and loaded selection never define deletion. */
export function LibraryEmptyTrash(props: Props) {
  return <OwnedLibraryEmptyTrash key={props.userId} {...props} />;
}

function OwnedLibraryEmptyTrash({ userId, locale, disabled, onRequested }: Props) {
  const copy = libraryTrashCopy(locale);
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  return <div className="library-trash-actions">
    <button type="button" className="library-empty-trash-trigger" disabled={disabled} onClick={() => { setResult(null); setOpen(true); }}>
      <Trash2 size={15} aria-hidden />{copy.action}
    </button>
    {result ? <p role="status" className="library-trash-result">
      {copy.requested(result.requestedCount)}{' '}{result.alreadyQueuedCount > 0 ? `${copy.alreadyQueued(result.alreadyQueuedCount)} ` : ''}{copy.retained}
    </p> : null}
    {open ? <EmptyTrashDialog userId={userId} locale={locale} onClose={() => setOpen(false)} onRequested={value => {
      setResult(value); setOpen(false); onRequested?.();
    }} /> : null}
  </div>;
}

function EmptyTrashDialog({ userId, locale, onClose, onRequested }: {
  userId: string; locale: string; onClose: () => void; onRequested: (result: Result) => void;
}) {
  const copy = libraryTrashCopy(locale);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [pending, setPending] = useState<'review' | 'delete' | null>('review');
  const [error, setError] = useState<'changed' | 'failure' | null>(null);
  const lifetime = useRef({ alive: true });
  const inFlight = useRef(false);
  const reviewRequest = useRef<AbortController | null>(null);
  const titleId = useId(), descriptionId = useId();
  const { dialogRef, onDialogKeyDown } = useAccessibleModal({ onClose, closeDisabled: pending === 'delete' });

  async function review() {
    if (inFlight.current) return;
    const context = lifetime.current;
    inFlight.current = true;
    const request = new AbortController();
    reviewRequest.current = request;
    setPending('review'); setError(null); setSnapshot(null);
    try {
      const response = await ownedAuthFetch('/api/media-library/selection', userId, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: request.signal,
        body: JSON.stringify({ scope: { view: 'all', kind: 'all', sort: 'recent', trash: true } }),
      });
      const body = await response.json(), next = body.snapshot;
      if (!response.ok || !body.ok || typeof next?.id !== 'string' || !next.id ||
        !Number.isSafeInteger(next.totalCount) || next.totalCount < 0 || !Number.isFinite(Date.parse(next.expiresAt))) throw new Error('REVIEW_FAILED');
      if (context.alive) setSnapshot({ id: next.id, totalCount: next.totalCount, expiresAt: next.expiresAt });
    } catch {
      if (context.alive) setError('failure');
    } finally {
      if (context.alive) { inFlight.current = false; setPending(null); }
    }
  }

  useEffect(() => {
    const context = { alive: true };
    lifetime.current = context;
    inFlight.current = false;
    void review();
    return () => { context.alive = false; reviewRequest.current?.abort(); };
    // This dialog has a single owner and lifetime; reopening explicitly obtains a new review.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function confirm() {
    if (inFlight.current || !snapshot || snapshot.totalCount === 0) return;
    if (Date.parse(snapshot.expiresAt) <= Date.now()) { setSnapshot(null); setError('changed'); return; }
    const context = lifetime.current;
    inFlight.current = true; setPending('delete'); setError(null);
    try {
      // An accepted request may finish after navigation. Publish only its initiating account.
      const response = await ownedAuthFetch('/api/media-library/trash/empty', userId, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshotId: snapshot.id, confirmation: 'empty-trash' }),
      });
      const body = await response.json();
      if (response.status === 409) {
        if (context.alive) { setSnapshot(null); setError('changed'); }
        return;
      }
      if (!response.ok || !body.ok || ![body.requestedCount, body.queuedCount, body.alreadyQueuedCount].every(n => Number.isSafeInteger(n) && n >= 0) ||
        body.requestedCount !== snapshot.totalCount || body.queuedCount + body.alreadyQueuedCount !== body.requestedCount) throw new Error('DELETE_UNCONFIRMED');
      invalidateLibraryMedia(userId);
      if (context.alive) onRequested(body);
    } catch {
      if (context.alive) { setSnapshot(null); setError('failure'); }
    } finally {
      if (context.alive) { inFlight.current = false; setPending(null); }
    }
  }

  return createPortal(<div className="app-experience library-trash-layer" onMouseDown={event => {
    if (event.target === event.currentTarget && pending !== 'delete') onClose();
  }}>
    <div className="library-trash-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId}
      aria-describedby={descriptionId} aria-busy={Boolean(pending)} tabIndex={-1} onKeyDown={onDialogKeyDown}>
      <h2 id={titleId}>{copy.title}</h2>
      <div id={descriptionId}>
        <p>{copy.scope}</p>
        <p>{copy.irreversible}</p>
        <p>{copy.studio}</p>
        <p>{copy.retained}</p>
      </div>
      {pending ? <p role="status">{pending === 'review' ? copy.loading : copy.pending}</p> : null}
      {snapshot ? <strong className="library-trash-count">{snapshot.totalCount ? copy.total(snapshot.totalCount) : copy.empty}</strong> : null}
      {error ? <p role="alert">{copy[error]}</p> : null}
      <div className="library-trash-dialog-actions">
        <button type="button" data-modal-initial-focus="true" disabled={pending === 'delete'} onClick={onClose}>{copy.cancel}</button>
        {error ? <button type="button" disabled={Boolean(pending)} onClick={() => void review()}>{copy.review}</button> : null}
        {snapshot && snapshot.totalCount > 0 ? <button type="button" className="library-trash-confirm" disabled={Boolean(pending)} onClick={() => void confirm()}>{copy.confirm(snapshot.totalCount)}</button> : null}
      </div>
    </div>
  </div>, document.body);
}
