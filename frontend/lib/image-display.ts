/** Durable measured display facts. Grants never form part of this identity. */
export type ImageDisplay = {
  version: 1;
  profile: 'image-display-v1';
  sourceUrl: string;
  sourceSha256: string;
  url: string;
  mimeType: 'image/webp';
  width: number;
  height: number;
  sizeBytes: number;
};

function durableUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return (
      /^(https?:)$/.test(url.protocol) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

export function parseImageDisplay(
  value: unknown,
  originalUrl: string,
  previewUrl?: string | null,
): ImageDisplay | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const facts = value as Record<string, unknown>;
  if (
    facts.version !== 1 ||
    facts.profile !== 'image-display-v1' ||
    facts.mimeType !== 'image/webp' ||
    facts.sourceUrl !== originalUrl ||
    !durableUrl(facts.sourceUrl) ||
    !durableUrl(facts.url) ||
    facts.url === originalUrl ||
    (previewUrl !== undefined && facts.url !== previewUrl) ||
    typeof facts.sourceSha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(facts.sourceSha256) ||
    ![facts.width, facts.height, facts.sizeBytes].every(
      (v) => typeof v === 'number' && Number.isSafeInteger(v) && v > 0,
    ) ||
    Number(facts.width) > 1920 ||
    Number(facts.height) > 1920
  )
    return undefined;
  return {
    version: 1,
    profile: 'image-display-v1',
    sourceUrl: facts.sourceUrl,
    sourceSha256: facts.sourceSha256,
    url: facts.url,
    mimeType: 'image/webp',
    width: Number(facts.width),
    height: Number(facts.height),
    sizeBytes: Number(facts.sizeBytes),
  };
}

export function imageDisplayFields(
  value: unknown,
  originalUrl: string,
  previewUrl?: string | null,
) {
  const imageDisplay = parseImageDisplay(value, originalUrl, previewUrl);
  return imageDisplay ? { previewUrl: imageDisplay.url, imageDisplay } : {};
}
