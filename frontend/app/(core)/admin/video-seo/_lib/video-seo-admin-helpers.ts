import { Eye, Film, Radar, ShieldCheck } from 'lucide-react';
import type { AdminMetricItem } from '@/components/admin-system/surfaces/AdminMetricGrid';
import { SITE_ORIGIN } from '@/lib/siteOrigin';
import type { SeoWatchVideoMeta, SeoWatchVideoRow } from '@/server/video-seo';
import type { GalleryVideo } from '@/server/videos';

const numberFormatter = new Intl.NumberFormat('en-US');
const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export type WatchRow = {
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

export function buildWatchRows(rows: SeoWatchVideoRow[]): WatchRow[] {
  return rows.map((row) => buildWatchRow(row)).sort(compareWatchRows);
}

export function buildWatchRow({ entry, video, isEligible, signals, related }: SeoWatchVideoRow): WatchRow {
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

export function compareWatchRows(a: WatchRow, b: WatchRow) {
  if (a.isReady !== b.isReady) return Number(a.isReady) - Number(b.isReady);
  if (b.issues.length !== a.issues.length) return b.issues.length - a.issues.length;
  if (a.entry.priority !== b.entry.priority) return a.entry.priority - b.entry.priority;
  return a.generatedTitle.localeCompare(b.generatedTitle);
}

export function buildOverviewItems(rows: WatchRow[]): AdminMetricItem[] {
  const summary = buildVideoSeoSummary(rows);

  return [
    {
      label: 'Watch pages',
      value: numberFormatter.format(rows.length),
      helper: 'Curated /video pages inside the rollout',
      icon: Eye,
    },
    {
      label: 'Ready now',
      value: numberFormatter.format(summary.readyCount),
      helper: 'Public, discovery on, with video and thumbnail',
      tone: summary.issueCount ? 'warning' : 'success',
      icon: ShieldCheck,
    },
    {
      label: 'Needs attention',
      value: numberFormatter.format(summary.issueCount),
      helper: 'Pages drifting away from rollout rules',
      tone: summary.issueCount ? 'warning' : 'default',
      icon: Radar,
    },
    {
      label: 'Engine families',
      value: numberFormatter.format(summary.engineFamilies),
      helper: `${numberFormatter.format(summary.liveAssetCount)} live media assets on the shortlist`,
      icon: Film,
    },
  ];
}

export function buildVideoSeoSummary(rows: WatchRow[]) {
  const readyCount = rows.filter((row) => row.isReady).length;
  const issueCount = rows.length - readyCount;
  const liveAssetCount = rows.filter((row) => Boolean(row.video?.videoUrl)).length;
  const engineFamilies = new Set(rows.map((row) => row.entry.engineFamily)).size;
  const strongRows = rows.filter((row) => row.completenessScore >= 80 && row.differentiationScore >= 70).length;

  return {
    engineFamilies,
    issueCount,
    liveAssetCount,
    readyCount,
    strongRows,
  };
}

export function buildWatchPath(id: string): string {
  return `/video/${encodeURIComponent(id)}`;
}

export function formatDate(value?: string | null): string {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return dateFormatter.format(date);
}

export function formatDateTime(value?: string | null): string {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return dateTimeFormatter.format(date);
}

export function formatDuration(value?: number | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 'Unknown';
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  if (minutes <= 0) return `${seconds}s`;
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
}
