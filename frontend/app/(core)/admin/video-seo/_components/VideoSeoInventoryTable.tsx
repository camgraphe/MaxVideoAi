'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { VideoThumbnailEditor } from '@/components/admin/VideoThumbnailEditor.client';
import { Button } from '@/components/ui/Button';
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedRow = useMemo(
    () => rows.find((row) => row.entry.id === selectedId) ?? null,
    [rows, selectedId]
  );

  useEffect(() => {
    if (selectedId && !selectedRow) {
      setSelectedId(null);
    }
  }, [selectedId, selectedRow]);

  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
        {rows.map((row) => (
          <VideoSeoVideoCard
            key={row.entry.id}
            row={row}
            selected={row.entry.id === selectedId}
            onSelect={() => setSelectedId(row.entry.id)}
          />
        ))}
      </div>

      {selectedRow ? <VideoSeoDetailModal row={selectedRow} onClose={() => setSelectedId(null)} /> : null}
    </>
  );
}

function VideoSeoVideoCard({
  row,
  selected,
  onSelect,
}: {
  row: WatchRow;
  selected: boolean;
  onSelect: () => void;
}) {
  const frameClass = row.seoStatus === 'disabled'
    ? 'border-hairline opacity-75'
    : row.isReady
      ? 'border-emerald-500/40 hover:border-emerald-500/70'
      : 'border-warning-border/70 hover:border-warning-border';

  return (
    <button
      type="button"
      aria-label={`Open video SEO details for ${row.generatedTitle}`}
      onClick={onSelect}
      className={`group min-w-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${selected ? 'ring-2 ring-ring ring-offset-2 ring-offset-bg' : ''}`}
    >
      <span className={`block overflow-hidden rounded-lg border bg-surface-2 transition ${frameClass}`}>
        {row.video?.thumbUrl ? (
          <Image
            src={row.video.thumbUrl}
            alt=""
            width={360}
            height={203}
            unoptimized
            className="aspect-video w-full object-cover transition group-hover:scale-[1.02]"
          />
        ) : (
          <span className="flex aspect-video items-center justify-center bg-bg text-xs font-medium text-text-muted">
            No thumbnail
          </span>
        )}
      </span>
      <span className="mt-2 block line-clamp-2 text-sm font-semibold leading-5 text-text-primary group-hover:underline">
        {row.generatedTitle}
      </span>
      <span className="sr-only">
        {row.isReady ? 'Ready for sitemap' : 'Needs review'}, status {row.seoStatus}
      </span>
    </button>
  );
}

function VideoSeoDetailModal({ row, onClose }: { row: WatchRow; onClose: () => void }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center bg-surface-on-media-dark-60 px-3 py-4 backdrop-blur-sm sm:px-6"
      onMouseDown={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={`video-seo-detail-${row.entry.id}`}
        onMouseDown={(event) => event.stopPropagation()}
        className="flex max-h-[94vh] w-full max-w-[min(1500px,96vw)] flex-col overflow-hidden rounded-lg border border-hairline bg-bg shadow-2xl"
      >
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-hairline bg-surface px-4 py-4 sm:px-5">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone={row.inVideoSitemap ? 'ok' : 'warn'}>
                Sitemap: {row.inVideoSitemap ? 'Yes' : 'No'}
              </StatusPill>
              <StatusPill tone={row.seoStatus === 'approved' ? 'ok' : 'neutral'}>{row.seoStatus}</StatusPill>
              <StatusPill tone={row.isReady ? 'ok' : 'warn'}>{row.isReady ? 'Ready' : 'Review'}</StatusPill>
            </div>
            <h2 id={`video-seo-detail-${row.entry.id}`} className="text-xl font-semibold text-text-primary sm:text-2xl">
              {row.generatedTitle}
            </h2>
            <p className="text-sm text-text-muted">
              {row.entry.engineLabel} · {row.entry.engineFamily} · Priority {row.entry.priority}
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onClose} autoFocus>
            Close
          </Button>
        </header>

        <div className="overflow-y-auto px-4 py-5 sm:px-5">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(380px,0.92fr)]">
            <div className="space-y-5">
              <WatchPreview
                title={row.generatedTitle}
                watchPath={row.watchPath}
                thumbUrl={row.video?.thumbUrl ?? null}
                ready={row.isReady}
              />
              <VideoSeoVideoSummary row={row} />
              <VideoSeoRolloutPanel row={row} />
            </div>

            <div className="space-y-5">
              <VideoSeoActionsPanel row={row} />
              <VideoSeoEditorialPanel row={row} />
              <VideoSeoEditorPanel row={row} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function VideoSeoVideoSummary({ row }: { row: WatchRow }) {
  return (
    <section className="space-y-3 rounded-lg border border-hairline bg-surface px-4 py-4">
      <div className="min-w-0 space-y-2">
        <p className="line-clamp-3 text-sm text-text-secondary">{row.generatedIntro}</p>
        <div className="grid gap-2 text-xs text-text-muted sm:grid-cols-2">
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
            <a href={row.watchUrl} className="break-all font-mono text-[11px] text-text-primary hover:underline">
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
    </section>
  );
}

