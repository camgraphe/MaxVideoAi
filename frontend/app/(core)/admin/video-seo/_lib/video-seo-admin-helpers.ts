import { Eye, Film, Radar, ShieldCheck } from 'lucide-react';
import type { AdminMetricItem } from '@/components/admin-system/surfaces/AdminMetricGrid';
import { isStablePublicMediaUrl } from '@/lib/media';
import { countEditorialWords } from '@/lib/video-seo-editorial-qa';
import { buildExpectedVideoCanonicalUrl, validateVideoSeoCanonical } from '@/lib/video-seo-canonical';
import type { SeoWatchVideoMeta, SeoWatchVideoRow } from '@/server/video-seo';
import type { GalleryVideo } from '@/server/videos';
import type { PersistedVideoSeoEditorialEntry } from '@/server/video-seo-editorial';

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
  editorial: PersistedVideoSeoEditorialEntry | null;
  issues: string[];
  watchPath: string;
  watchUrl: string;
  canonicalUrl: string | null;
  expectedCanonicalUrl: string;
  canonicalBlockers: string[];
  auditPath: string;
  isReady: boolean;
  inVideoSitemap: boolean;
  sitemapEligibilityLabel: 'Eligible' | 'Blocked';
  sitemapEligibilityReasons: string[];
  robots: 'index, follow' | 'noindex, follow';
  seoStatus: string;
  editorialSourceLabel: 'DB override' | 'Config fallback';
  generatedTitle: string;
  generatedIntro: string;
  previewSerpTitle: string;
  previewSerpDescription: string;
  videoObjectName: string;
  targetKeyword: string | null;
  editorialQaErrors: string[];
  technicalEligibilityBlockers: string[];
  promptWordCount: number;
  modelPath: string | null;
  modelLabel: string | null;
  examplesPath: string | null;
  examplesLabel: string | null;
  parentPath: string | null;
  parentLabel: string | null;
  stableVideoAsset: boolean;
  stableThumbnailAsset: boolean;
  internalLinkTargets: boolean;
  relatedCount: number;
  completenessScore: number;
  differentiationScore: number;
};

export function buildWatchRows(rows: SeoWatchVideoRow[]): WatchRow[] {
  return rows.map((row) => buildWatchRow(row)).sort(compareWatchRows);
}

