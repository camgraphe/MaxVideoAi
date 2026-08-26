'use client';

import { useState, type FormEvent } from 'react';
import { CheckCircle2, Loader2, Upload } from 'lucide-react';

type MediaKind = 'image' | 'video' | 'audio';

type ReferenceUploadClientProps = {
  token: string;
  expiresAt: string;
  available: boolean;
  mediaKind: MediaKind;
  accepted: string[];
  maxBytes: number;
};

export function ReferenceUploadClient({
  token,
  expiresAt,
  available,
  mediaKind,
  accepted,
  maxBytes,
}: ReferenceUploadClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assetId, setAssetId] = useState<string | null>(null);
  const mediaLabel = mediaKind === 'audio' ? 'audio file' : mediaKind;
  const maxMB = Math.floor(maxBytes / (1024 * 1024));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || submitting || assetId) return;
    setSubmitting(true);
    setError(null);
    let activeUploadId: string | null = null;
    try {
      const fileSha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer())))
        .map((byte) => byte.toString(16).padStart(2, '0')).join('');
      const startResponse = await fetch(`/api/mcp/reference-upload/${encodeURIComponent(token)}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, declaredMime: file.type, sizeBytes: file.size, fileSha256 }),
        credentials: 'same-origin',
      });
      const start = await startResponse.json() as {
        ok?: boolean; uploadId?: string; chunkBytes?: number; totalParts?: number; error?: string;
      };
      if (!startResponse.ok || start.ok !== true || !start.uploadId || !start.chunkBytes || !start.totalParts) {
        if (start.error === 'FILE_TOO_LARGE') throw new Error(`This ${mediaLabel} is larger than ${maxMB} MB.`);
        if (start.error === 'UPLOAD_EXPIRED') throw new Error('This upload link has expired. Ask your assistant for a new one.');
        if (start.error === 'UPLOAD_ALREADY_USED') throw new Error('This upload link has already been used.');
        throw new Error(`The ${mediaLabel} could not be uploaded. Please try again.`);
      }
      activeUploadId = start.uploadId;
      for (let partNumber = 1; partNumber <= start.totalParts; partNumber += 1) {
        const chunk = file.slice((partNumber - 1) * start.chunkBytes, Math.min(partNumber * start.chunkBytes, file.size));
        const chunkBuffer = await chunk.arrayBuffer();
        const chunkSha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', chunkBuffer)))
          .map((byte) => byte.toString(16).padStart(2, '0')).join('');
        const partResponse = await fetch(`/api/mcp/reference-upload/${encodeURIComponent(token)}/part`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            'x-upload-id': start.uploadId,
            'x-part-number': String(partNumber),
            'x-content-sha256': chunkSha256,
          },
          body: chunkBuffer,
          credentials: 'same-origin',
        });
        if (!partResponse.ok) throw new Error(`The ${mediaLabel} could not be uploaded. Please try again.`);
      }
      const response = await fetch(`/api/mcp/reference-upload/${encodeURIComponent(token)}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId: start.uploadId }),
        credentials: 'same-origin',
      });
      const payload = await response.json() as { ok?: boolean; assetId?: string; error?: string };
      if (!response.ok || payload.ok !== true || !payload.assetId) {
        if (payload.error === 'FILE_TOO_LARGE') throw new Error(`This ${mediaLabel} is larger than ${maxMB} MB.`);
        if (payload.error === 'UNSUPPORTED_TYPE' || payload.error === 'REFERENCE_INVALID') {
          throw new Error(`Choose a supported ${mediaLabel}.`);
        }
        if (payload.error === 'UPLOAD_EXPIRED') throw new Error('This upload link has expired. Ask your assistant for a new one.');
        if (payload.error === 'UPLOAD_ALREADY_USED') throw new Error('This upload link has already been used.');
        throw new Error(`The ${mediaLabel} could not be uploaded. Please try again.`);
      }
      setAssetId(payload.assetId);
      activeUploadId = null;
    } catch (uploadError) {
      if (activeUploadId) {
        await fetch(`/api/mcp/reference-upload/${encodeURIComponent(token)}/abort`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uploadId: activeUploadId }), credentials: 'same-origin',
        }).catch(() => undefined);
      }
      setError(uploadError instanceof Error ? uploadError.message : `The ${mediaLabel} could not be uploaded.`);
    } finally {
      setSubmitting(false);
    }
  }

  if (assetId) {
    return (
      <div className="rounded-card border border-success/30 bg-success/10 p-5" role="status">
        <div className="flex items-center gap-3 text-success">
          <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
          <p className="font-semibold">Reference {mediaLabel} ready</p>
        </div>
        <p className="mt-3 text-sm leading-6 text-text-secondary">
          This private {mediaLabel} is saved to your connected MaxVideoAI library. Return to ChatGPT, Claude, or Codex so it can call <code className="font-mono text-text-primary">list_media</code> and use the file in your next request.
        </p>
        <p className="mt-3 break-all rounded-input bg-bg p-3 font-mono text-xs text-text-muted">
          {assetId}
        </p>
      </div>
    );
  }

  if (!available) {
    return (
      <div className="rounded-card border border-border bg-surface p-5">
        <p className="font-semibold text-text-primary">This upload link is no longer available.</p>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
          Return to ChatGPT, Claude, or Codex and ask it to create a new reference upload link.
        </p>
      </div>
    );
  }

  return (
    <form className="rounded-card border border-border bg-surface p-5 shadow-soft" onSubmit={submit}>
      <label className="block text-sm font-semibold text-text-primary" htmlFor="reference-media">
        Choose one reference {mediaLabel}
      </label>
      <p className="mt-1 text-sm leading-6 text-text-secondary">
        Maximum {maxMB} MB. The {mediaLabel} stays private in your MaxVideoAI library.
      </p>
      <label
        className="mt-4 flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-input border border-dashed border-border-strong bg-bg px-4 py-6 text-center transition hover:border-brand/60"
        htmlFor="reference-media"
      >
        <Upload className="h-7 w-7 text-brand" aria-hidden="true" />
        <span className="mt-2 text-sm font-medium text-text-primary">
          {file ? file.name : `Select a ${mediaLabel}`}
        </span>
        {file ? <span className="mt-1 text-xs text-text-muted">{Math.ceil(file.size / 1024)} KB</span> : null}
      </label>
      <input
        id="reference-media"
        className="sr-only"
        type="file"
        accept={accepted.join(',')}
        disabled={submitting}
        onChange={(event) => {
          const selected = event.target.files?.[0] ?? null;
          setError(selected && selected.size > maxBytes ? `This ${mediaLabel} is larger than ${maxMB} MB.` : null);
          setFile(selected && selected.size <= maxBytes ? selected : null);
        }}
      />
      {error ? <p className="mt-3 text-sm text-danger" role="alert">{error}</p> : null}
      <button
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-button bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
        type="submit"
        disabled={!file || submitting}
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        {submitting ? 'Uploading…' : 'Add to my private library'}
      </button>
      <p className="mt-3 text-center text-xs text-text-muted">
        Link expires {new Date(expiresAt).toLocaleString()} and works once.
      </p>
    </form>
  );
}
