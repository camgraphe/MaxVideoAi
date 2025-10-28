'use client';

import { useState } from 'react';

type Reason = 'copyright' | 'privacy' | 'defamation' | 'trademark' | 'other';

export function TakedownForm() {
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
        setError('Attachments must be smaller than 2 MB.');
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
        throw new Error(payload?.error ?? 'Unable to submit report.');
      }

      setStatus('success');
      setEmail('');
      setUrl('');
      setReason('copyright');
      setDetails('');
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit report.');
      setStatus('error');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-card border border-border bg-white p-6 shadow-card">
      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-medium text-text-primary">
          Contact email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded border border-border bg-input px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="url" className="block text-sm font-medium text-text-primary">
          URL of the content
        </label>
        <input
          id="url"
          type="url"
          required
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://maxvideoai.com/v/..."
          className="w-full rounded border border-border bg-input px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="reason" className="block text-sm font-medium text-text-primary">
          Reason
        </label>
        <select
          id="reason"
          value={reason}
          onChange={(event) => setReason(event.target.value as Reason)}
          className="w-full rounded border border-border bg-input px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
        >
          <option value="copyright">Copyright / IP infringement</option>
          <option value="privacy">Privacy / Personal data</option>
          <option value="defamation">Defamation</option>
          <option value="trademark">Trademark violation</option>
          <option value="other">Other unlawful content</option>
        </select>
      </div>

      <div className="space-y-2">
        <label htmlFor="details" className="block text-sm font-medium text-text-primary">
          Details
        </label>
        <textarea
          id="details"
          required
          minLength={20}
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          rows={5}
          className="w-full rounded border border-border bg-input px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
          placeholder="Describe the issue and why it breaches your rights or the law."
        />
        <p className="text-xs text-text-muted">Provide enough information for us to locate and assess the content.</p>
      </div>

      <div className="space-y-2">
        <label htmlFor="attachment" className="block text-sm font-medium text-text-primary">
          Supporting file (optional, max 2&nbsp;MB)
        </label>
        <input
          id="attachment"
          type="file"
          accept=".pdf,.txt,.png,.jpg,.jpeg"
          onChange={(event) => {
            const next = event.target.files?.[0] ?? null;
            setFile(next ?? null);
          }}
          className="block w-full text-sm text-text-secondary file:mr-4 file:rounded file:border-0 file:bg-accent file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-accentSoft"
        />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {status === 'success' ? (
        <p className="text-sm text-green-600">Thank you. We have received your report and will follow up shortly.</p>
      ) : null}

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="inline-flex items-center justify-center rounded bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accentSoft disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === 'submitting' ? 'Sending…' : 'Submit report'}
      </button>
    </form>
  );
}
