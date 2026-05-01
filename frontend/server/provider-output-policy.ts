export const PROVIDER_VIDEO_COPY_FAILURE_MESSAGE =
  'The provider finished this render, but the video could not be copied to MaxVideoAI storage. Please retry.';

export type ProviderMediaLog = {
  present: boolean;
  host: string | null;
  managedStorage: boolean;
};

function enabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === 'true' || value?.trim() === '1';
}

export function requireFalProviderVideoCopy(): boolean {
  return enabled(process.env.REQUIRE_PROVIDER_VIDEO_COPY_FOR_FAL);
}

export function isManagedStorageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const publicBase = process.env.S3_PUBLIC_BASE_URL?.trim();
    if (publicBase) {
      try {
        const base = new URL(publicBase);
        if (parsed.host === base.host) return true;
      } catch {
        // Ignore invalid env and fall through to bucket host matching.
      }
    }

    const bucket = process.env.S3_BUCKET?.trim();
    if (!bucket) return false;
    const region = process.env.S3_REGION?.trim();
    const regionalHost = region ? `${bucket}.s3.${region}.amazonaws.com` : `${bucket}.s3.amazonaws.com`;
    return parsed.host === regionalHost;
  } catch {
    return false;
  }
}

export function shouldFailVideoJobOnProviderCopyMiss(params: {
  provider: string | null | undefined;
  sourceUrl: string | null | undefined;
  copiedUrl: string | null | undefined;
  currentJobStatus?: string | null | undefined;
}): boolean {
  if (params.provider !== 'fal') return false;
  if (!requireFalProviderVideoCopy()) return false;
  if (params.currentJobStatus?.trim().toLowerCase() === 'completed') return false;
  if (!params.sourceUrl || !/^https?:\/\//i.test(params.sourceUrl)) return false;
  if (params.copiedUrl) return false;
  return !isManagedStorageUrl(params.sourceUrl);
}

export function buildSafeProviderMediaLog(url: string | null | undefined): ProviderMediaLog {
  if (!url) {
    return { present: false, host: null, managedStorage: false };
  }
  try {
    const parsed = new URL(url);
    return {
      present: true,
      host: parsed.host,
      managedStorage: isManagedStorageUrl(url),
    };
  } catch {
    return { present: true, host: null, managedStorage: false };
  }
}
