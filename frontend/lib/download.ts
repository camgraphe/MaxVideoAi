'use client';

function sanitizeFilenamePart(value: string): string {
  return value.replace(/[^a-z0-9._-]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

export function suggestDownloadFilename(url: string, fallbackBase: string): string {
  const fallback = sanitizeFilenamePart(fallbackBase) || 'download';
  try {
    const parsed = new URL(url);
    const lastSegment = parsed.pathname.split('/').pop() ?? '';
    const cleanSegment = sanitizeFilenamePart(lastSegment);
    if (cleanSegment && /\.[a-z0-9]{2,5}$/i.test(cleanSegment)) {
      return cleanSegment;
    }
    const extensionMatch = parsed.pathname.match(/\.([a-z0-9]{2,5})(?:$|\?)/i);
    if (extensionMatch) {
      return `${fallback}.${extensionMatch[1].toLowerCase()}`;
    }
  } catch {
    // ignore malformed URLs and fall back
  }
  return fallback;
}

export function buildAppDownloadUrl(url: string, fileName?: string): string {
  const params = new URLSearchParams();
  params.set('url', url);
  if (fileName?.trim()) {
    params.set('filename', fileName.trim());
  }
  return `/api/download?${params.toString()}`;
}

export function triggerAppDownload(url: string, fileName?: string): void {
  if (typeof window === 'undefined') return;
  const anchor = document.createElement('a');
  anchor.href = buildAppDownloadUrl(url, fileName);
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}
