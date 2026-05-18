import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { VideoThumbnailEditor } from '@/components/admin/VideoThumbnailEditor.client';
import { AdminActionLink } from '@/components/admin-system/shell/AdminActionLink';
import { AdminDataTable } from '@/components/admin-system/surfaces/AdminDataTable';
import { VideoSeoEditorialEditor } from './VideoSeoEditorialEditor.client';
import {
  formatDate,
  formatDateTime,
  formatDuration,
  type WatchRow,
} from '../_lib/video-seo-admin-helpers';

const CANONICAL_BLOCKER_LABELS = [
  'Missing canonical',
  'Canonical mismatch',
  'Canonical conflict',
  'Canonical target not indexable',
] as const;

export function VideoSeoInventoryTable({ rows }: { rows: WatchRow[] }) {
  return (
    <AdminDataTable viewportClassName="max-h-[72vh] overflow-auto">
      <thead className="sticky top-0 z-10 bg-surface">
        <tr className="text-[11px] uppercase tracking-[0.18em] text-text-muted">
          <th className="px-4 py-3 font-semibold">Video</th>
          <th className="px-4 py-3 font-semibold">Indexing contract</th>
          <th className="px-4 py-3 font-semibold">SERP and links</th>
          <th className="px-4 py-3 font-semibold">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-hairline bg-bg/30">
        {rows.map((row) => (
          <tr key={row.entry.id} className={row.isReady ? 'align-top' : 'align-top bg-warning-bg/20'}>
            <VideoSeoVideoCell row={row} />
            <VideoSeoRolloutCell row={row} />
            <VideoSeoEditorialCell row={row} />
            <VideoSeoActionsCell row={row} />
          </tr>
        ))}
      </tbody>
    </AdminDataTable>
  );
}

function VideoSeoVideoCell({ row }: { row: WatchRow }) {
  return (
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
              Model/examples source:{' '}
              <Link href={row.entry.sourcePath} prefetch={false} className="font-medium text-text-primary hover:underline">
                {row.entry.sourceLabel}
              </Link>
            </p>
            <p className="flex flex-wrap items-center gap-2">
              Editorial data:
              <StatusPill tone={row.editorialSourceLabel === 'DB override' ? 'ok' : 'neutral'}>
                {row.editorialSourceLabel === 'DB override' ? 'DB override' : 'Config fallback'}
              </StatusPill>
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
            <p>Target keyword: {row.targetKeyword || 'Missing'}</p>
            <p>Prompt words: {row.promptWordCount}</p>
            <p>Published target: {formatDate(row.entry.publishedAt)}</p>
          </div>
        </div>
      </div>
    </td>
  );
}

