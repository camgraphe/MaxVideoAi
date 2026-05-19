type VideoSitemapDateEntry = {
  publishedAt?: string | null;
  modifiedAt?: string | null;
};

type VideoSitemapDateVideo = {
  createdAt?: string | null;
};

function parseDate(value?: string | number | Date | null): Date | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function pickValidDate(...values: Array<string | number | Date | null | undefined>): Date | null {
  for (const value of values) {
    const date = parseDate(value);
    if (date) return date;
  }
  return null;
}

function formatSitemapDate(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

export function resolveVideoSitemapDates(entry: VideoSitemapDateEntry, video: VideoSitemapDateVideo) {
  const publicationDate = pickValidDate(entry.publishedAt, video.createdAt);
  const modifiedDate = pickValidDate(entry.modifiedAt, entry.publishedAt, video.createdAt);

  return {
    lastModified: formatSitemapDate(modifiedDate),
    publicationDate: publicationDate?.toISOString() ?? null,
  };
}
