import type { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Eye, Film, Radar, ShieldCheck } from 'lucide-react';
import { VideoThumbnailEditor } from '@/components/admin/VideoThumbnailEditor.client';
import { AdminEmptyState } from '@/components/admin-system/feedback/AdminEmptyState';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { AdminSectionMeta } from '@/components/admin-system/shell/AdminSectionMeta';
import { AdminDataTable } from '@/components/admin-system/surfaces/AdminDataTable';
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
  const rows = watchRows.map((row) => buildWatchRow(row)).sort(compareWatchRows);
  const metrics = buildOverviewItems(rows);
  const readyCount = rows.filter((row) => row.isReady).length;
  const issueCount = rows.length - readyCount;
  const strongRows = rows.filter((row) => row.completenessScore >= 80 && row.differentiationScore >= 70).length;

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

      <AdminSection
        title="Watch Page Inventory"
        description="Valide la watch page publique, les assets live et les signaux de qualité pour chaque vidéo du rollout."
        action={
          <AdminSectionMeta
            title={`${readyCount}/${rows.length} rollout pages ready`}
            lines={[
              issueCount ? `${issueCount} page${issueCount > 1 ? 's' : ''} still need attention` : 'No rollout blockers detected',
              `${strongRows} page${strongRows === 1 ? '' : 's'} with strong completeness + differentiation scores`,
            ]}
          />
        }
      >
        <div className="space-y-4">
          <AdminNotice tone={issueCount ? 'warning' : 'success'}>
            {issueCount
              ? 'Blocked watch pages are pinned first. The rollout contract stays simple: public, discovery-on, with video + thumbnail, and editorially differentiated.'
              : 'The shortlist currently satisfies the rollout contract: public, discovery-on, with assets and no detected blockers.'}
          </AdminNotice>

          {rows.length ? (
            <AdminDataTable viewportClassName="max-h-[72vh] overflow-auto">
              <thead className="sticky top-0 z-10 bg-surface">
                <tr className="text-[11px] uppercase tracking-[0.18em] text-text-muted">
                  <th className="px-4 py-3 font-semibold">Video</th>
                  <th className="px-4 py-3 font-semibold">Rollout state</th>
                  <th className="px-4 py-3 font-semibold">Editorial signal</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline bg-bg/30">
                {rows.map((row) => (
                  <tr key={row.entry.id} className={row.isReady ? 'align-top' : 'align-top bg-warning-bg/20'}>
                    <td className="px-4 py-4 align-top">
                      <div className="grid max-w-[34rem] gap-3 lg:grid-cols-[160px_minmax(0,1fr)]">
                        <WatchPreview
                          title={row.generatedTitle}
                          watchPath={row.watchPath}
                          thumbUrl={row.video?.thumbUrl ?? null}
                          ready={row.isReady}
                        />
                        <div className="min-w-0 space-y-2">
                          <div>
                            <Link href={row.watchPath} prefetch={false} className="font-semibold text-text-primary hover:underline">
                              {row.generatedTitle}
                            </Link>
                            <p className="mt-1 text-xs text-text-muted">
                              {row.entry.engineLabel} · {row.entry.engineFamily} · Priority {row.entry.priority}
                            </p>
                          </div>
                          <p className="line-clamp-2 text-sm text-text-secondary">{row.generatedIntro}</p>
                          <div className="space-y-1 text-xs text-text-muted">
                            <p>
                              Source:{' '}
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
                            <p>Published target: {formatDate(row.entry.publishedAt)}</p>
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4 align-top">
                      <div className="max-w-[22rem] space-y-3">
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

                        <div className="grid gap-2 text-xs text-text-secondary sm:grid-cols-2">
                          <p>Created: {formatDateTime(row.video?.createdAt)}</p>
                          <p>Aspect ratio: {row.video?.aspectRatio ?? 'Unknown'}</p>
                          <p>Duration: {formatDuration(row.video?.durationSec)}</p>
                          <p>Audio: {row.video?.hasAudio ? 'Yes' : 'No'}</p>
                        </div>

                        {row.issues.length ? (
                          <div className="rounded-xl border border-warning-border/60 bg-warning-bg/15 px-3 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-warning">Active blockers</p>
                            <ul className="mt-2 space-y-1 text-xs text-warning">
                              {row.issues.slice(0, 3).map((issue) => (
                                <li key={issue}>• {issue}</li>
                              ))}
                              {row.issues.length > 3 ? <li>• +{row.issues.length - 3} more blocker(s)</li> : null}
                            </ul>
                          </div>
                        ) : (
                          <p className="text-xs text-text-muted">No rollout blockers detected on this watch page.</p>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-4 align-top">
                      <div className="max-w-[20rem] space-y-3">
                        <div className="space-y-2">
                          <ScoreMeter label="Completeness" value={row.completenessScore} tone={row.completenessScore >= 80 ? 'ok' : 'warn'} />
                          <ScoreMeter
                            label="Differentiation"
                            value={row.differentiationScore}
                            tone={row.differentiationScore >= 70 ? 'ok' : 'neutral'}
                          />
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <StatusPill tone="neutral">{row.entry.engineFamily}</StatusPill>
                          <StatusPill tone={row.relatedCount >= 3 ? 'ok' : 'neutral'}>{row.relatedCount} related</StatusPill>
                          {row.parentPath ? <StatusPill tone="neutral">Parent hub</StatusPill> : null}
                        </div>

                        <p className="text-sm text-text-secondary">{row.entry.reasonForSelection}</p>

                        {row.parentPath ? (
                          <p className="text-xs text-text-muted">
                            Parent hub:{' '}
                            <Link href={row.parentPath} prefetch={false} className="font-medium text-text-primary hover:underline">
                              {row.parentLabel ?? row.parentPath}
                            </Link>
                          </p>
                        ) : null}
                      </div>
                    </td>

                    <td className="px-4 py-4 align-top">
                      <div className="flex min-w-[14rem] flex-col items-start gap-2">
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

                        <details className="mt-2 w-full rounded-xl border border-hairline bg-bg/40">
                          <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium text-text-primary marker:hidden">
                            Thumbnail tools
                          </summary>
                          <div className="border-t border-hairline px-3 py-3">
                            <VideoThumbnailEditor
                              videoId={row.entry.id}
                              title={row.generatedTitle}
                              engineLabel={row.video?.engineLabel ?? row.entry.engineLabel}
                              initialThumbUrl={row.video?.thumbUrl ?? null}
                              videoUrl={row.video?.videoUrl ?? null}
                              className="max-w-none"
                            />
                          </div>
                        </details>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </AdminDataTable>
          ) : (
            <AdminEmptyState>No watch pages are currently configured for the rollout.</AdminEmptyState>
          )}
        </div>
      </AdminSection>
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

function WatchPreview({
  title,
  watchPath,
  thumbUrl,
  ready,
}: {
  title: string;
  watchPath: string;
  thumbUrl: string | null;
  ready: boolean;
}) {
  return (
    <Link
      href={watchPath}
      prefetch={false}
      className="group relative block overflow-hidden rounded-2xl border border-hairline bg-surface-2"
    >
      {thumbUrl ? (
        <Image
          src={thumbUrl}
          alt={title}
          width={160}
          height={90}
          unoptimized
          className="aspect-video object-cover transition group-hover:scale-[1.02]"
          style={{ width: '100%', height: 'auto' }}
        />
      ) : (
        <div className="flex aspect-video items-center justify-center bg-bg text-xs font-medium text-text-muted">No thumbnail</div>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent px-3 py-2 text-[11px] font-semibold text-white">
        <span>{ready ? 'Ready' : 'Review'}</span>
        <span>Open</span>
      </div>
    </Link>
  );
}

function compareWatchRows(a: WatchRow, b: WatchRow) {
  if (a.isReady !== b.isReady) return Number(a.isReady) - Number(b.isReady);
  if (b.issues.length !== a.issues.length) return b.issues.length - a.issues.length;
  if (a.entry.priority !== b.entry.priority) return a.entry.priority - b.entry.priority;
  return a.generatedTitle.localeCompare(b.generatedTitle);
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

function ScoreMeter({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  tone?: 'ok' | 'warn' | 'neutral';
}) {
  const fillClass =
    tone === 'ok' ? 'bg-emerald-600' : tone === 'warn' ? 'bg-amber-500' : 'bg-slate-400';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-text-primary">{label}</span>
        <span className="text-text-secondary">{value}/100</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-hairline">
        <div className={`h-full rounded-full ${fillClass}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
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
