import { getEditorialStatusLabel } from '../_lib/editorial-status';
import { PublicationStatusPanel } from '../_components/PublicationStatusPanel.client';
import { getEditorialPublication } from '@/server/editorial/publication-queue';
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
import { listEditorialCorrections } from '@/server/editorial/corrections';
import { getEditorialChecks, getEditorialQaIssue } from '@/server/editorial/checks';
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
  const [checks, latest, corrections, publication, qaIssue] = await Promise.all([getEditorialChecks(articleId, version.version), getLatestEditorialVersion(articleId), listEditorialCorrections(articleId, version.version), getEditorialPublication(articleId, version.version), getEditorialQaIssue(articleId, version.version)]);
  const disabledReason = latest?.version !== version.version ? "A newer version is available. Open it to approve." : corrections.length ? "Corrections have been requested. Review the next version before approval." : undefined;
  let checked = false;
  let sourceWarnings: Array<{url:string;status:number}> = [];
  try { if (checks) { const report = validateEditorialCheckReport(version.draft, version.digest, checks.report); sourceWarnings = report.links.filter(link => [401,403,429].includes(link.status)); checked = true; } } catch { /* A different renderer or stale report needs a fresh check. */ }
  return <div className="space-y-6">
    <div className="border-b border-border pb-5">
      <Link href="/admin/editorial" className="text-sm font-medium text-text-muted hover:text-text-primary">← Articles</Link>
      <div className="mt-4 flex flex-wrap items-center gap-3"><span className="rounded bg-surface-2 px-2 py-1 text-xs font-medium text-text-primary">{getEditorialStatusLabel(publication?.status ?? null, version.approvedAt)}</span><span className="text-sm text-text-secondary">Version {version.version} · {new Date(version.createdAt).toLocaleString('en-GB', {timeZone:'Europe/Madrid'})}</span></div>
      <details className="mt-3 text-xs text-text-secondary"><summary className="cursor-pointer">Version fingerprint</summary><p className="mt-2 break-all font-mono">SHA-256 {version.digest}</p></details>
      <nav aria-label="Article language" className="mt-5 flex flex-wrap gap-2">{(['en', 'fr', 'es'] as const).map((language) => <Link key={language} href={`/admin/editorial/${articleId}?version=${version.version}&locale=${language}`} aria-current={language === locale ? 'page' : undefined} className={`rounded-full border px-4 py-2 text-sm font-semibold ${language === locale ? 'border-text-primary bg-text-primary text-bg' : 'border-hairline text-text-secondary hover:border-border-hover'}`}>{language.toUpperCase()}</Link>)}</nav>
      <h2 className="mt-5 text-lg font-semibold">Review and publication</h2>
      <p className="mt-2 text-sm text-text-secondary">Review EN, FR and ES. Approve and publish authorizes automatic publication of this exact version after technical checks.</p>
      {publication ? <PublicationStatusPanel publication={publication} /> : <>
        {version.approvedAt && <p className="mt-4 text-sm font-semibold text-green-700">Content approved · Publication not authorized</p>}
        {process.env.EDITORIAL_PUBLICATION_ENABLED === '1' ? <ApproveDraftButton articleId={articleId} version={version.version} digest={version.digest} publish disabledReason={disabledReason ?? (!checked ? 'Automated checks are still running. Publication becomes available once they pass.' : undefined)} /> : <>
          {!version.approvedAt && <ApproveDraftButton articleId={articleId} version={version.version} digest={version.digest} disabledReason={disabledReason} />}
          <p className="mt-2 text-sm text-text-secondary">Automatic publication is not enabled.</p>
        </>}
      </>}

    </div>
    <EditorialArticle draft={version.draft} locale={locale} articleId={articleId} version={version.version} />
    <details className="border-b border-border pb-4"><summary className="cursor-pointer text-sm font-medium">Request a correction</summary><div className="mt-4">
    <CorrectionForm articleId={articleId} version={version.version} digest={version.digest} locale={locale} blocks={version.draft.locales[locale].blocks} />
    </div></details>
    <details className="border-b border-border pb-4"><summary className="cursor-pointer text-sm font-medium">Research and technical checks</summary>
      <div className="mt-5 grid gap-2 text-sm text-text-secondary sm:grid-cols-2"><p>Sources: {version.draft.sources.length} · Trend signals: {version.draft.research.signals.length}</p><p>Media: {version.draft.assets.length} · Topic: {version.draft.research.recommendation}</p><p>Publication checks: {checked ? 'complete for this version' : 'incomplete — publication blocked'}</p></div>
      {sourceWarnings.length > 0 && <div className="mt-3 text-sm text-text-secondary"><p>These sources block automated checks. Verify them during your review:</p>{sourceWarnings.map(link => <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" className="mr-3 underline">{new URL(link.url).hostname} ({link.status})</a>)}</div>}
      {!checked && qaIssue.attempts >= 3 && <div className="mt-3 text-sm"><p>Checks stopped after three attempts. Content is preserved. Reason: {qaIssue.message}</p><ApproveDraftButton articleId={articleId} version={version.version} digest={version.digest} retryChecks disabledReason={disabledReason} /></div>}
    <EditorialTrendResearch research={version.draft.research} />
    </details>
  </div>;
}
