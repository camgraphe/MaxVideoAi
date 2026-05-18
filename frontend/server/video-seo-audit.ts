import { buildExpectedVideoCanonicalUrl, validateVideoSeoCanonical } from '@/lib/video-seo-canonical';

export type VideoSeoAuditClassification =
  | 'keep_indexable'
  | 'needs_enrichment'
  | 'deindex'
  | 'duplicate_or_conflict';

export type VideoSeoAuditSourceRow = {
  videoId: string;
  seoStatus?: string | null;
  isEligible: boolean;
  canonicalUrl?: string | null;
  expectedCanonicalUrl?: string | null;
  videoObjectPresent?: boolean;
  stableThumbnailUrl?: boolean;
  stableVideoUrl?: boolean;
  internalLinkCount?: number | null;
  editorialQaErrors?: string[];
  technicalEligibilityBlockers?: string[];
  canonicalConflictIds?: ReadonlySet<string> | readonly string[] | null;
};

export type VideoSeoAuditRow = {
  videoId: string;
  seoStatus: string;
  isEligible: boolean;
  robots: 'index, follow' | 'noindex, follow';
  canonicalUrl: string | null;
  expectedCanonicalUrl: string;
  sitemapIncluded: boolean;
  videoSitemapIncluded: boolean;
  videoObjectPresent: boolean;
  stableThumbnailUrl: boolean;
  stableVideoUrl: boolean;
  mediaGateResult: 'pass' | 'blocked';
  internalLinkCount: number | null;
  blockers: string[];
  classification: VideoSeoAuditClassification;
};

export type VideoSeoAuditReport = {
  generatedAt: string;
  summary: {
    total: number;
    keep_indexable: number;
    needs_enrichment: number;
    deindex: number;
    duplicate_or_conflict: number;
  };
  rows: VideoSeoAuditRow[];
};

function uniqueList(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value && value.trim().length))));
}

function toConflictArray(value: VideoSeoAuditSourceRow['canonicalConflictIds']): string[] {
  if (!value) return [];
  return value instanceof Set ? [...value] : [...value];
}

function buildCanonicalConflictMap(rows: VideoSeoAuditSourceRow[]): Map<string, string[]> {
  const byCanonical = new Map<string, string[]>();
  for (const row of rows) {
    const canonical = row.canonicalUrl?.trim();
    if (!canonical) continue;
    byCanonical.set(canonical, [...(byCanonical.get(canonical) ?? []), row.videoId]);
  }
  return byCanonical;
}

function classifyAuditRow(params: {
  row: VideoSeoAuditSourceRow;
  blockers: string[];
  stableThumbnailUrl: boolean;
  stableVideoUrl: boolean;
  videoObjectPresent: boolean;
  canonicalBlockers: string[];
}): VideoSeoAuditClassification {
  const { row, blockers, canonicalBlockers, stableThumbnailUrl, stableVideoUrl, videoObjectPresent } = params;
  if (canonicalBlockers.includes('Canonical conflict') || blockers.some((blocker) => /duplicat|conflict/i.test(blocker))) {
    return 'duplicate_or_conflict';
  }
  if (row.isEligible && videoObjectPresent && stableThumbnailUrl && stableVideoUrl && blockers.length === 0) {
    return 'keep_indexable';
  }
  if (row.seoStatus === 'disabled' || !stableVideoUrl || blockers.some((blocker) => /visibility|discovery|video asset url is missing/i.test(blocker))) {
    return 'deindex';
  }
  return 'needs_enrichment';
}

export function buildVideoSeoAuditReport(rows: VideoSeoAuditSourceRow[]): VideoSeoAuditReport {
  const conflictMap = buildCanonicalConflictMap(rows);
  const auditRows = rows.map((row) => {
    const expectedCanonicalUrl = row.expectedCanonicalUrl ?? buildExpectedVideoCanonicalUrl(row.videoId);
    const duplicateCanonicalIds = (conflictMap.get(row.canonicalUrl ?? '') ?? []).filter((id) => id !== row.videoId);
    const canonicalConflictIds = [...duplicateCanonicalIds, ...toConflictArray(row.canonicalConflictIds)];
    const canonical = validateVideoSeoCanonical({
      videoId: row.videoId,
      canonicalUrl: row.canonicalUrl,
      expectedCanonicalUrl,
      canonicalConflictIds,
      canonicalTargetIndexable: row.isEligible,
    });
    const stableThumbnailUrl = Boolean(row.stableThumbnailUrl);
    const stableVideoUrl = Boolean(row.stableVideoUrl);
    const videoObjectPresent = Boolean(row.videoObjectPresent);
    const mediaGateResult = stableThumbnailUrl && stableVideoUrl ? 'pass' : 'blocked';
    const blockers = uniqueList([
      ...(row.technicalEligibilityBlockers ?? []),
      ...(row.editorialQaErrors ?? []),
      ...canonical.blockerLabels,
      videoObjectPresent ? null : 'VideoObject missing',
      stableThumbnailUrl ? null : 'Stable public thumbnail asset is required.',
      stableVideoUrl ? null : 'Stable public video asset is required.',
    ]);
    const classification = classifyAuditRow({
      row,
      blockers,
      stableThumbnailUrl,
      stableVideoUrl,
      videoObjectPresent,
      canonicalBlockers: canonical.blockerLabels,
    });

    return {
      videoId: row.videoId,
      seoStatus: row.seoStatus ?? 'candidate',
      isEligible: row.isEligible,
      robots: row.isEligible ? 'index, follow' : 'noindex, follow',
      canonicalUrl: canonical.canonicalUrl,
      expectedCanonicalUrl,
      sitemapIncluded: row.isEligible,
      videoSitemapIncluded: row.isEligible,
      videoObjectPresent,
      stableThumbnailUrl,
      stableVideoUrl,
      mediaGateResult,
      internalLinkCount: row.internalLinkCount ?? null,
      blockers,
      classification,
    } satisfies VideoSeoAuditRow;
  });
  const summary = {
    total: auditRows.length,
    keep_indexable: auditRows.filter((row) => row.classification === 'keep_indexable').length,
    needs_enrichment: auditRows.filter((row) => row.classification === 'needs_enrichment').length,
    deindex: auditRows.filter((row) => row.classification === 'deindex').length,
    duplicate_or_conflict: auditRows.filter((row) => row.classification === 'duplicate_or_conflict').length,
  };

  return {
    generatedAt: new Date().toISOString(),
    summary,
    rows: auditRows,
  };
}
