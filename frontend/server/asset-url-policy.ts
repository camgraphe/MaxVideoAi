// Read-only URL admissibility shared by quote validation and media storage.
const S3_BUCKET = (process.env.S3_BUCKET || '').trim();
const S3_REGION = (process.env.S3_REGION || '').trim();
const S3_PUBLIC_BASE_URL = (process.env.S3_PUBLIC_BASE_URL || '').trim();

const DEFAULT_ALLOWED_HOSTS = new Set([
  'cdn.maxvideoai.com',
  'media.maxvideoai.com',
  'blob.vercel-storage.com',
  'storage.googleapis.com',
  's3.amazonaws.com',
]);

function buildHostAllowList(): Set<string> {
  const hosts = new Set(DEFAULT_ALLOWED_HOSTS);
  if (S3_PUBLIC_BASE_URL) {
    try {
      hosts.add(new URL(S3_PUBLIC_BASE_URL).host);
    } catch {
      // ignore invalid URL
    }
  } else if (S3_BUCKET) {
    const regionalHost = S3_REGION ? `${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com` : `${S3_BUCKET}.s3.amazonaws.com`;
    hosts.add(regionalHost);
  }
  if (process.env.ASSET_HOST_ALLOWLIST) {
    process.env.ASSET_HOST_ALLOWLIST.split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .forEach((host) => hosts.add(host));
  }
  return hosts;
}

const ALLOWED_HOSTS = buildHostAllowList();

export function isAllowedAssetHost(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    return ALLOWED_HOSTS.has(parsed.host);
  } catch {
    return false;
  }
}

/** Pure URL admissibility only; callers must separately establish row and storage-object ownership. */
export function validReferenceMediaUrl(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 4_096 ||
    !isAllowedAssetHost(value)
  ) {
    return false;
  }
  try {
    const parsed = new URL(value);
    return (
      parsed.protocol === "https:" &&
      parsed.username.length === 0 &&
      parsed.password.length === 0 &&
      parsed.hash.length === 0 &&
      (parsed.port.length === 0 || parsed.port === "443") &&
      parsed.pathname !== "/"
    );
  } catch {
    return false;
  }
}
