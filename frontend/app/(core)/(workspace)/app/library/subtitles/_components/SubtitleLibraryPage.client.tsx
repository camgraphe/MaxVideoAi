'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { HeaderBar } from '@/components/HeaderBar';
import { AppSidebar } from '@/components/AppSidebar';
import { MediaVisitorIntro } from '@/components/library/MediaVisitorIntro.client';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { authFetch } from '@/lib/authFetch';
import { creatorWorkspaceCopy } from '@/components/tools/creator/creator-workspace-copy';

type DocumentSummary = { id: string; revision: number; language: string; excerpt: string; durationMs: number; updatedAt: string };
export function SubtitleLibraryPage() {
  const { user, loading } = useRequireAuth({ redirectIfLoggedOut: false });
  const { locale } = useI18n(), copy = creatorWorkspaceCopy(locale);
  return <div className="flex min-h-screen flex-col bg-bg"><HeaderBar /><div className="flex min-h-0 flex-1"><AppSidebar />
    <main className="min-w-0 flex-1 p-5 lg:p-7">
      {loading ? <p role="status">{copy.loading}</p> : !user ? <MediaVisitorIntro locale={locale} nextPath="/app/library/subtitles" />
        : <SubtitleLibraryList key={user.id} locale={locale} />}
    </main></div></div>;
}
function SubtitleLibraryList({ locale }: { locale: string }) {
  const copy = creatorWorkspaceCopy(locale);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]), [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null), [busy, setBusy] = useState(true), [failed, setFailed] = useState(false), [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setBusy(true); setFailed(false);
    const params = new URLSearchParams({ limit: '30' }); if (cursor) params.set('cursor', cursor);
    void authFetch(`/api/tools/subtitles/documents?${params}`, { signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok || !data.ok || !Array.isArray(data.documents)) throw new Error('DOCUMENTS_UNAVAILABLE');
      if (controller.signal.aborted) return;
      setDocuments(previous => cursor ? [...new Map([...previous, ...data.documents].map(document => [document.id, document])).values()] : data.documents);
      setNextCursor(data.nextCursor ?? null);
    }).catch(() => { if (!controller.signal.aborted) setFailed(true); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [cursor, retry]);
  return <div className="mx-auto max-w-5xl">
    <Link href="/app/library" prefetch={false} className="inline-flex min-h-11 items-center text-sm text-text-secondary">← {locale.startsWith('fr') ? 'Médias' : locale.startsWith('es') ? 'Medios' : 'Media'}</Link>
    <div className="my-5 flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-semibold">{copy.recentDocuments}</h1>
      <button type="button" className="min-h-11 rounded-lg border border-border px-4" disabled={busy} onClick={() => { setCursor(null); setRetry(value => value + 1); }}>{copy.retry}</button>
    </div>
    {failed ? <p role="alert" className="my-4">{copy.error}</p> : null}
    {busy ? <p role="status">{copy.loading}</p> : null}
    {!busy && !failed && !documents.length ? <p>{copy.noDocuments}</p> : null}
    <ul className="grid gap-4 md:grid-cols-2">{documents.map(document => {
      const params = new URLSearchParams({ document: document.id, revision: String(document.revision) });
      const download = (format: string) => `/api/tools/subtitles/documents/${encodeURIComponent(document.id)}/download?format=${format}&revision=${document.revision}`;
      return <li key={document.id} className="min-w-0 rounded-xl border border-border bg-surface p-5">
        <p className="mb-3 break-words text-lg">{document.excerpt || copy.transcript}</p>
        <p className="mb-4 text-sm text-text-secondary">{document.language.toUpperCase()} · {Math.round(document.durationMs / 1000)} {copy.seconds} · {copy.savedRevision} {document.revision}</p>
        <time className="text-sm text-text-secondary" dateTime={document.updatedAt}>{new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(document.updatedAt))}</time>
        <div className="mt-4 flex flex-wrap gap-3"><Link href={`/app/tools/subtitles?${params}`} prefetch={false} className="inline-flex min-h-11 items-center rounded-lg border border-border px-4">{copy.openDocument}</Link>
          <a href={download('srt')} className="inline-flex min-h-11 items-center px-2">SRT</a><a href={download('vtt')} className="inline-flex min-h-11 items-center px-2">VTT</a>
        </div>
      </li>;
    })}</ul>
    {nextCursor ? <button type="button" className="my-5 min-h-11 rounded-lg border border-border px-4" disabled={busy} onClick={() => setCursor(nextCursor)}>{copy.loadMore}</button> : null}
  </div>;
}