function VideoSeoRolloutCell({ row }: { row: WatchRow }) {
  return (
    <td className="px-4 py-4 align-top">
      <div className="max-w-[22rem] space-y-3">
        <div className="flex flex-wrap gap-2">
          <StatusPill tone={row.sitemapEligibilityLabel === 'Eligible' ? 'ok' : 'warn'}>
            Sitemap eligibility: {row.sitemapEligibilityLabel}
          </StatusPill>
          <StatusPill tone={row.inVideoSitemap ? 'ok' : 'warn'}>
            Sitemap: {row.inVideoSitemap ? 'Yes' : 'No'}
          </StatusPill>
          <StatusPill tone={row.robots === 'index, follow' ? 'ok' : 'warn'}>Robots: {row.robots}</StatusPill>
          <StatusPill tone={row.canonicalBlockers.length ? 'warn' : 'ok'}>
            Canonical: {row.canonicalBlockers.length ? 'Review' : 'OK'}
          </StatusPill>
          <StatusPill tone={row.seoStatus === 'approved' ? 'ok' : 'neutral'}>{row.seoStatus}</StatusPill>
          <StatusPill tone={row.isReady ? 'ok' : 'warn'}>{row.isReady ? 'Ready' : 'Review'}</StatusPill>
          <StatusPill tone={row.video?.visibility === 'public' ? 'ok' : 'warn'}>
            {row.video?.visibility === 'public' ? 'Public' : 'Private or missing'}
          </StatusPill>
          <StatusPill tone={row.video?.indexable ? 'ok' : 'warn'}>
            {row.video?.indexable ? 'Discovery on' : 'Discovery off'}
          </StatusPill>
          <StatusPill tone={row.video?.videoUrl ? 'ok' : 'warn'}>
            {row.video?.videoUrl ? 'Video asset' : 'Missing video'}
          </StatusPill>
          <StatusPill tone={row.stableVideoAsset ? 'ok' : 'warn'}>
            {row.stableVideoAsset ? 'Stable video URL' : 'Temporary video URL'}
          </StatusPill>
          <StatusPill tone={row.video?.thumbUrl ? 'ok' : 'warn'}>
            {row.video?.thumbUrl ? 'Thumbnail' : 'Missing thumb'}
          </StatusPill>
          <StatusPill tone={row.stableThumbnailAsset ? 'ok' : 'warn'}>
            {row.stableThumbnailAsset ? 'Stable thumbnail URL' : 'Temporary thumbnail URL'}
          </StatusPill>
          <StatusPill tone={row.internalLinkTargets ? 'ok' : 'warn'}>
            {row.internalLinkTargets ? 'Internal links' : 'Missing internal links'}
          </StatusPill>
        </div>

        <div className="grid gap-2 text-xs text-text-secondary sm:grid-cols-2">
          <p>Created: {formatDateTime(row.video?.createdAt)}</p>
          <p>Aspect ratio: {row.video?.aspectRatio ?? 'Unknown'}</p>
          <p>Duration: {formatDuration(row.video?.durationSec)}</p>
          <p>Audio: {row.video?.hasAudio ? 'Yes' : 'No'}</p>
        </div>

        <div className="rounded-xl border border-hairline bg-bg/50 px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Sitemap eligibility:</p>
          <p className={row.inVideoSitemap ? 'mt-2 text-sm font-semibold text-success' : 'mt-2 text-sm font-semibold text-warning'}>
            {row.sitemapEligibilityLabel}
          </p>
          <ul className="mt-2 space-y-1 text-xs text-text-secondary">
            {row.sitemapEligibilityReasons.slice(0, 4).map((reason) => (
              <li key={reason}>• {reason}</li>
            ))}
            {row.sitemapEligibilityReasons.length > 4 ? <li>• +{row.sitemapEligibilityReasons.length - 4} more reason(s)</li> : null}
          </ul>
        </div>

        <div className="rounded-xl border border-hairline bg-bg/50 px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Canonical</p>
          <p className="mt-2 break-all font-mono text-[11px] text-text-secondary">{row.canonicalUrl ?? 'Missing canonical'}</p>
          <p className="mt-1 break-all font-mono text-[11px] text-text-muted">Expected: {row.expectedCanonicalUrl}</p>
          {row.canonicalBlockers.length ? (
            <ul className="mt-2 space-y-1 text-xs text-warning">
              {row.canonicalBlockers.map((blocker) => (
                <li key={blocker}>• {blocker}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-text-muted">
              Canonical checks pass: {CANONICAL_BLOCKER_LABELS.join(', ')}.
            </p>
          )}
        </div>

        {row.technicalEligibilityBlockers.length ? (
          <div className="rounded-xl border border-warning-border/60 bg-warning-bg/15 px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-warning">Technical / eligibility blockers</p>
            <ul className="mt-2 space-y-1 text-xs text-warning">
              {row.technicalEligibilityBlockers.slice(0, 3).map((issue) => (
                <li key={issue}>• {issue}</li>
              ))}
              {row.technicalEligibilityBlockers.length > 3 ? <li>• +{row.technicalEligibilityBlockers.length - 3} more blocker(s)</li> : null}
            </ul>
          </div>
        ) : (
          <p className="text-xs text-text-muted">No technical or eligibility blocker detected.</p>
        )}

        <div className="rounded-xl border border-hairline bg-bg/50 px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Editorial QA errors</p>
          {row.editorialQaErrors.length ? (
            <ul className="mt-2 space-y-1 text-xs text-warning">
              {row.editorialQaErrors.slice(0, 4).map((issue) => (
                <li key={issue}>• {issue}</li>
              ))}
              {row.editorialQaErrors.length > 4 ? <li>• +{row.editorialQaErrors.length - 4} more error(s)</li> : null}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-text-muted">No contractual QA error detected.</p>
          )}
        </div>
      </div>
    </td>
  );
}

function VideoSeoEditorialCell({ row }: { row: WatchRow }) {
  return (
    <td className="px-4 py-4 align-top">
      <div className="max-w-[20rem] space-y-3">
        <div className="rounded-xl border border-hairline bg-bg/50 px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Preview SERP</p>
          <p className="mt-2 line-clamp-2 text-sm font-semibold text-text-primary">{row.previewSerpTitle}</p>
          <p className="mt-1 line-clamp-3 text-xs leading-5 text-text-secondary">{row.previewSerpDescription}</p>
          <p className="mt-2 truncate font-mono text-[11px] text-text-muted">{row.watchUrl}</p>
        </div>

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

        <p className="text-xs text-text-muted">
          VideoObject.name: <span className="font-medium text-text-primary">{row.videoObjectName}</span>
        </p>

        {row.modelPath ? (
          <p className="text-xs text-text-muted">
            Model:{' '}
            <Link href={row.modelPath} prefetch={false} className="font-medium text-text-primary hover:underline">
              {row.modelLabel ?? row.modelPath}
            </Link>
          </p>
        ) : null}

        {row.examplesPath ? (
          <p className="text-xs text-text-muted">
            Examples:{' '}
            <Link href={row.examplesPath} prefetch={false} className="font-medium text-text-primary hover:underline">
              {row.examplesLabel ?? row.examplesPath}
            </Link>
          </p>
        ) : null}

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
  );
}

function VideoSeoActionsCell({ row }: { row: WatchRow }) {
  return (
    <td className="px-4 py-4 align-top">
      <div className="flex min-w-[14rem] flex-col items-start gap-2">
        <AdminActionLink href={row.watchPath} variant="primary" prefetch={false}>
          Open watch page
        </AdminActionLink>
        <AdminActionLink href={row.auditPath} prefetch={false}>
          Open job audit
        </AdminActionLink>
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

        {row.editorial ? (
          <details className="mt-2 w-full rounded-xl border border-hairline bg-bg/40">
            <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium text-text-primary marker:hidden">
              Editorial editor
            </summary>
            <div className="border-t border-hairline px-3 py-3">
              <VideoSeoEditorialEditor editorial={row.editorial} />
            </div>
          </details>
        ) : null}
      </div>
    </td>
  );
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
  const fillClass = tone === 'ok' ? 'bg-emerald-600' : tone === 'warn' ? 'bg-amber-500' : 'bg-slate-400';

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
