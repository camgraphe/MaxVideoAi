'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';

type Reason = 'copyright' | 'privacy' | 'defamation' | 'trademark' | 'other';

export type TakedownFormCopy = {
  emailLabel: string;
  urlLabel: string;
  urlPlaceholder: string;
  reasonLabel: string;
  reasons: Record<Reason, string>;
  detailsLabel: string;
  detailsPlaceholder: string;
  detailsHint: string;
  attachmentLabel: string;
  attachmentError: string;
  errors: { submit: string };
  success: string;
  submitLabel: string;
  submittingLabel: string;
};

export function TakedownForm({ copy }: { copy: TakedownFormCopy }) {
  const [email, setEmail] = useState('');
  const [url, setUrl] = useState('');
  const [reason, setReason] = useState<Reason>('copyright');
  const [details, setDetails] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'submitting') return;

    setStatus('submitting');
    setError(null);

    let attachmentBase64: string | undefined;
    let attachmentName: string | undefined;
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setError(copy.attachmentError);
        setStatus('idle');
        return;
      }
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      const chunkSize = 0x8000;
      for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        const slice = bytes.subarray(offset, offset + chunkSize);
        binary += String.fromCharCode(...slice);
      }
      attachmentBase64 = btoa(binary);
      attachmentName = file.name;
    }

    try {
      const res = await fetch('/api/legal/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          url,
          reason,
          details,
          attachmentName,
          attachmentBase64,
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error ?? copy.errors.submit);
      }

      setStatus('success');
      setEmail('');
      setUrl('');
      setReason('copyright');
      setDetails('');
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.errors.submit);
      setStatus('error');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="stack-gap-lg rounded-card border border-border bg-surface p-6 shadow-card">
      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-medium text-text-primary">
          {copy.emailLabel}
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded border border-border bg-input px-3 py-2 text-sm text-text-primary focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="url" className="block text-sm font-medium text-text-primary">
          {copy.urlLabel}
        </label>
        <input
          id="url"
          type="url"
          required
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder={copy.urlPlaceholder}
          className="w-full rounded border border-border bg-input px-3 py-2 text-sm text-text-primary focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="reason" className="block text-sm font-medium text-text-primary">
          {copy.reasonLabel}
        </label>
        <select
          id="reason"
          value={reason}
          onChange={(event) => setReason(event.target.value as Reason)}
          className="w-full rounded border border-border bg-input px-3 py-2 text-sm text-text-primary focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {(
            [
              ['copyright', copy.reasons.copyright],
              ['privacy', copy.reasons.privacy],
              ['defamation', copy.reasons.defamation],
              ['trademark', copy.reasons.trademark],
              ['other', copy.reasons.other],
            ] as Array<[Reason, string]>
          ).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label htmlFor="details" className="block text-sm font-medium text-text-primary">
          {copy.detailsLabel}
        </label>
        <textarea
          id="details"
          required
          minLength={20}
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          rows={5}
          className="w-full rounded border border-border bg-input px-3 py-2 text-sm text-text-primary focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder={copy.detailsPlaceholder}
        />
        <p className="text-xs text-text-muted">{copy.detailsHint}</p>
      </div>

      <div className="space-y-2">
        <label htmlFor="attachment" className="block text-sm font-medium text-text-primary">
          {copy.attachmentLabel}
        </label>
        <input
          id="attachment"
          type="file"
          accept=".pdf,.txt,.png,.jpg,.jpeg"
          onChange={(event) => {
            const next = event.target.files?.[0] ?? null;
            setFile(next ?? null);
          }}
          className="block w-full text-sm text-text-secondary file:mr-4 file:rounded file:border-0 file:bg-brand file:px-4 file:py-2 file:text-sm file:font-semibold file:text-on-brand hover:file:bg-brandHover"
        />
      </div>

      {error ? <p className="text-sm text-error">{error}</p> : null}
      {status === 'success' ? <p className="text-sm text-success">{copy.success}</p> : null}

      <Button
        type="submit"
        disabled={status === 'submitting'}
        className="px-4 text-sm font-semibold"
      >
        {status === 'submitting' ? copy.submittingLabel : copy.submitLabel}
      </Button>
    </form>
  );
}
