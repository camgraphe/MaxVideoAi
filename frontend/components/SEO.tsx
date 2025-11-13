import { SITE_BASE_URL } from '@/lib/metadataUrls';

type SEOProps = {
  title: string;
  description: string;
  canonical: string;
  ogImage?: string;
  ogType?: string;
};

const TITLE_MIN = 45;
const TITLE_MAX = 60;
const DESCRIPTION_MIN = 120;
const DESCRIPTION_MAX = 155;
const TITLE_SUFFIXES = [' | MaxVideoAI', ' — AI Video Generator Hub'];
const DESCRIPTION_SUFFIXES = [
  ' Learn more on MaxVideoAI.',
  ' Discover pricing, models, and workflows.',
  ' Compare engines and boost your renders.',
];

function sanitizeUrl(raw: string) {
  try {
    const url = new URL(raw, SITE_BASE_URL);
    url.hash = '';
    url.search = '';
    if (!url.pathname || url.pathname === '/') {
      return url.origin;
    }
    return `${url.origin}${url.pathname.replace(/\/+$/, '') || ''}`;
  } catch {
    return raw;
  }
}

function clampWithEllipsis(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }
  const truncated = value.slice(0, maxLength - 1).trimEnd();
  return `${truncated}…`;
}

function ensureTitleLength(rawTitle: string) {
  const trimmed = rawTitle?.trim() || 'MaxVideoAI';
  const includesBrand = trimmed.toLowerCase().includes('maxvideoai');
  let workingTitle = includesBrand ? trimmed : `${trimmed}${TITLE_SUFFIXES[0]}`;
  TITLE_SUFFIXES.slice(includesBrand ? 1 : 0).forEach((suffix) => {
    if (workingTitle.length >= TITLE_MIN || workingTitle.includes(suffix.trim())) {
      return;
    }
    if (workingTitle.length + suffix.length <= TITLE_MAX) {
      workingTitle += suffix;
    }
  });
  if (workingTitle.length < TITLE_MIN && workingTitle.length + TITLE_SUFFIXES[1].length <= TITLE_MAX) {
    workingTitle += TITLE_SUFFIXES[1];
  }
  return clampWithEllipsis(workingTitle, TITLE_MAX);
}

function ensureDescriptionLength(rawDescription: string) {
  const cleaned = rawDescription?.replace(/\s+/g, ' ').trim() || 'Generate cinematic AI videos with MaxVideoAI.';
  let workingDescription = cleaned.length > DESCRIPTION_MAX ? clampWithEllipsis(cleaned, DESCRIPTION_MAX) : cleaned;
  for (const suffix of DESCRIPTION_SUFFIXES) {
    if (workingDescription.length >= DESCRIPTION_MIN) break;
    if (workingDescription.includes(suffix.trim())) continue;
    const candidate = `${workingDescription}${suffix}`;
    workingDescription = candidate.length > DESCRIPTION_MAX ? clampWithEllipsis(candidate, DESCRIPTION_MAX) : candidate;
  }
  if (workingDescription.length < DESCRIPTION_MIN) {
    const padding = DESCRIPTION_MIN - workingDescription.length;
    workingDescription = clampWithEllipsis(
      `${workingDescription}${' MaxVideoAI'.repeat(Math.ceil(padding / 10))}`,
      DESCRIPTION_MAX
    );
  }
  return workingDescription;
}

function resolveImageUrl(image?: string) {
  const fallback = '/og-default.jpg';
  if (!image) {
    return `${SITE_BASE_URL}${fallback}`;
  }
  if (image.startsWith('http://') || image.startsWith('https://')) {
    return image;
  }
  if (image.startsWith('//')) {
    return `https:${image}`;
  }
  if (image.startsWith('/')) {
    return `${SITE_BASE_URL}${image}`;
  }
  return `${SITE_BASE_URL}/${image}`;
}

export function SEO({ title, description, canonical, ogImage, ogType = 'website' }: SEOProps) {
  const canonicalUrl = sanitizeUrl(canonical);
  const normalizedTitle = ensureTitleLength(title);
  const normalizedDescription = ensureDescriptionLength(description);
  const resolvedImage = resolveImageUrl(ogImage);

  return (
    <>
      <title>{normalizedTitle}</title>
      <meta name="description" content={normalizedDescription} />
      <link rel="canonical" href={canonicalUrl} />
      <meta property="og:type" content={ogType} />
      <meta property="og:title" content={normalizedTitle} />
      <meta property="og:description" content={normalizedDescription} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={resolvedImage} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={normalizedTitle} />
      <meta name="twitter:description" content={normalizedDescription} />
      <meta name="twitter:image" content={resolvedImage} />
    </>
  );
}
