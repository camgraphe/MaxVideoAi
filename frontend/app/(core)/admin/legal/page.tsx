'use client';

import useSWR from 'swr';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';

const fetchJson = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return (await res.json()) as T;
};

type LegalDocument = {
  key: 'terms' | 'privacy' | 'cookies';
  title: string;
  version: string;
  url: string;
  publishedAt: string | null;
};

type DocumentsResponse = {
  ok: boolean;
  documents: LegalDocument[];
  reconsent: { mode: 'soft' | 'hard'; graceDays: number };
};

type UpdateResponse = {
  ok: boolean;
  document: LegalDocument | null;
  error?: string;
};

const DEFAULT_TITLES: Record<LegalDocument['key'], string> = {
  terms: 'Terms of Service',
  privacy: 'Privacy Policy',
  cookies: 'Cookie Policy',
};

function toDateInput(value: string | null): string {
  if (!value) return '';
  return value.slice(0, 10);
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function AdminLegalPage() {
  const { data, error, isLoading, mutate } = useSWR<DocumentsResponse>('/api/admin/legal/documents', fetchJson);
  const [status, setStatus] = useState<string | null>(null);

  const docs = data?.documents ?? [];

  useEffect(() => {
    if (error) {
      setStatus(error.message || 'Failed to load legal documents.');
    }
  }, [error]);

  const handleUpdate = async (doc: LegalDocument, payload: { version: string; title?: string; url?: string; publishedAt?: string | null }) => {
    setStatus(null);
    try {
      const res = await fetch(`/api/admin/legal/documents/${doc.key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => null)) as UpdateResponse | null;
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? 'Failed to update document');
      }
      await mutate();
      setStatus(`${DEFAULT_TITLES[doc.key]} updated to version ${payload.version}.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to update document');
    }
  };

  const reconsent = data?.reconsent ?? { mode: 'soft' as const, graceDays: 14 };

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  return (
    <div className="stack-gap-lg">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-text-primary">Legal documents</h2>
        <p className="text-sm text-text-secondary">
          Update legal versions to trigger re-consent. Current mode: <span className="font-medium text-text-primary">{reconsent.mode.toUpperCase()}</span>{' '}
          {reconsent.mode === 'soft' ? `(grace period ${reconsent.graceDays} days)` : null}.
        </p>
        <p className="text-xs text-text-secondary">
          Need a consent ledger?{' '}
          <a
            href={`/admin/consents.csv?from=${today}`}
            className="font-semibold text-brand underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Download CSV export
          </a>
          .
        </p>
      </div>

      {status ? (
        <div className="rounded-lg border border-border bg-bg px-4 py-3 text-sm text-text-secondary">{status}</div>
      ) : null}

      {isLoading ? (
        <div className="rounded-xl border border-hairline bg-white p-6 text-sm text-text-secondary shadow-card">Loading…</div>
      ) : error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
          {error.message || 'Failed to load legal documents.'}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-hairline bg-white shadow-card">
          <table className="min-w-full divide-y divide-hairline text-sm">
            <thead className="bg-neutral-50 text-text-secondary">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Document</th>
                <th className="px-4 py-3 text-left font-medium">Version</th>
                <th className="px-4 py-3 text-left font-medium">Published</th>
                <th className="px-4 py-3 text-left font-medium">URL</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {docs.map((doc) => (
                <DocumentRow key={doc.key} doc={doc} onUpdate={handleUpdate} defaultDate={today} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

type DocumentRowProps = {
  doc: LegalDocument;
  onUpdate: (doc: LegalDocument, payload: { version: string; title?: string; url?: string; publishedAt?: string | null }) => Promise<void>;
  defaultDate: string;
};

function DocumentRow({ doc, onUpdate, defaultDate }: DocumentRowProps) {
  const [version, setVersion] = useState(doc.version);
  const [title, setTitle] = useState(doc.title);
  const [url, setUrl] = useState(doc.url);
  const [publishedAt, setPublishedAt] = useState(toDateInput(doc.publishedAt) || defaultDate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setVersion(doc.version);
    setTitle(doc.title);
    setUrl(doc.url);
    setPublishedAt(toDateInput(doc.publishedAt) || defaultDate);
  }, [doc, defaultDate]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!version.trim()) {
      setError('Version is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onUpdate(doc, {
        version: version.trim(),
        title: title.trim() || undefined,
        url: url.trim() || undefined,
        publishedAt: publishedAt ? new Date(publishedAt).toISOString() : null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update document');
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="align-top">
      <td className="px-4 py-3">
        <div className="font-semibold text-text-primary">{DEFAULT_TITLES[doc.key]}</div>
        <p className="text-xs text-text-secondary">Key: {doc.key}</p>
      </td>
      <td className="px-4 py-3">
        <input
          type="text"
          value={version}
          onChange={(event) => setVersion(event.target.value)}
          className="w-full rounded-input border border-border bg-bg px-2 py-1 text-sm"
          placeholder="YYYY-MM-DD"
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="date"
          value={publishedAt}
          onChange={(event) => setPublishedAt(event.target.value)}
          className="w-full rounded-input border border-border bg-bg px-2 py-1 text-sm"
        />
        <p className="mt-1 text-xs text-text-muted">{formatDate(doc.publishedAt)}</p>
      </td>
      <td className="px-4 py-3">
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="mb-2 w-full rounded-input border border-border bg-bg px-2 py-1 text-sm"
          placeholder="Title"
        />
        <input
          type="text"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          className="w-full rounded-input border border-border bg-bg px-2 py-1 text-sm"
          placeholder="/legal/terms"
        />
      </td>
      <td className="px-4 py-3 text-right">
        <form onSubmit={handleSubmit} className="space-y-2">
          <Button
            type="submit"
            size="sm"
            disabled={saving}
            className="w-full px-3 text-sm font-semibold"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
          {error ? <p className="text-xs text-state-warning">{error}</p> : null}
        </form>
      </td>
    </tr>
  );
}