function uniqueList(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

export function buildWatchRow({ entry, video, editorial, isEligible, signals, related }: SeoWatchVideoRow): WatchRow {
  const watchPath = buildWatchPath(entry.id);
  const technicalEligibilityBlockers: string[] = [];
  const generatedSignals = signals;
  const relatedCount = related.length;
  const parentPath = generatedSignals?.parentPath ?? null;
  const modelPath = generatedSignals?.modelPath ?? (editorial?.modelSlug ? `/models/${editorial.modelSlug}` : null);
  const examplesPath =
    generatedSignals?.exampleFamily ? `/examples/${generatedSignals.exampleFamily}` : editorial?.examplesSlug ? `/examples/${editorial.examplesSlug}` : null;
  const stableVideoAsset = isStablePublicMediaUrl(video?.videoUrl);
  const stableThumbnailAsset = isStablePublicMediaUrl(video?.thumbUrl);
  const internalLinkTargets = Boolean(modelPath && examplesPath && parentPath);
  const expectedCanonicalUrl = buildExpectedVideoCanonicalUrl(entry.id);
  const canonicalUrl = generatedSignals?.canonicalUrl ?? expectedCanonicalUrl;
  const canonicalTargetIndexable = Boolean(
    video?.videoUrl &&
      video?.thumbUrl &&
      video?.visibility === 'public' &&
      video?.indexable &&
      stableVideoAsset &&
      stableThumbnailAsset &&
      internalLinkTargets
  );
  const canonicalValidation = validateVideoSeoCanonical({
    videoId: entry.id,
    canonicalUrl,
    expectedCanonicalUrl,
    canonicalTargetIndexable,
  });
  const canonicalBlockers = canonicalValidation.blockerLabels;

  if (!video) {
    technicalEligibilityBlockers.push('Video missing from app_jobs.');
  } else {
    if (video.visibility !== 'public') technicalEligibilityBlockers.push(`Visibility is ${video.visibility}.`);
    if (!video.indexable) technicalEligibilityBlockers.push('Public discovery is disabled.');
    if (!video.videoUrl) technicalEligibilityBlockers.push('Video asset URL is missing.');
    if (!video.thumbUrl) technicalEligibilityBlockers.push('Thumbnail URL is missing.');
    if (video.videoUrl && !stableVideoAsset) technicalEligibilityBlockers.push('Stable public video asset is required.');
    if (video.thumbUrl && !stableThumbnailAsset) technicalEligibilityBlockers.push('Stable public thumbnail asset is required.');
  }
  if (!internalLinkTargets) technicalEligibilityBlockers.push('Internal link targets are missing.');
  technicalEligibilityBlockers.push(...canonicalBlockers);
  const editorialQaNotes =
    generatedSignals?.auditNotes?.filter((note) => note.startsWith('Editorial QA:')).map((note) => note.replace(/^Editorial QA:\s*/, '')) ?? [];
  const nonEditorialAuditNotes = generatedSignals?.auditNotes?.filter((note) => !note.startsWith('Editorial QA:')) ?? [];
  technicalEligibilityBlockers.push(...nonEditorialAuditNotes);
  if (generatedSignals?.stabilityWarnings?.length) {
    technicalEligibilityBlockers.push(...generatedSignals.stabilityWarnings);
  }
  const editorialQaErrors = generatedSignals?.editorialQaErrors ?? [];
  const editorialStatusBlockers = editorialQaNotes.filter((note) => !editorialQaErrors.includes(note));
  const sitemapEligibilityReasons = isEligible
    ? ['Contract passed']
    : uniqueList([...technicalEligibilityBlockers, ...editorialQaErrors, ...editorialStatusBlockers]);
  const issues = uniqueList([...technicalEligibilityBlockers, ...editorialQaErrors, ...editorialStatusBlockers]);

  return {
    entry,
    video,
    editorial,
    issues,
    watchPath,
    watchUrl: canonicalUrl ?? expectedCanonicalUrl,
    canonicalUrl,
    expectedCanonicalUrl,
    canonicalBlockers,
    auditPath: `/admin/jobs?jobId=${encodeURIComponent(entry.id)}`,
    isReady: isEligible && issues.length === 0,
    inVideoSitemap: isEligible,
    sitemapEligibilityLabel: isEligible ? 'Eligible' : 'Blocked',
    sitemapEligibilityReasons,
    robots: isEligible ? 'index, follow' : 'noindex, follow',
    seoStatus: generatedSignals?.seoStatus ?? editorial?.seoStatus ?? 'candidate',
    editorialSourceLabel: editorial?.source === 'database' ? 'DB override' : 'Config fallback',
    generatedTitle: generatedSignals?.title ?? entry.seoTitle,
    generatedIntro: generatedSignals?.intro ?? entry.intro,
    previewSerpTitle: generatedSignals?.metaTitle ?? entry.seoTitle,
    previewSerpDescription: generatedSignals?.metaDescription ?? entry.intro,
    videoObjectName: generatedSignals?.videoObjectName ?? editorial?.videoObjectName ?? entry.seoTitle,
    targetKeyword: generatedSignals?.targetKeyword ?? editorial?.targetKeyword ?? null,
    editorialQaErrors,
    technicalEligibilityBlockers: uniqueList(technicalEligibilityBlockers),
    promptWordCount: countEditorialWords(generatedSignals?.promptText ?? video?.prompt ?? ''),
    modelPath,
    modelLabel: generatedSignals?.modelLabel ?? (modelPath ? `Open ${entry.engineLabel} model page` : null),
    examplesPath,
    examplesLabel: examplesPath ? `Open ${entry.engineFamily} examples` : null,
    parentPath,
    parentLabel: generatedSignals?.parentLabel ?? null,
    stableVideoAsset,
    stableThumbnailAsset,
    internalLinkTargets,
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

export function splitVideoSeoRows(rows: WatchRow[]) {
  return {
    indexedRows: rows.filter((row) => row.inVideoSitemap),
    candidateRows: rows.filter((row) => !row.inVideoSitemap && row.seoStatus !== 'disabled'),
    disabledRows: rows.filter((row) => !row.inVideoSitemap && row.seoStatus === 'disabled'),
  };
}

export function buildOverviewItems(rows: WatchRow[]): AdminMetricItem[] {
  const summary = buildVideoSeoSummary(rows);

  return [
    {
      label: 'Watch pages',
      value: numberFormatter.format(rows.length),
      helper: 'Curated /video pages and admin candidates',
      icon: Eye,
    },
    {
      label: 'In video sitemap',
      value: numberFormatter.format(summary.sitemapCount),
      helper: 'Approved pages with passing SEO QA',
      tone: summary.issueCount ? 'warning' : 'success',
      icon: ShieldCheck,
    },
    {
      label: 'Candidates',
      value: numberFormatter.format(summary.candidateCount),
      helper: 'Draft or QA-blocked pages',
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
  const activeRows = rows.filter((row) => row.seoStatus !== 'disabled');
  const readyCount = activeRows.filter((row) => row.isReady).length;
  const issueCount = activeRows.filter((row) => !row.isReady && !row.inVideoSitemap).length;
  const sitemapCount = rows.filter((row) => row.inVideoSitemap).length;
  const candidateCount = activeRows.filter((row) => !row.inVideoSitemap).length;
  const disabledCount = rows.filter((row) => row.seoStatus === 'disabled').length;
  const liveAssetCount = rows.filter((row) => Boolean(row.video?.videoUrl)).length;
  const engineFamilies = new Set(rows.map((row) => row.entry.engineFamily)).size;
  const strongRows = rows.filter((row) => row.completenessScore >= 80 && row.differentiationScore >= 70).length;

  return {
    engineFamilies,
    issueCount,
    candidateCount,
    disabledCount,
    liveAssetCount,
    readyCount,
    sitemapCount,
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
