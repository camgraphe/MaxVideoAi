import type { ReactNode } from 'react';
import Link from 'next/link';
import { ButtonLink } from '@/components/ui/Button';
import { VideoThumbnailEditor } from '@/components/admin/VideoThumbnailEditor.client';
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
};

export default async function AdminVideoSeoPage() {
  const watchRows = await listSeoWatchVideoRows();
  const rows = watchRows.map((row) => buildWatchRow(row));

  const readyCount = watchRows.filter((row) => row.isEligible).length;
  const issueCount = rows.length - readyCount;
  const liveAssetCount = rows.filter((row) => Boolean(row.video?.videoUrl)).length;
  const engineFamilies = new Set(rows.map((row) => row.entry.engineFamily)).size;

  return (
    <div className="stack-gap-lg">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-text-muted">Curation</p>
          <h1 className="mt-1 text-3xl font-semibold text-text-primary">Video SEO watch pages</h1>
          <p className="mt-2 text-sm text-text-secondary">
            Operational view of the curated <code className="font-mono text-xs">/video/[id]</code> shortlist currently
            eligible for the Google Video rollout, including sitemap submission and watch-page indexation.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ButtonLink href="/sitemap-video.xml" variant="outline" size="sm" prefetch={false}>
            Open video sitemap
          </ButtonLink>
          <ButtonLink href="/sitemap-en.xml" variant="outline" size="sm" prefetch={false}>
            Open EN sitemap
          </ButtonLink>
          <ButtonLink href="/examples" variant="ghost" size="sm" prefetch={false}>
            Browse examples hub
          </ButtonLink>
        </div>
      </header>

      <section className="grid grid-gap-sm sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Watch pages"
          value={numberFormatter.format(rows.length)}
          helper="Curated /video pages in the rollout"
        />
        <SummaryCard
          label="Ready now"
          value={numberFormatter.format(readyCount)}
          helper="Public, discovery on, with video + thumbnail"
          tone={issueCount ? 'warn' : 'ok'}
        />
        <SummaryCard
          label="Needs attention"
          value={numberFormatter.format(issueCount)}
          helper="Any watch page drifting away from rollout rules"
          tone={issueCount ? 'warn' : 'muted'}
        />
        <SummaryCard
          label="Engine families"
          value={numberFormatter.format(engineFamilies)}
          helper={`${numberFormatter.format(liveAssetCount)} live media assets on the shortlist`}
        />
      </section>

      <section className="rounded-card border border-surface-on-media-25 bg-surface-glass-95 p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <h2 className="text-lg font-semibold text-text-primary">Rollout guardrails</h2>
            <p className="mt-2 text-sm text-text-secondary">
              This view is intentionally limited to the curated rollout. Any video outside this shortlist should stay out
              of the sitemap and remain <code className="font-mono text-xs">noindex</code>.
            </p>
          </div>
          <div className="rounded-card border border-surface-on-media-30 bg-surface px-4 py-3 text-sm text-text-secondary">
            <p className="font-semibold text-text-primary">Source of truth</p>
            <p className="mt-1">
              The rollout is currently read-only and mirrors the fixed hero watchlist. Admin can audit these pages here, but changing the rollout
              itself still requires a code update.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-card border border-surface-on-media-25 bg-surface-glass-95 shadow-card">
        <div className="border-b border-surface-on-media-25 px-5 py-4">
          <h2 className="text-lg font-semibold text-text-primary">Watch page inventory</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Use this table to validate the public URL, inspect the current media state, and jump straight into the watch
            page or admin job audit.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-[0.2em] text-text-muted">
                <th className="px-5 py-3 font-semibold">Preview</th>
                <th className="px-5 py-3 font-semibold">Watch page</th>
                <th className="px-5 py-3 font-semibold">Runtime status</th>
                <th className="px-5 py-3 font-semibold">Controls</th>
                <th className="px-5 py-3 font-semibold">Selection note</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.entry.id}
                  className={row.isReady ? 'border-t border-surface-on-media-25' : 'border-t border-warning-border/40 bg-warning-bg/20'}
                >
                  <td className="px-5 py-4 align-top">
                    <VideoThumbnailEditor
                      videoId={row.entry.id}
                      title={row.entry.seoTitle}
                      engineLabel={row.video?.engineLabel ?? row.entry.engineLabel}
                      initialThumbUrl={row.video?.thumbUrl ?? null}
                      videoUrl={row.video?.videoUrl ?? null}
                    />
                  </td>
                  <td className="px-5 py-4 align-top">
                    <div className="space-y-2">
                      <div>
                        <Link href={row.watchPath} prefetch={false} className="font-semibold text-text-primary hover:underline">
                          {row.entry.seoTitle}
                        </Link>
                        <p className="mt-1 text-xs text-text-muted">
                          {row.entry.engineLabel} · Priority {row.entry.priority}
                        </p>
                      </div>
                      <p className="max-w-md text-sm text-text-secondary">{row.entry.intro}</p>
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
                          <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-text-primary">
                            {row.entry.id}
                          </code>
                        </p>
                        <p>Published target: {formatDate(row.entry.publishedAt)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 align-top">
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <StatusPill tone={row.isReady ? 'ok' : 'warn'}>{row.isReady ? 'Ready' : 'Needs attention'}</StatusPill>
                        <StatusPill tone={row.video?.visibility === 'public' ? 'ok' : 'warn'}>
                          {row.video?.visibility === 'public' ? 'Public' : 'Private or missing'}
                        </StatusPill>
                        <StatusPill tone={row.video?.indexable ? 'ok' : 'warn'}>
                          {row.video?.indexable ? 'Discovery on' : 'Discovery off'}
                        </StatusPill>
                        <StatusPill tone={row.video?.videoUrl ? 'ok' : 'warn'}>{row.video?.videoUrl ? 'Video asset' : 'Missing video'}</StatusPill>
                        <StatusPill tone={row.video?.thumbUrl ? 'ok' : 'warn'}>
                          {row.video?.thumbUrl ? 'Thumbnail' : 'Missing thumb'}
                        </StatusPill>
                      </div>
                      <div className="space-y-1 text-xs text-text-secondary">
                        <p>Created: {formatDateTime(row.video?.createdAt)}</p>
                        <p>Aspect ratio: {row.video?.aspectRatio ?? 'Unknown'}</p>
                        <p>Duration: {formatDuration(row.video?.durationSec)}</p>
                        <p>Audio: {row.video?.hasAudio ? 'Yes' : 'No'}</p>
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
                  <td className="px-5 py-4 align-top">
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
                  <td className="px-5 py-4 align-top">
                    <div className="max-w-sm space-y-2">
                      <StatusPill tone="neutral">{row.entry.engineFamily}</StatusPill>
                      <p className="text-sm text-text-secondary">{row.entry.reasonForSelection}</p>
                      <p className="text-xs text-text-muted">
                        Keep this page in the rollout only if it remains visually strong, public, discovery-on, and editorially useful. Removing it
                        here only affects the Google Video rollout.
                      </p>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function buildWatchRow({ entry, video, isEligible }: SeoWatchVideoRow): WatchRow {
  const watchPath = buildWatchPath(entry.id);
  const issues: string[] = [];

  if (!video) {
    issues.push('Video missing from app_jobs.');
  } else {
    if (video.visibility !== 'public') issues.push(`Visibility is ${video.visibility}.`);
    if (!video.indexable) issues.push('Public discovery is disabled.');
    if (!video.videoUrl) issues.push('Video asset URL is missing.');
    if (!video.thumbUrl) issues.push('Thumbnail URL is missing.');
  }

  return {
    entry,
    video,
    issues,
    watchPath,
    watchUrl: `${SITE_ORIGIN}${watchPath}`,
    auditPath: `/admin/jobs?jobId=${encodeURIComponent(entry.id)}`,
    isReady: isEligible && issues.length === 0,
  };
}

function buildWatchPath(id: string): string {
  return `/video/${encodeURIComponent(id)}`;
}

function SummaryCard({
  label,
  value,
  helper,
  tone = 'muted',
}: {
  label: string;
  value: string;
  helper: ReactNode;
  tone?: 'ok' | 'warn' | 'muted';
}) {
  const toneClasses =
    tone === 'ok'
      ? 'border-emerald-500/30 bg-emerald-500/10'
      : tone === 'warn'
        ? 'border-warning-border/60 bg-warning-bg/20'
        : 'border-surface-on-media-25 bg-surface-glass-95';

  return (
    <section className={`rounded-card border p-5 shadow-card ${toneClasses}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-text-muted">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-text-primary">{value}</p>
      <p className="mt-2 text-sm text-text-secondary">{helper}</p>
    </section>
  );
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
