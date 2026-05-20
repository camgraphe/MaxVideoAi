import type { EligibleSeoWatchVideoRow } from '@/server/video-seo';
import { resolveVideoSitemapDates } from './video-dates';

export type VideoWatchSitemapEntry = EligibleSeoWatchVideoRow & {
  loc: string;
  lastModified?: string;
  publicationDate?: string;
};

export function getVideoWatchSitemapEntries(watchVideos: EligibleSeoWatchVideoRow[]): VideoWatchSitemapEntry[] {
  return watchVideos.flatMap((row) => {
    const loc = row.signals.canonicalUrl?.trim();
    if (!loc) {
      return [];
    }

    const dates = resolveVideoSitemapDates(row.entry, row.video);
    return [
      {
        ...row,
        loc,
        lastModified: dates.lastModified ?? undefined,
        publicationDate: dates.publicationDate ?? undefined,
      },
    ];
  });
}
