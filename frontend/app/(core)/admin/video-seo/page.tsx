import type { ReactNode } from 'react';
import Link from 'next/link';
import { Eye, Film, Radar, ShieldCheck } from 'lucide-react';
import { VideoThumbnailEditor } from '@/components/admin/VideoThumbnailEditor.client';
import { AdminEmptyState } from '@/components/admin-system/feedback/AdminEmptyState';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { AdminSectionMeta } from '@/components/admin-system/shell/AdminSectionMeta';
import { type AdminMetricItem, AdminMetricGrid } from '@/components/admin-system/surfaces/AdminMetricGrid';
import { ButtonLink } from '@/components/ui/Button';
import { SITE_ORIGIN } from '@/lib/siteOrigin';
import { listSeoWatchVideoRows, type SeoWatchVideoMeta, type SeoWatchVideoRow } from '@/server/video-seo';
import type { GalleryVideo } from '@/server/videos';

export const dynamic = 'force-dynamic';

const numberFormatter = new Intl.NumberFormat('en-US');
const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

type WatchRow = {
  entry: SeoWatchVideoMeta;
  video: GalleryVideo | null;
  issues: string[];
  watchPath: string;
  watchUrl: string;
  auditPath: string;
  isReady: boolean;
  generatedTitle: string;
  generatedIntro: string;
  parentPath: string | null;
  parentLabel: string | null;
  relatedCount: number;
  completenessScore: number;
  differentiationScore: number;
};

