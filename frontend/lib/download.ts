'use client';

type TriggerDownloadOptions = {
  filename?: string;
  defaultExtension?: string;
};

function sanitizeFilename(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return 'download';
  const collapsed = trimmed.replace(/\s+/g, ' ');
  const cleaned = collapsed.replace(/[^a-z0-9._ -]+/gi, '-');
  const withoutLeading = cleaned.replace(/^[.-\s]+/, '');
  const withoutTrailing = withoutLeading.replace(/[.-\s]+$/, '');
  return withoutTrailing || 'download';
}

function extensionFromUrl(url: string): string | null {
  try {
    const pathname = new URL(url, window.location.href).pathname;
    const segment = pathname.split('/').pop() ?? '';
    if (!segment.includes('.')) return null;
    const ext = segment.split('.').pop() ?? '';
    if (!ext || ext.length > 8) return null;
    return ext.toLowerCase();
  } catch {
    return null;
  }
}

function extensionFromContentType(contentType: string | null): string | null {
  if (!contentType) return null;
  const normalized = contentType.split(';')[0]?.trim().toLowerCase();
  switch (normalized) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    case 'video/mp4':
      return 'mp4';
    case 'video/webm':
      return 'webm';
    default:
      return null;
  }
}

function anchorDownload(url: string, filename?: string) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename ?? '';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

export async function triggerBrowserDownload(url: string, options: TriggerDownloadOptions = {}) {
  if (typeof window === 'undefined') return;
  const safeUrl = typeof url === 'string' ? url.trim() : '';
  if (!safeUrl) return;

  try {
    const response = await fetch(safeUrl);
    if (!response.ok) {
      throw new Error(`Download failed (${response.status})`);
    }
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);

    const extension =
      extensionFromUrl(safeUrl) ??
      extensionFromContentType(response.headers.get('content-type')) ??
      options.defaultExtension ??
      'bin';

    const baseName =
      options.filename?.trim() ||
      (() => {
        try {
          const pathname = new URL(safeUrl, window.location.href).pathname;
          const segment = pathname.split('/').pop() ?? '';
          return segment || 'download';
        } catch {
          return 'download';
        }
      })();

    const sanitized = sanitizeFilename(baseName.replace(/\.[a-z0-9]{1,8}$/i, ''));
    const filename = `${sanitized}.${extension}`;

    anchorDownload(blobUrl, filename);
    window.URL.revokeObjectURL(blobUrl);
  } catch {
    const fallbackName = options.filename ? sanitizeFilename(options.filename) : undefined;
    anchorDownload(safeUrl, fallbackName);
  }
}

