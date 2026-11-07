'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { authFetch } from '@/lib/authFetch';
import { MAX_MARKETING_IMPORT_BODY_BYTES, type MarketingImportPreview } from '@/lib/marketing-media';

const endpoint = '/api/admin/marketing-media/import';
const sizeError = 'Choose a JSON manifest that fits within the 2 MiB import limit.';

async function send(path: string, body: string, signal?: AbortSignal) {
  if (new TextEncoder().encode(body).byteLength > MAX_MARKETING_IMPORT_BODY_BYTES) throw new Error(sizeError);
  const response = await authFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    signal,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) throw new Error(payload?.error ?? 'The operation failed. Please retry.');
  return payload;
}

export function MarketingPublicationImport({
  disabled, onBusyChange, onSettled,
}: {
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
  onSettled: (imported: boolean) => Promise<void>;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const previewRequest = useRef<AbortController | null>(null);
  const importingNow = useRef(false);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selection, setSelection] = useState<{ manifest: unknown; preview: MarketingImportPreview } | null>(null);
  const [permission, setPermission] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => () => previewRequest.current?.abort(), []);

  async function previewFile(file: File | undefined) {
    if (importingNow.current) return;
    previewRequest.current?.abort();
    setSelection(null);
    setPermission(false);
    setError(null);
    setNotice(null);
    if (!file || file.size > MAX_MARKETING_IMPORT_BODY_BYTES) {
      setPreviewing(false);
      if (file) setError(sizeError);
      return;
    }
    const controller = new AbortController();
    previewRequest.current = controller;
    setPreviewing(true);
    try {
      const manifest: unknown = await file.text().then(text => {
        try { return JSON.parse(text); } catch { throw new Error('Choose a valid JSON publication manifest.'); }
      });
      if (controller.signal.aborted) return;
      const { preview } = await send(endpoint + '?preview=1', JSON.stringify({ manifest, permissionConfirmed: false }), controller.signal);
      if (!controller.signal.aborted) setSelection({ manifest, preview });
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Unable to preview this manifest.');
    } finally {
      if (!controller.signal.aborted) setPreviewing(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || importingNow.current || !selection || !permission) return;
    importingNow.current = true;
    setImporting(true);
    onBusyChange(true);
    setError(null);
    setNotice(null);
    let successNotice: string | null = null;
    try {
      const { item } = await send(endpoint, JSON.stringify({ manifest: selection.manifest, permissionConfirmed: true }));
      successNotice = item.visibility === 'public'
        ? 'This publication is already public. Its existing copy was kept.'
        : 'Private copy saved. Review it in the site library before publishing.';
      setSelection(null);
      setPermission(false);
      if (fileInput.current) fileInput.current.value = '';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to import this publication.');
    } finally {
      try {
        await onSettled(successNotice !== null);
        setNotice(successNotice);
      } finally {
        importingNow.current = false;
        setImporting(false);
        onBusyChange(false);
      }
    }
  }

  return (
    <form className="mt-3 grid gap-3" onSubmit={event => void submit(event)}>
      <p className="text-sm text-text-secondary">Choose an exported public publication. To retry an incomplete import, use the same manifest.</p>
      <label className="grid gap-1 text-sm font-medium">
        Publication manifest
        <input ref={fileInput} type="file" accept=".json,application/json" disabled={disabled || importing}
          className="w-full min-w-0 rounded-input border border-border bg-bg p-2"
          onChange={event => void previewFile(event.currentTarget.files?.[0])} />
      </label>
      {previewing ? <p role="status" className="text-sm text-text-secondary">Validating manifest…</p> : null}
      {selection ? (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-lg border border-border p-3 text-sm sm:grid-cols-4">
          <div className="col-span-2 min-w-0"><dt>Publication</dt><dd className="break-words font-semibold">{selection.preview.name}</dd>
            <dd className="break-all text-xs text-text-muted">{selection.preview.videoId}</dd></div>
          <div><dt>Duration</dt><dd>{selection.preview.durationSec} seconds</dd></div>
          <div><dt>Resolution</dt><dd>{selection.preview.resolution ?? 'Not specified'}</dd></div>
          <div><dt>Required files</dt><dd>{selection.preview.fileCount}</dd></div>
        </dl>
      ) : null}
      <label className="flex items-start gap-2 text-sm text-text-secondary">
        <input type="checkbox" className="mt-1" checked={permission} disabled={disabled || importing || !selection}
          onChange={event => setPermission(event.target.checked)} />
        I have permission to copy this public video, its prompt and all reference media.
      </label>
      <div><Button type="submit" disabled={disabled || importing || !selection || !permission}>
        {importing ? 'Importing…' : 'Import private copy'}
      </Button></div>
      {error ? <p role="alert" className="rounded-lg border border-error-border bg-error-bg p-3 text-sm text-error">{error}</p> : null}
      {notice ? <p role="status" className="text-sm text-text-secondary">{notice}</p> : null}
    </form>
  );
}
