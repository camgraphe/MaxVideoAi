import '../_components/editorial-article.css';
import { CorrectionForm } from '../_components/CorrectionForm.client';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getEditorialVersion, getLatestEditorialVersion } from '@/server/editorial/repository';
import { requireAdmin } from '@/server/admin';
import { EditorialArticle } from '../_components/EditorialArticle';
import { EditorialTrendResearch } from '../_components/EditorialTrendResearch';
import { ApproveDraftButton } from '../_components/ApproveDraftButton';
import { getEditorialChecks } from '@/server/editorial/checks';
import { validateEditorialCheckReport } from '@/lib/editorial/checks';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type PageProps = { params: Promise<{ articleId: string }>; searchParams: Promise<{ version?: string; locale?: string }> };

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  await requireAdmin();
  const [{ articleId }, query] = await Promise.all([params, searchParams]);
  const selected = query.version ? Number(query.version) : null;
  const record = Number.isInteger(selected) && Number(selected) > 0 ? await getEditorialVersion(articleId, Number(selected)) : await getLatestEditorialVersion(articleId);
  const locale = query.locale === 'fr' || query.locale === 'es' ? query.locale : 'en';
  const variant = record?.draft.locales[locale];
  return { title: variant?.title || 'Editorial draft', description: variant?.description, keywords: variant?.keywords, robots: { index: false, follow: false } };
}

export default async function EditorialDraftPreviewPage({ params, searchParams }: PageProps) {
  await requireAdmin();
  const [{ articleId }, query] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(articleId)) notFound();
  const requestedVersion = query.version ? Number(query.version) : null;
  if (query.version && (!Number.isInteger(requestedVersion) || Number(requestedVersion) < 1)) notFound();
  const version = requestedVersion ? await getEditorialVersion(articleId, requestedVersion) : await getLatestEditorialVersion(articleId);
  if (!version) notFound();
  const locale = query.locale === 'fr' || query.locale === 'es' ? query.locale : 'en';
  const checks = await getEditorialChecks(articleId, version.version);
  let checked = false;
  try { if (checks) { validateEditorialCheckReport(version.draft, version.digest, checks.report); checked = true; } } catch { /* A different renderer or stale report needs a fresh check. */ }
  return <div className="space-y-6">
    <div className="rounded-2xl border border-hairline bg-surface p-5 sm:p-7">
      <Link href="/admin/editorial" className="text-sm font-medium text-text-muted hover:text-text-primary">← All drafts</Link>
      <div className="mt-4 flex flex-wrap items-center gap-3"><span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-700">Private draft</span><span className="text-sm text-text-secondary">Version {version.version} · {new Date(version.createdAt).toLocaleString()}</span></div>
      <p className="mt-3 break-all font-mono text-xs text-text-muted">SHA-256 {version.digest}</p>
      <nav aria-label="Article language" className="mt-5 flex flex-wrap gap-2">{(['en', 'fr', 'es'] as const).map((language) => <Link key={language} href={`/admin/editorial/${articleId}?version=${version.version}&locale=${language}`} aria-current={language === locale ? 'page' : undefined} className={`rounded-full border px-4 py-2 text-sm font-semibold ${language === locale ? 'border-text-primary bg-text-primary text-bg' : 'border-hairline text-text-secondary hover:border-border-hover'}`}>{language.toUpperCase()}</Link>)}</nav>
      <div className="mt-5 grid gap-2 text-sm text-text-secondary sm:grid-cols-2"><p>Sources: {version.draft.sources.length} · Trend signals: {version.draft.research.signals.length}</p><p>Media: {version.draft.assets.length} · Topic: {version.draft.research.recommendation}</p><p>Links, media, mobile and multilingual metadata: {checked ? 'checked for this version' : 'checks pending'}</p></div>
      <p className="mt-3 text-xs text-text-muted">Approval applies only to this exact version and digest. Approval does not publish the article.</p>
      {version.approvedAt ? <p className="mt-4 text-sm font-semibold text-green-700">Approved by {version.approvedBy} on {new Date(version.approvedAt).toLocaleString()}</p> : checked ? <ApproveDraftButton articleId={articleId} version={version.version} digest={version.digest} /> : null}
    </div>
    <CorrectionForm articleId={articleId} version={version.version} digest={version.digest} locale={locale} blocks={version.draft.locales[locale].blocks} />
    <EditorialTrendResearch research={version.draft.research} />
    <EditorialArticle draft={version.draft} locale={locale} articleId={articleId} version={version.version} />
  </div>;
}
