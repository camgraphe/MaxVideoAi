'use client';

import { useEffect, useMemo, useState } from 'react';
import { FileBadge2, FileText, ShieldCheck, TimerReset } from 'lucide-react';
import useSWR from 'swr';
import { AdminEmptyState } from '@/components/admin-system/feedback/AdminEmptyState';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { AdminSectionMeta } from '@/components/admin-system/shell/AdminSectionMeta';
import { AdminDataTable } from '@/components/admin-system/surfaces/AdminDataTable';
import { type AdminMetricItem, AdminMetricGrid } from '@/components/admin-system/surfaces/AdminMetricGrid';
import { Button, ButtonLink } from '@/components/ui/Button';

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

type StatusState = {
  tone: 'success' | 'error';
  message: string;
} | null;

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
  const [status, setStatus] = useState<StatusState>(null);

  const docs = useMemo(() => data?.documents ?? [], [data?.documents]);
  const reconsent = useMemo(
    () => data?.reconsent ?? { mode: 'soft' as const, graceDays: 14 },
    [data?.reconsent]
  );
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const metrics = useMemo(() => buildLegalMetrics(docs, reconsent), [docs, reconsent]);

  useEffect(() => {
    if (error) {
      setStatus({ tone: 'error', message: error.message || 'Failed to load legal documents.' });
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
      setStatus({ tone: 'success', message: `${DEFAULT_TITLES[doc.key]} updated to version ${payload.version}.` });
    } catch (err) {
      setStatus({ tone: 'error', message: err instanceof Error ? err.message : 'Failed to update document' });
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        eyebrow="Compliance"
        title="Legal documents"
        description="Pilote les versions légales et la politique de re-consentement. Cette surface sert à publier les nouvelles versions sans perdre la lisibilité opérationnelle."
        actions={
          <>
            <ButtonLink href={`/admin/consents.csv?from=${today}`} variant="outline" size="sm" prefetch={false} className="border-border bg-surface">
              Consent CSV
            </ButtonLink>
            <ButtonLink href="/admin/marketing" variant="outline" size="sm" className="border-border bg-surface">
              Marketing
            </ButtonLink>
          </>
        }
      />

      <AdminSection
        title="Compliance Pulse"
        description="Lecture courte de l’état des documents publiés et du mode de re-consentement actif."
      >
        <AdminMetricGrid items={metrics} columnsClassName="sm:grid-cols-2 xl:grid-cols-4" density="compact" />
      </AdminSection>

      <AdminNotice tone={reconsent.mode === 'hard' ? 'warning' : 'info'}>
        Current re-consent mode is <strong>{reconsent.mode.toUpperCase()}</strong>
        {reconsent.mode === 'soft' ? ` with a ${reconsent.graceDays}-day grace period.` : '. Members must accept again on next access.'}
      </AdminNotice>

      {status ? (
        <AdminNotice tone={status.tone === 'success' ? 'success' : 'error'}>
          {status.message}
        </AdminNotice>
      ) : null}

      <AdminSection
        title="Document Registry"
        description="Mets à jour version, date de publication et URL publique pour chaque document piloté par le consentement."
        action={
          <AdminSectionMeta
            title={`${docs.length} tracked documents`}
            lines={[
              docs.length ? `${docs.filter((doc) => Boolean(doc.publishedAt)).length} already published` : 'No document data loaded',
              'Saving triggers the legal update endpoint immediately',
            ]}
          />
        }
      >
        {isLoading ? (
          <div className="rounded-xl border border-hairline bg-surface p-6 text-sm text-text-secondary">Loading…</div>
        ) : error ? (
          <AdminNotice tone="error">{error.message || 'Failed to load legal documents.'}</AdminNotice>
        ) : docs.length ? (
          <AdminDataTable>
            <thead className="bg-surface">
              <tr className="text-[11px] uppercase tracking-[0.18em] text-text-muted">
                <th className="px-4 py-3 font-semibold">Document</th>
                <th className="px-4 py-3 font-semibold">Version</th>
                <th className="px-4 py-3 font-semibold">Published</th>
                <th className="px-4 py-3 font-semibold">URL</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline bg-bg/30">
              {docs.map((doc) => (
                <DocumentRow key={doc.key} doc={doc} onUpdate={handleUpdate} defaultDate={today} />
              ))}
            </tbody>
          </AdminDataTable>
        ) : (
          <AdminEmptyState>No legal documents are configured yet.</AdminEmptyState>
        )}
      </AdminSection>
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
    <tr className="align-top text-text-secondary">
      <td className="px-4 py-3">
        <div className="font-semibold text-text-primary">{DEFAULT_TITLES[doc.key]}</div>
        <p className="text-xs text-text-muted">Key: {doc.key}</p>
      </td>
      <td className="px-4 py-3">
        <input
          type="text"
          value={version}
          onChange={(event) => setVersion(event.target.value)}
          className="w-full rounded-input border border-border bg-bg px-2 py-1 text-sm text-text-primary"
          placeholder="YYYY-MM-DD"
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="date"
          value={publishedAt}
          onChange={(event) => setPublishedAt(event.target.value)}
          className="w-full rounded-input border border-border bg-bg px-2 py-1 text-sm text-text-primary"
        />
        <p className="mt-1 text-xs text-text-muted">{formatDate(doc.publishedAt)}</p>
      </td>
      <td className="px-4 py-3">
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="mb-2 w-full rounded-input border border-border bg-bg px-2 py-1 text-sm text-text-primary"
          placeholder="Title"
        />
        <input
          type="text"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          className="w-full rounded-input border border-border bg-bg px-2 py-1 text-sm text-text-primary"
          placeholder="/legal/terms"
        />
      </td>
      <td className="px-4 py-3 text-right">
        <form onSubmit={handleSubmit} className="space-y-2">
          <Button type="submit" size="sm" disabled={saving} className="w-full px-3 text-sm font-semibold">
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
          {error ? <p className="text-xs text-warning">{error}</p> : null}
        </form>
      </td>
    </tr>
  );
}

function buildLegalMetrics(
  docs: LegalDocument[],
  reconsent: DocumentsResponse['reconsent']
): AdminMetricItem[] {
  const publishedCount = docs.filter((doc) => Boolean(doc.publishedAt)).length;
  const latestPublishedAt =
    docs
      .map((doc) => doc.publishedAt)
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;

  return [
    {
      label: 'Documents',
      value: String(docs.length),
      helper: 'Tracked legal surfaces inside the registry',
      icon: FileText,
    },
    {
      label: 'Published',
      value: String(publishedCount),
      helper: `${docs.length - publishedCount} still missing a publish timestamp`,
      tone: publishedCount === docs.length && docs.length > 0 ? 'success' : 'info',
      icon: ShieldCheck,
    },
    {
      label: 'Re-consent',
      value: reconsent.mode.toUpperCase(),
      helper: reconsent.mode === 'soft' ? `${reconsent.graceDays} day grace period` : 'Immediate re-acceptance required',
      tone: reconsent.mode === 'hard' ? 'warning' : 'default',
      icon: TimerReset,
    },
    {
      label: 'Latest publish',
      value: latestPublishedAt ? formatDate(latestPublishedAt) : '—',
      helper: 'Most recent document publication date',
      icon: FileBadge2,
    },
  ];
}