function VideoSeoRolloutPanel({ row }: { row: WatchRow }) {
  return (
    <section className="space-y-4 rounded-lg border border-hairline bg-surface px-4 py-4">
      <div className="flex flex-wrap gap-2">
        <StatusPill tone={row.sitemapEligibilityLabel === 'Eligible' ? 'ok' : 'warn'}>
          Sitemap eligibility: {row.sitemapEligibilityLabel}
        </StatusPill>
        <StatusPill tone={row.robots === 'index, follow' ? 'ok' : 'warn'}>Robots: {row.robots}</StatusPill>
        <StatusPill tone={row.canonicalBlockers.length ? 'warn' : 'ok'}>
          Canonical: {row.canonicalBlockers.length ? 'Review' : 'OK'}
        </StatusPill>
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

      <InfoPanel title="Sitemap eligibility:">
        <p className={row.inVideoSitemap ? 'text-sm font-semibold text-success' : 'text-sm font-semibold text-warning'}>
          {row.sitemapEligibilityLabel}
        </p>
        <ReasonList items={row.sitemapEligibilityReasons} maxItems={6} />
      </InfoPanel>

      <InfoPanel title="Canonical">
        <p className="break-all font-mono text-[11px] text-text-secondary">{row.canonicalUrl ?? 'Missing canonical'}</p>
        <p className="mt-1 break-all font-mono text-[11px] text-text-muted">Expected: {row.expectedCanonicalUrl}</p>
        {row.canonicalBlockers.length ? (
          <ReasonList items={row.canonicalBlockers} tone="warn" />
        ) : (
          <p className="mt-2 text-xs text-text-muted">
            Canonical checks pass: {CANONICAL_BLOCKER_LABELS.join(', ')}.
          </p>
        )}
      </InfoPanel>

      {row.technicalEligibilityBlockers.length ? (
        <InfoPanel title="Technical / eligibility blockers" tone="warn">
          <ReasonList items={row.technicalEligibilityBlockers} maxItems={6} tone="warn" />
        </InfoPanel>
      ) : (
        <p className="text-xs text-text-muted">No technical or eligibility blocker detected.</p>
      )}

      <InfoPanel title="Editorial QA errors">
        {row.editorialQaErrors.length ? (
          <ReasonList items={row.editorialQaErrors} maxItems={6} tone="warn" />
        ) : (
          <p className="text-xs text-text-muted">No contractual QA error detected.</p>
        )}
      </InfoPanel>
    </section>
  );
}

function VideoSeoEditorialPanel({ row }: { row: WatchRow }) {
  return (
    <section className="space-y-4 rounded-lg border border-hairline bg-surface px-4 py-4">
      <InfoPanel title="Preview SERP">
        <p className="line-clamp-2 text-sm font-semibold text-text-primary">{row.previewSerpTitle}</p>
        <p className="mt-1 line-clamp-4 text-xs leading-5 text-text-secondary">{row.previewSerpDescription}</p>
        <p className="mt-2 truncate font-mono text-[11px] text-text-muted">{row.watchUrl}</p>
      </InfoPanel>

      <div className="space-y-3">
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

      <LinkList row={row} />
    </section>
  );
}

function VideoSeoActionsPanel({ row }: { row: WatchRow }) {
  return (
    <section className="space-y-3 rounded-lg border border-hairline bg-surface px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <ActionLink href={row.watchPath} primary>
          Open watch page
        </ActionLink>
        <ActionLink href={row.auditPath}>Open job audit</ActionLink>
        {row.video?.videoUrl ? (
          <ActionAnchor href={row.video.videoUrl}>
            Open video asset
          </ActionAnchor>
        ) : null}
        {row.video?.thumbUrl ? (
          <ActionAnchor href={row.video.thumbUrl}>
            Open thumbnail
          </ActionAnchor>
        ) : null}
      </div>

      <details className="rounded-lg border border-hairline bg-bg/40">
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
    </section>
  );
}

