/** A server-qualified public slug, never an arbitrary watch/job identifier. */
export function projectPublicVideoAnalyticsPath(signals: {
  seoStatus: string | null;
  indexable: boolean;
  canonicalSlug: string | null;
  canonicalUrl: string;
}): string | null {
  if (signals.seoStatus !== 'approved' || !signals.indexable || !signals.canonicalSlug) return null;
  const path = `/video/${signals.canonicalSlug}`;
  return isPublicVideoAnalyticsPath(path) && signals.canonicalUrl === `https://maxvideoai.com${path}` ? path : null;
}

export function isPublicVideoAnalyticsPath(path: unknown): path is string {
  return typeof path === 'string' && /^\/video\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(path)
    && path.length <= 147
    && !/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i.test(path);
}

/** Match the rendered reader, including after async gallery navigation. Fail closed. */
export function getVideoAnalyticsMarker(url: URL): HTMLElement | null {
  if (typeof document === 'undefined' || typeof window === 'undefined') return null;
  if (url.origin !== window.location.origin || url.pathname !== window.location.pathname) return null;
  for (const marker of document.querySelectorAll<HTMLElement>('[data-video-watch-path]')) {
    if (marker.dataset.videoWatchPath === url.pathname || marker.dataset.videoWatchIdPath === url.pathname) return marker;
  }
  return null;
}

export function getPublicVideoAnalyticsPath(url: URL): string | null {
  const marker = getVideoAnalyticsMarker(url);
  const path = marker?.dataset.videoAnalyticsPath;
  return isPublicVideoAnalyticsPath(path) && path === marker?.dataset.videoWatchPath ? path : null;
}
