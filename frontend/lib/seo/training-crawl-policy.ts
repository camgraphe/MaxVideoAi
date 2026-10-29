import policy from '@/config/ai-training-public-policy.json';
import imageOptimizer from '@/config/image-optimizer.json';
import localizedSlugs from '@/config/localized-slugs.json';

export type TrainingCrawlPolicy = {
  pageTargets: readonly string[];
  renderTargets: readonly string[];
};

const ORIGIN = 'https://maxvideoai.com';
const MEDIA_ORIGIN = 'https://media.maxvideoai.com';
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const IMAGE_EXTENSION = /\.(?:avif|gif|ico|jpe?g|png|svg|webp)$/i;
const PRIVATE_PREFIXES = [
  '/app', '/admin', '/api', '/auth', '/oauth', '/login', '/account', '/billing',
  '/dashboard', '/generate', '/jobs', '/settings', '/connect', '/uploads',
  '/upload', '/library', '/media-library', '/workspace', '/draft', '/test',
  '/private', '/s', '/v', '/video',
];
const ENGLISH_FAMILIES = [
  'about', 'ai-video-engines', 'benchmarks', 'blog', 'changelog', 'company',
  'contact', 'docs', 'editorial-standards', 'examples', 'integrations', 'mcp',
  'models', 'pay-as-you-go-ai-video-generator', 'pricing', 'status', 'studio',
  'tools', 'workflows',
];
const slugEntries = Object.values(localizedSlugs) as Partial<Record<'en' | 'fr' | 'es', string>>[];
const publicRoots = ENGLISH_FAMILIES.flatMap((english) => {
  const entry = slugEntries.find((candidate) => candidate.en === english);
  return (['en', 'fr', 'es'] as const).map((locale) =>
    `${locale === 'en' ? '' : `/${locale}`}/${entry?.[locale] ?? english}`,
  );
});
const imageWidths = new Set([...imageOptimizer.deviceSizes, ...imageOptimizer.imageSizes]);
const imageQualities = new Set(imageOptimizer.qualities);

function decodedPath(url: URL): string | null {
  try {
    const decoded = decodeURIComponent(url.pathname);
    const hasDotSegment = decoded.split('/').some((segment) => segment === '.' || segment === '..');
    return /[?#%*$\s\\]/.test(decoded) || decoded.includes('//') || hasDotSegment || UUID.test(decoded) ? null : decoded;
  } catch {
    return null;
  }
}

function canonicalTarget(target: string): URL | null {
  if (typeof target !== 'string' || !target.startsWith('/') || target.startsWith('//') || /[#*$\s\\]/.test(target)) return null;
  try {
    const url = new URL(target, ORIGIN);
    return url.origin === ORIGIN && !url.hash && `${url.pathname}${url.search}` === target && decodedPath(url) !== null ? url : null;
  } catch {
    return null;
  }
}

function isSensitivePath(path: string): boolean {
  const base = path.replace(/^\/(?:fr|es)(?=\/|$)/, '') || '/';
  return PRIVATE_PREFIXES.some((prefix) => base === prefix || base.startsWith(`${prefix}/`))
    || base.startsWith('/docs/private') || base.startsWith('/mcp/reference-upload')
    || /(?:^|\/)(?:private|draft|test)(?:\/|$)/.test(base);
}

/** Validation constrains the snapshot; it never grants an unlisted family path. */
export function isSafeTrainingPageTarget(target: string): boolean {
  const url = canonicalTarget(target);
  if (!url) return false;
  const path = decodedPath(url)!;
  if (isSensitivePath(path)) return false;
  if (!['/', '/fr', '/es', '/llms.txt'].includes(path)
    && !publicRoots.some((root) => path === root || path.startsWith(`${root}/`))) return false;
  if (!url.search) return true;
  const params = [...url.searchParams];
  return /^\/(?:examples|fr\/galerie|es\/galeria)(?:\/|$)/.test(path)
    && params.length === 1 && params[0][0] === 'page' && /^[1-9]\d*$/.test(params[0][1])
    && Number(params[0][1]) >= 2 && Number(params[0][1]) < 1000;
}

function isPublicImageSource(source: string): boolean {
  if (typeof source !== 'string' || /[\s\\]/.test(source)) return false;
  try {
    const url = new URL(source, ORIGIN), path = decodedPath(url);
    if (!path || url.protocol !== 'https:' || url.username || url.password || url.hash || isSensitivePath(path) || !IMAGE_EXTENSION.test(path)) return false;
    if (url.search && !(url.origin === ORIGIN && path === '/assets/tools/character-builder-workspace.png' && url.search === '?hero=1')) return false;
    const prefixes = url.origin === ORIGIN
      ? ['/assets/', '/brand/', '/examples/', '/hero/', '/icons/', '/images/', '/media/mcp/', '/og/']
      : url.origin === MEDIA_ORIGIN ? ['/authored/'] : [];
    return (path === '/favicon.ico' && url.origin === ORIGIN) || prefixes.some((prefix) => path.startsWith(prefix));
  } catch {
    return false;
  }
}

/** No generic optimizer permission, signed sources, credentials or identifying media. */
export function isSafeTrainingRenderTarget(target: string): boolean {
  const url = canonicalTarget(target);
  if (!url) return false;
  if (url.pathname !== '/_next/image') return isPublicImageSource(target);
  const params = [...url.searchParams];
  if (params.length !== 3 || new Set(params.map(([key]) => key)).size !== 3
    || !['url', 'w', 'q'].every((key) => url.searchParams.has(key))) return false;
  const width = url.searchParams.get('w')!, quality = url.searchParams.get('q')!;
  return /^\d+$/.test(width) && /^\d+$/.test(quality)
    && imageWidths.has(Number(width)) && imageQualities.has(Number(quality))
    && isPublicImageSource(url.searchParams.get('url')!);
}

export function buildTrainingPublicRules(snapshot: TrainingCrawlPolicy = policy): string[] {
  const targets = [...new Set([
    ...snapshot.pageTargets.filter(isSafeTrainingPageTarget),
    ...snapshot.renderTargets.filter(isSafeTrainingRenderTarget),
  ])].sort();
  return [
    'Disallow: /',
    // Next's published JS/CSS/font namespace; never a workspace or API endpoint.
    'Allow: /_next/static/',
    ...targets.map((target) => `Allow: ${target}$`),
  ];
}