function VideoSeoEditorPanel({ row }: { row: WatchRow }) {
  return (
    <section className="space-y-3 rounded-lg border border-hairline bg-surface px-4 py-4">
      <div>
        <h3 className="text-sm font-semibold text-text-primary">Editorial editor</h3>
        <p className="mt-1 text-xs text-text-muted">
          Set SEO status to approved here. Sitemap inclusion still depends on QA, canonical, stable assets, and internal links.
        </p>
      </div>
      {row.editorial ? (
        <VideoSeoEditorialEditor editorial={row.editorial} />
      ) : (
        <p className="rounded-lg border border-hairline bg-bg/50 px-3 py-3 text-sm text-text-secondary">
          This row is still using a config fallback. Add it as a candidate first to create an editable DB override.
        </p>
      )}
    </section>
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
      className="group relative block overflow-hidden rounded-lg border border-hairline bg-surface-2"
    >
      {thumbUrl ? (
        <Image
          src={thumbUrl}
          alt={title}
          width={960}
          height={540}
          unoptimized
          className="aspect-video w-full object-cover transition group-hover:scale-[1.01]"
        />
      ) : (
        <div className="flex aspect-video items-center justify-center bg-bg text-xs font-medium text-text-muted">No thumbnail</div>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent px-3 py-2 text-[11px] font-semibold text-white">
        <span>{ready ? 'Ready' : 'Review'}</span>
        <span>Open watch page</span>
      </div>
    </Link>
  );
}

function LinkList({ row }: { row: WatchRow }) {
  return (
    <div className="space-y-1 text-xs text-text-muted">
      {row.modelPath ? (
        <p>
          Model:{' '}
          <Link href={row.modelPath} prefetch={false} className="font-medium text-text-primary hover:underline">
            {row.modelLabel ?? row.modelPath}
          </Link>
        </p>
      ) : null}

      {row.examplesPath ? (
        <p>
          Examples:{' '}
          <Link href={row.examplesPath} prefetch={false} className="font-medium text-text-primary hover:underline">
            {row.examplesLabel ?? row.examplesPath}
          </Link>
        </p>
      ) : null}

      {row.parentPath ? (
        <p>
          Parent hub:{' '}
          <Link href={row.parentPath} prefetch={false} className="font-medium text-text-primary hover:underline">
            {row.parentLabel ?? row.parentPath}
          </Link>
        </p>
      ) : null}
    </div>
  );
}

function InfoPanel({
  children,
  title,
  tone = 'neutral',
}: {
  children: ReactNode;
  title: string;
  tone?: 'neutral' | 'warn';
}) {
  const toneClass = tone === 'warn'
    ? 'border-warning-border/60 bg-warning-bg/15'
    : 'border-hairline bg-bg/50';

  return (
    <div className={`rounded-lg border px-3 py-3 ${toneClass}`}>
      <p className={tone === 'warn'
        ? 'text-[11px] font-semibold uppercase tracking-[0.18em] text-warning'
        : 'text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted'}
      >
        {title}
      </p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function ReasonList({
  items,
  maxItems = 4,
  tone = 'neutral',
}: {
  items: string[];
  maxItems?: number;
  tone?: 'neutral' | 'warn';
}) {
  return (
    <ul className={tone === 'warn' ? 'mt-2 space-y-1 text-xs text-warning' : 'mt-2 space-y-1 text-xs text-text-secondary'}>
      {items.slice(0, maxItems).map((reason) => (
        <li key={reason}>• {reason}</li>
      ))}
      {items.length > maxItems ? <li>• +{items.length - maxItems} more reason(s)</li> : null}
    </ul>
  );
}

function ActionLink({ children, href, primary = false }: { children: ReactNode; href: string; primary?: boolean }) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={
        primary
          ? 'inline-flex min-h-[36px] items-center justify-center rounded-input bg-[image:var(--brand-gradient)] px-3 py-1.5 text-xs font-semibold text-on-brand shadow-[var(--shadow-brand-button)]'
          : 'inline-flex min-h-[36px] items-center justify-center rounded-input border border-hairline bg-surface px-3 py-1.5 text-xs font-semibold text-text-primary hover:border-border-hover hover:bg-surface-hover'
      }
    >
      {children}
    </Link>
  );
}

function ActionAnchor({ children, href }: { children: ReactNode; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex min-h-[36px] items-center justify-center rounded-input border border-hairline bg-surface px-3 py-1.5 text-xs font-semibold text-text-primary hover:border-border-hover hover:bg-surface-hover"
    >
      {children}
    </a>
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