export default async function AdminVideoSeoPage() {
  const watchRows = await listSeoWatchVideoRows();
  const rows = watchRows.map((row) => buildWatchRow(row));
  const metrics = buildOverviewItems(rows);
  const readyCount = rows.filter((row) => row.isReady).length;
  const issueCount = rows.length - readyCount;

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        eyebrow="Curation"
        title="Video SEO watch pages"
        description="Vue opérationnelle du shortlist `/video/[id]` pour le rollout Google Video. On contrôle ici l’éligibilité, les assets publics et les watch pages, sans mélanger cette surface avec la publication générale."
        actions={
          <>
            <ButtonLink href="/admin/moderation" variant="outline" size="sm" className="border-border bg-surface">
              Moderation
            </ButtonLink>
            <ButtonLink href="/sitemap-video.xml" variant="outline" size="sm" prefetch={false} className="border-border bg-surface">
              Video sitemap
            </ButtonLink>
            <ButtonLink href="/examples" variant="outline" size="sm" prefetch={false} className="border-border bg-surface">
              Examples hub
            </ButtonLink>
          </>
        }
      />

      <AdminSection
        title="Rollout Pulse"
        description="Lecture rapide du shortlist actuellement sous surveillance avant d’inspecter chaque watch page."
      >
        <AdminMetricGrid items={metrics} columnsClassName="sm:grid-cols-2 xl:grid-cols-4" density="compact" />
      </AdminSection>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_340px] xl:items-start">
        <AdminSection
          title="Watch Page Inventory"
          description="Valide la watch page publique, les assets live et les signaux de qualité pour chaque vidéo du rollout."
          action={
            <AdminSectionMeta
              title={`${readyCount}/${rows.length} rollout pages ready`}
              lines={[
                issueCount ? `${issueCount} page${issueCount > 1 ? 's' : ''} still need attention` : 'No rollout blockers detected',
                'Shortlist remains read-only and code-driven',
              ]}
            />
          }
        >
          {rows.length ? (
            <div className="overflow-x-auto rounded-2xl border border-hairline">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-surface">
                  <tr className="text-[11px] uppercase tracking-[0.18em] text-text-muted">
                    <th className="px-4 py-3 font-semibold">Preview</th>
                    <th className="px-4 py-3 font-semibold">Watch page</th>
                    <th className="px-4 py-3 font-semibold">Runtime status</th>
                    <th className="px-4 py-3 font-semibold">Controls</th>
                    <th className="px-4 py-3 font-semibold">Selection note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline bg-bg/30">
                  {rows.map((row) => (
                    <tr key={row.entry.id} className={row.isReady ? 'align-top' : 'align-top bg-warning-bg/20'}>
                      <td className="px-4 py-4 align-top">
                        <VideoThumbnailEditor
                          videoId={row.entry.id}
                          title={row.generatedTitle}
                          engineLabel={row.video?.engineLabel ?? row.entry.engineLabel}
                          initialThumbUrl={row.video?.thumbUrl ?? null}
                          videoUrl={row.video?.videoUrl ?? null}
                        />
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="space-y-2">
                          <div>
                            <Link href={row.watchPath} prefetch={false} className="font-semibold text-text-primary hover:underline">
                              {row.generatedTitle}
                            </Link>
                            <p className="mt-1 text-xs text-text-muted">
                              {row.entry.engineLabel} · Priority {row.entry.priority}
                            </p>
                          </div>
                          <p className="max-w-md text-sm text-text-secondary">{row.generatedIntro}</p>
                          <div className="space-y-1 text-xs text-text-muted">
                            <p>
                              Source surface:{' '}
                              <Link href={row.entry.sourcePath} prefetch={false} className="font-medium text-text-primary hover:underline">
                                {row.entry.sourceLabel}
                              </Link>
                            </p>
                            <p>
                              Public URL:{' '}
                              <a href={row.watchUrl} className="font-mono text-[11px] text-text-primary hover:underline">
                                {row.watchUrl}
                              </a>
                            </p>
                            <p>
                              Video ID:{' '}
                              <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-text-primary">{row.entry.id}</code>
                            </p>
                            {row.parentPath ? (
                              <p>
                                Parent hub:{' '}
                                <Link href={row.parentPath} prefetch={false} className="font-medium text-text-primary hover:underline">
                                  {row.parentLabel ?? row.parentPath}
                                </Link>
                              </p>
                            ) : null}
                            <p>Published target: {formatDate(row.entry.publishedAt)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="space-y-3">
                          <div className="flex flex-wrap gap-2">
                            <StatusPill tone={row.isReady ? 'ok' : 'warn'}>{row.isReady ? 'Ready' : 'Needs attention'}</StatusPill>
                            <StatusPill tone={row.video?.visibility === 'public' ? 'ok' : 'warn'}>
                              {row.video?.visibility === 'public' ? 'Public' : 'Private or missing'}
                            </StatusPill>
                            <StatusPill tone={row.video?.indexable ? 'ok' : 'warn'}>
                              {row.video?.indexable ? 'Discovery on' : 'Discovery off'}
                            </StatusPill>
                            <StatusPill tone={row.video?.videoUrl ? 'ok' : 'warn'}>
                              {row.video?.videoUrl ? 'Video asset' : 'Missing video'}
                            </StatusPill>
                            <StatusPill tone={row.video?.thumbUrl ? 'ok' : 'warn'}>
                              {row.video?.thumbUrl ? 'Thumbnail' : 'Missing thumb'}
                            </StatusPill>
                          </div>
                          <div className="space-y-1 text-xs text-text-secondary">
                            <p>Created: {formatDateTime(row.video?.createdAt)}</p>
                            <p>Aspect ratio: {row.video?.aspectRatio ?? 'Unknown'}</p>
                            <p>Duration: {formatDuration(row.video?.durationSec)}</p>
                            <p>Audio: {row.video?.hasAudio ? 'Yes' : 'No'}</p>
                            <p>Completeness: {row.completenessScore}/100</p>
                            <p>Differentiation: {row.differentiationScore}/100</p>
                          </div>
                          {row.issues.length ? (
                            <ul className="space-y-1 text-xs text-warning">
                              {row.issues.map((issue) => (
                                <li key={issue}>• {issue}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-xs text-text-muted">No rollout blockers detected on this watch page.</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex min-w-[12rem] flex-col items-start gap-2">
                          <ButtonLink href={row.watchPath} size="sm" prefetch={false}>
                            Open watch page
                          </ButtonLink>
                          <ButtonLink href={row.auditPath} variant="outline" size="sm" prefetch={false}>
                            Open job audit
                          </ButtonLink>
                          {row.video?.videoUrl ? (
                            <a
                              href={row.video.videoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm font-medium text-text-primary underline-offset-2 hover:underline"
                            >
                              Open video asset
                            </a>
                          ) : null}
                          {row.video?.thumbUrl ? (
                            <a
                              href={row.video.thumbUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm font-medium text-text-primary underline-offset-2 hover:underline"
                            >
                              Open thumbnail
                            </a>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="max-w-sm space-y-2">
                          <StatusPill tone="neutral">{row.entry.engineFamily}</StatusPill>
                          <StatusPill tone={row.relatedCount >= 3 ? 'ok' : 'neutral'}>{row.relatedCount} related</StatusPill>
                          <p className="text-sm text-text-secondary">{row.entry.reasonForSelection}</p>
                          <p className="text-xs text-text-muted">
                            Keep this page in the rollout only if it remains visually strong, public, discovery-on, and editorially useful.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <AdminEmptyState>No watch pages are currently configured for the rollout.</AdminEmptyState>
          )}
        </AdminSection>

        <div className="xl:sticky xl:top-[5.75rem]">
          <AdminSection title="Rollout Guardrails" description="Rappels courts pour garder le shortlist propre et utile.">
            <div className="space-y-4">
              <AdminNotice tone={issueCount ? 'warning' : 'success'}>
                {issueCount
                  ? 'Some rollout pages drifted away from the public-indexable-with-assets contract. Fix the underlying video before trusting the sitemap.'
                  : 'The current shortlist satisfies the rollout contract: public, discovery-on, with assets and no detected blockers.'}
              </AdminNotice>

              <div className="space-y-3 rounded-2xl border border-hairline bg-bg/40 px-4 py-4 text-sm text-text-secondary">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Source of truth</p>
                  <p className="mt-1">The rollout remains code-driven. This admin surface audits the shortlist but does not redefine it.</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Eligibility contract</p>
                  <p className="mt-1">Every shortlisted video must be public, indexable, have a video asset and a thumbnail, and stay editorially differentiated.</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Operational split</p>
                  <p className="mt-1">General publication lives in Moderation. Google Video rollout is narrower and should stay intentionally curated.</p>
                </div>
              </div>
            </div>
          </AdminSection>
        </div>
      </div>
    </div>
  );
}

function buildWatchRow({ entry, video, isEligible, signals, related }: SeoWatchVideoRow): WatchRow {
  const watchPath = buildWatchPath(entry.id);
  const issues: string[] = [];
  const generatedSignals = signals;
  const relatedCount = related.length;

  if (!video) {
    issues.push('Video missing from app_jobs.');
  } else {
    if (video.visibility !== 'public') issues.push(`Visibility is ${video.visibility}.`);
    if (!video.indexable) issues.push('Public discovery is disabled.');
    if (!video.videoUrl) issues.push('Video asset URL is missing.');
    if (!video.thumbUrl) issues.push('Thumbnail URL is missing.');
  }
  if (generatedSignals?.auditNotes?.length) {
    issues.push(...generatedSignals.auditNotes);
  }
  if (generatedSignals?.stabilityWarnings?.length) {
    issues.push(...generatedSignals.stabilityWarnings);
  }

  return {
    entry,
    video,
    issues,
    watchPath,
    watchUrl: `${SITE_ORIGIN}${watchPath}`,
    auditPath: `/admin/jobs?jobId=${encodeURIComponent(entry.id)}`,
    isReady: isEligible && issues.length === 0,
    generatedTitle: generatedSignals?.title ?? entry.seoTitle,
    generatedIntro: generatedSignals?.intro ?? entry.intro,
    parentPath: generatedSignals?.parentPath ?? null,
    parentLabel: generatedSignals?.parentLabel ?? null,
    relatedCount,
    completenessScore: generatedSignals?.completenessScore ?? 0,
    differentiationScore: generatedSignals?.differentiationScore ?? 0,
  };
}

function buildOverviewItems(rows: WatchRow[]): AdminMetricItem[] {
  const readyCount = rows.filter((row) => row.isReady).length;
  const issueCount = rows.length - readyCount;
  const liveAssetCount = rows.filter((row) => Boolean(row.video?.videoUrl)).length;
  const engineFamilies = new Set(rows.map((row) => row.entry.engineFamily)).size;

  return [
    {
      label: 'Watch pages',
      value: numberFormatter.format(rows.length),
      helper: 'Curated /video pages inside the rollout',
      icon: Eye,
    },
    {
      label: 'Ready now',
      value: numberFormatter.format(readyCount),
      helper: 'Public, discovery on, with video and thumbnail',
      tone: issueCount ? 'warning' : 'success',
      icon: ShieldCheck,
    },
    {
      label: 'Needs attention',
      value: numberFormatter.format(issueCount),
      helper: 'Pages drifting away from rollout rules',
      tone: issueCount ? 'warning' : 'default',
      icon: Radar,
    },
    {
      label: 'Engine families',
      value: numberFormatter.format(engineFamilies),
      helper: `${numberFormatter.format(liveAssetCount)} live media assets on the shortlist`,
      icon: Film,
    },
  ];
}

function buildWatchPath(id: string): string {
  return `/video/${encodeURIComponent(id)}`;
}

function StatusPill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'ok' | 'warn' | 'neutral' }) {
  const toneClasses =
    tone === 'ok'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
      : tone === 'warn'
        ? 'border-warning-border/60 bg-warning-bg/20 text-warning'
        : 'border-surface-on-media-30 bg-surface-2 text-text-secondary';

  return <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${toneClasses}`}>{children}</span>;
}

function formatDate(value?: string | null): string {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return dateFormatter.format(date);
}

function formatDateTime(value?: string | null): string {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return dateTimeFormatter.format(date);
}

function formatDuration(value?: number | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 'Unknown';
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  if (minutes <= 0) return `${seconds}s`;
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
}
