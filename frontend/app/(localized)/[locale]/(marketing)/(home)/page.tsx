import type { Metadata } from 'next';
import Image, { getImageProps } from 'next/image';
import { Link } from '@/i18n/navigation';
import Script from 'next/script';
import { getTranslations } from 'next-intl/server';
import { ButtonLink } from '@/components/ui/Button';
import { TextLink } from '@/components/ui/TextLink';
import { resolveDictionary } from '@/lib/i18n/server';
import { HeroMediaTile } from '@/components/marketing/HeroMediaTile';
import { GenerateWaysMobileTabs } from '@/components/marketing/GenerateWaysMobileTabs';
import { CURRENCY_LOCALE } from '@/lib/intl';
import { listFalEngines } from '@/config/falEngines';
import { getHomepageSlotsCached, HERO_SLOT_KEYS } from '@/server/homepage';
import { normalizeEngineId } from '@/lib/engine-alias';
import { getImageAlt } from '@/lib/image-alt';
import type { EngineCaps } from '@/types/engines';
import type { AppLocale } from '@/i18n/locales';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { computePricingSnapshot } from '@/lib/pricing';

export const revalidate = 60;

type HeroTileConfig = {
  id: string;
  engineId: string;
  label: string;
  videoSrc: string;
  posterSrc: string;
  durationSec: number;
  resolution: string;
  fallbackPriceLabel: string;
  minPriceCents?: number;
  minPriceCurrency?: string;
  showAudioIcon?: boolean;
  alt: string;
  examplesSlug?: string | null;
  adminPriceLabel?: string | null;
};

function ReferenceStartCard({
  eyebrow,
  title,
  body,
  href,
  cta,
  imageSrc,
  imageAlt,
}: {
  eyebrow: string;
  title: string;
  body: string;
  href: string;
  cta: string;
  imageSrc: string;
  imageAlt: string;
}) {
  return (
    <article className="reference-start-card group flex h-full flex-col overflow-hidden rounded-card border border-hairline bg-surface shadow-card">
      <div className="reference-start-card__media relative aspect-[1.08] overflow-hidden border-b border-hairline bg-surface-2">
        <Image
          src={imageSrc}
          alt={imageAlt}
          fill
          sizes="(max-width: 1024px) 100vw, 360px"
          className="object-cover transition duration-500 group-hover:scale-[1.03]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,15,28,0.55)_0%,rgba(8,15,28,0.16)_24%,rgba(8,15,28,0)_42%),linear-gradient(0deg,rgba(8,15,28,0.44)_0%,rgba(8,15,28,0)_32%)]" />
        <span className="absolute left-4 top-4 rounded-full border border-white/32 bg-[rgba(8,15,28,0.68)] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white shadow-[0_10px_24px_-14px_rgba(0,0,0,0.7)] backdrop-blur-md">
          {eyebrow}
        </span>
      </div>
      <div className="reference-start-card__body flex flex-1 flex-col p-6">
        <h3 className="text-2xl font-semibold tracking-tight text-text-primary">{title}</h3>
        <p className="mt-3 text-sm leading-7 text-text-secondary">{body}</p>
        <ButtonLink href={href} linkComponent={Link} variant="outline" size="lg" className="mt-6 w-fit">
          {cta}
        </ButtonLink>
      </div>
    </article>
  );
}

const HERO_TILES: readonly HeroTileConfig[] = [
  {
    id: 'sora-2',
    engineId: 'sora-2',
    label: 'Sora 2',
    videoSrc: '/hero/sora2.mp4',
    posterSrc: '/hero/sora2.jpg',
    durationSec: 8,
    resolution: '1080p',
    fallbackPriceLabel: 'from $0.52',
    minPriceCents: 52,
    showAudioIcon: true,
    alt: 'Sora 2  -  example clip',
    examplesSlug: 'sora-2',
  },
  {
    id: 'veo-3-1',
    engineId: 'veo-3-1',
    label: 'Veo 3.1',
    videoSrc: '/hero/veo3.mp4',
    posterSrc: '/hero/veo3.jpg',
    durationSec: 8,
    resolution: '1080p',
    fallbackPriceLabel: 'from $0.40',
    minPriceCents: 40,
    showAudioIcon: true,
    alt: 'Veo 3.1  -  example clip',
    examplesSlug: 'veo-3-1',
  },
  {
    id: 'pika-22',
    engineId: 'pika-text-to-video',
    label: 'Pika 2.2',
    videoSrc: '/hero/pika-22.mp4',
    posterSrc: '/hero/pika-22.jpg',
    durationSec: 6,
    resolution: '1080p',
    fallbackPriceLabel: 'from $0.24',
    minPriceCents: 24,
    alt: 'Pika 2.2  -  example clip',
    examplesSlug: 'pika-2-2',
  },
  {
    id: 'minimax-hailuo-02',
    engineId: 'minimax-hailuo-02-text',
    label: 'MiniMax Hailuo 02',
    videoSrc: '/hero/minimax-video01.mp4',
    posterSrc: '/hero/minimax-video01.jpg',
    durationSec: 6,
    resolution: '768P',
    fallbackPriceLabel: 'from $0.27',
    minPriceCents: 27,
    alt: 'MiniMax Hailuo 02  -  example clip',
    examplesSlug: 'minimax-hailuo-02',
  },
] as const;

const HERO_POSTER_WIDTH = 1200;
const HERO_POSTER_HEIGHT = 675;
const HERO_POSTER_QUALITY = 72;

function buildOptimizedPoster(src: string): string {
  if (!src) return src;
  if (src.startsWith('/_next/image') || src.includes('/_next/image?')) {
    return src;
  }
  const { props } = getImageProps({
    src,
    alt: '',
    width: HERO_POSTER_WIDTH,
    height: HERO_POSTER_HEIGHT,
    quality: HERO_POSTER_QUALITY,
    priority: true,
  });
  return props.src;
}

type WorksWithBrandItem = {
  label: string;
  slug?: string;
};

const WORKS_WITH_BRAND_LINKS: readonly WorksWithBrandItem[] = [
  { label: 'Sora 2', slug: 'sora-2' },
  { label: 'Veo 3.1', slug: 'veo-3-1' },
  { label: 'LTX-2', slug: 'ltx-2' },
  { label: 'Kling 3', slug: 'kling-3-pro' },
  { label: 'Wan 2.6', slug: 'wan-2-6' },
  { label: 'Seedance 1.5', slug: 'seedance-1-5-pro' },
  { label: 'Seedance 2.0', slug: 'seedance-2-0' },
  { label: 'Pika 2.2', slug: 'pika-text-to-video' },
  { label: 'Hailuo 02', slug: 'minimax-hailuo-02-text' },
  { label: 'Nano Banana', slug: 'nano-banana' },
] as const;

const HERO_TILE_EXAMPLE_SLUGS: Record<string, string> = {
  'sora-2': 'sora-2',
  'sora-2-pro': 'sora-2-pro',
  'veo-3-1': 'veo-3-1',
  'veo-3-1-fast': 'veo-3-1-fast',
  'pika-text-to-video': 'pika-2-2',
  'pika-2-2': 'pika-2-2',
  'minimax-hailuo-02-text': 'minimax-hailuo-02',
  'minimax-hailuo-02': 'minimax-hailuo-02',
};

const PRICE_PREFIX_BY_LOCALE: Record<AppLocale, string> = {
  en: 'from',
  fr: 'à partir de',
  es: 'desde',
};

function localizePricePrefix(label: string, locale: AppLocale): string {
  const targetPrefix = PRICE_PREFIX_BY_LOCALE[locale] ?? PRICE_PREFIX_BY_LOCALE.en;
  return label.replace(/^from\s+/i, `${targetPrefix} `);
}

const HERO_AUDIO_BADGE_BY_LOCALE: Record<AppLocale, string> = {
  en: 'Audio available. Preview plays muted on this page.',
  fr: 'Audio disponible. La prévisualisation est lue sans son sur cette page.',
  es: 'Audio disponible. La vista previa se reproduce sin sonido en esta página.',
};

const HERO_OVERLAY_LABEL_TEMPLATE_BY_LOCALE: Record<AppLocale, string> = {
  en: 'Generate with {engine} settings',
  fr: 'Générer avec les réglages {engine}',
  es: 'Generar con ajustes de {engine}',
};

const HERO_LIGHTBOX_COPY_BY_LOCALE: Record<
  AppLocale,
  {
    openPreviewAria: string;
    openGeneratorAria: string;
    dialogAria: string;
    modelPage: string;
    generateLikeThis: string;
    viewDetails: string;
    closePreview: string;
  }
> = {
  en: {
    openPreviewAria: 'Preview {label}',
    openGeneratorAria: 'Open {label} generator',
    dialogAria: '{label} preview',
    modelPage: 'Model page',
    generateLikeThis: 'Generate like this',
    viewDetails: 'View details',
    closePreview: 'Close preview',
  },
  fr: {
    openPreviewAria: 'Prévisualiser {label}',
    openGeneratorAria: 'Ouvrir le générateur {label}',
    dialogAria: 'Prévisualisation de {label}',
    modelPage: 'Page modèle',
    generateLikeThis: 'Générer comme ceci',
    viewDetails: 'Voir les détails',
    closePreview: 'Fermer la prévisualisation',
  },
  es: {
    openPreviewAria: 'Previsualizar {label}',
    openGeneratorAria: 'Abrir generador de {label}',
    dialogAria: 'Previsualización de {label}',
    modelPage: 'Página del modelo',
    generateLikeThis: 'Generar así',
    viewDetails: 'Ver detalles',
    closePreview: 'Cerrar previsualización',
  },
};

export async function generateMetadata({ params }: { params: { locale: AppLocale } }): Promise<Metadata> {
  const locale = params.locale;
  const t = await getTranslations({ locale, namespace: 'home.meta' });
  return buildSeoMetadata({
    locale,
    title: t('title'),
    description: t('description'),
    hreflangGroup: 'home',
    image: '/og/home-hub.png',
    imageAlt: t('title'),
  });
}

type MiniFaqProps = {
  faq?: {
    title?: string;
    description?: string;
    items?: Array<{ q: string; a: string }>;
  } | null;
};

const HERO_SEO_PARAGRAPH =
  'MaxVideoAI is a multi-engine AI video generator where you compare AI video models first, then generate videos from text prompts, images, or existing footage. Live pricing is visible before every render so you can pick the right engine with confidence.';

const HERO_MICRO_POINTS = [
  'Text-to-video, image-to-video, and video-to-video workflows',
  'Compare results across multiple AI video models',
  'Pay-as-you-go pricing with cost shown before you generate',
] as const;

const DEFINITION_BLOCK_COPY =
  'An AI video generator creates clips with artificial intelligence. You can turn text prompts into video, animate still images (image-to-video), or transform existing footage (video-to-video). Because each model balances quality, speed, and consistency differently, comparing models before you render helps you pick the right one for each shot.';

const GENERATE_WAYS_COPY = [
  {
    title: 'Text-to-Video AI',
    body: 'Write a prompt and generate new scenes from scratch. Best for ideation, storyboards, and fast first passes.',
  },
  {
    title: 'Image-to-Video AI',
    body: 'Start from a still and add motion while keeping the composition grounded. Best for character, product, and brand-led shots.',
  },
  {
    title: 'Video-to-Video AI',
    body: 'Upload footage and change style, pacing, or motion behavior without starting over. Best for alternate versions and rapid creative testing.',
  },
] as const;

const POPULAR_COMPARISON_LINKS = [
  { label: 'Sora 2 vs Veo 3.1 comparison', slug: 'sora-2-vs-veo-3-1' },
  { label: 'Kling 3 vs Sora 2 comparison', slug: 'kling-3-pro-vs-sora-2' },
  { label: 'Veo 3.1 vs Kling 3 comparison', slug: 'kling-3-pro-vs-veo-3-1' },
  { label: 'LTX 2.3 Fast vs Pro comparison', slug: 'ltx-2-3-fast-vs-ltx-2-3-pro' },
  { label: 'LTX 2.3 Pro vs Veo 3.1 comparison', slug: 'ltx-2-3-pro-vs-veo-3-1' },
] as const;

function MiniFAQ({ faq }: MiniFaqProps) {
  const fallback = {
    title: 'FAQ',
    description: 'Short answers to the most common questions.',
    items: [
      {
        q: 'Is Sora 2 available in the EU?',
        a: 'Sora 2 availability is limited. MaxVideoAI routes your brief to supported engines today and keeps Sora-ready presets for later.',
      },
      {
        q: 'Can I add audio?',
        a: 'Yes. Engines surfaced on the homepage support audio toggles in the composer. The live price updates when you enable audio.',
      },
      {
        q: 'How does pricing work?',
        a: 'You see a live price chip before you render. Load $10 to start and top up anytime. Itemised receipts for each job.',
      },
      {
        q: "What’s the refund policy?",
        a: 'Failed renders auto-refund to your wallet with an itemised receipt. You always keep full control of spend.',
      },
    ],
  };

  const resolvedTitle = faq?.title ?? fallback.title;
  const resolvedDescription = faq?.description ?? fallback.description;
  const items =
    Array.isArray(faq?.items) && faq.items.length
      ? faq.items
      : fallback.items;

  return (
    <section aria-labelledby="mini-faq-heading" className="container-page section max-w-[1200px]">
      <div className="rounded-2xl border border-hairline bg-surface p-6 shadow-card">
        <h2 id="mini-faq-heading" className="text-xl font-semibold text-text-primary">
          {resolvedTitle}
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">{resolvedDescription}</p>
        <div className="stack-gap-sm">
          {items.map((item) => (
            <details key={item.q} className="group rounded-lg border border-hairline bg-surface/60 p-4 transition hover:border-text-muted">
              <summary className="flex cursor-pointer select-none list-none items-center justify-between text-sm font-medium text-text-primary">
                <span>{item.q}</span>
                <span className="ml-3 text-muted-foreground transition-transform group-open:rotate-180">▾</span>
              </summary>
              <div className="mt-2 text-sm text-text-secondary">{item.a}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

type HeroTilePricingInput = {
  id: string;
  engineId?: string;
  durationSec?: number;
  resolution?: string;
  fallbackPriceLabel: string;
  minPriceCents?: number | null;
  minPriceCurrency?: string | null;
};

function pickResolution(resolutions: string[] | undefined, requested: string | undefined) {
  if (!resolutions || !resolutions.length) {
    return requested ?? '1080p';
  }
  if (requested && resolutions.includes(requested)) return requested;
  const nonAuto = resolutions.find((value) => value !== 'auto') ?? resolutions[0];
  return nonAuto ?? requested ?? '1080p';
}

function truncateText(value: string | null | undefined, maxChars = 140): string | null {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return null;
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars).trimEnd()}...`;
}

async function resolveHeroTilePrices(
  tiles: HeroTilePricingInput[],
  options?: { pricePrefix?: string }
) {
  const engineIndex = new Map<string, EngineCaps>(
    listFalEngines().map((entry) => [entry.engine.id, entry.engine])
  );
  const prefix = options?.pricePrefix ?? 'from';
  const formatPriceLabel = (cents: number, currency: string) =>
    `${prefix} ${new Intl.NumberFormat(CURRENCY_LOCALE, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(cents / 100)}`;

  const entries = await Promise.all(
    tiles.map(async (tile) => {
      const canonicalId = normalizeEngineId(tile.engineId);
      const minPriceCents = tile.minPriceCents ?? null;
      const minPriceCurrency = tile.minPriceCurrency ?? 'USD';
      const fallbackLabel =
        minPriceCents != null ? formatPriceLabel(minPriceCents, minPriceCurrency) : tile.fallbackPriceLabel;

      if (!canonicalId || !tile.durationSec) {
        return [tile.id, fallbackLabel] as const;
      }

      try {
        const engineCaps = engineIndex.get(canonicalId) ?? engineIndex.get(tile.engineId ?? '');
        if (!engineCaps) {
          return [tile.id, fallbackLabel] as const;
        }
        const resolution = pickResolution(engineCaps.resolutions as string[] | undefined, tile.resolution);
        const snapshot = await computePricingSnapshot({
          engine: engineCaps,
          durationSec: tile.durationSec,
          resolution,
          membershipTier: 'member',
        });
        let cents = snapshot.totalCents;
        let currency = snapshot.currency;
        if (minPriceCents != null && minPriceCents < snapshot.totalCents) {
          cents = minPriceCents;
          currency = minPriceCurrency;
        }
        return [tile.id, formatPriceLabel(cents, currency)] as const;
      } catch {
        return [tile.id, fallbackLabel] as const;
      }
    })
  );

  return Object.fromEntries(entries);
}

export default async function HomePage({ params }: { params: { locale: AppLocale } }) {
  const locale = params.locale;
  const { dictionary } = await resolveDictionary({ locale: params.locale });
  const home = dictionary.home;
  const seoDescription =
    home.meta?.description ??
    'Create AI video with Sora 2, Veo 3.1 and Kling from one workspace. Compare engines side-by-side with the same prompt, then generate instantly.';
  const defaultBadges = ['Pay-as-you-go pricing', 'Price before you generate', 'Always-current engines'];
  const badgeLabelMap: Record<string, string> = {
    'PAY-AS-YOU-GO': 'Pay-as-you-go pricing',
    'PRICE-BEFORE': 'Price before you generate',
    'ALWAYS-CURRENT': 'Always-current engines',
  };
  const rawBadges = Array.isArray(home.badges) && home.badges.length ? home.badges : defaultBadges;
  const badges = rawBadges.map((badge) => badgeLabelMap[badge] ?? badge);
  const hero = home.hero;
  const workspaceCtaLabel = home.hero?.workspaceCta ?? hero.primaryCta;
  const worksWith = home.worksWith;
  const worksWithBrandItems: readonly WorksWithBrandItem[] = WORKS_WITH_BRAND_LINKS;
  const worksWithCaption = worksWith.caption;
  const worksWithSuffix = home.worksWith?.moreLabel ?? null;
  const heroScreenshot = home.heroScreenshot;
  const pricingPreviewLabel = home.pricingPreviewLabel ?? 'Preview pricing';
  const startupFameLabel = home.partners?.startupFameLabel ?? 'Featured on Startup Fame';
  const seoContent = home.seoContent ?? {};
  const heroSeoParagraph = seoContent.heroParagraph ?? HERO_SEO_PARAGRAPH;
  const heroMicroPoints =
    Array.isArray(seoContent.heroPoints) && seoContent.heroPoints.length
      ? seoContent.heroPoints
      : HERO_MICRO_POINTS;
  const definitionBody = seoContent.definition?.body ?? DEFINITION_BLOCK_COPY;
  const generateWaysTitle = seoContent.generateWays?.title ?? 'Generate videos your way';
  const generateWaysItems =
    Array.isArray(seoContent.generateWays?.items) && seoContent.generateWays.items.length
      ? seoContent.generateWays.items
      : GENERATE_WAYS_COPY;
  const generateWaysCards = generateWaysItems.map((item, index) => {
    const visuals = [
      {
        imageSrc: 'https://v3b.fal.media/files/b/0a92ef89/pnoNbRn5PCLOiRFxqTIp5_yMdhmu89.jpg',
        imageAlt: 'Text-to-video example still.',
      },
      {
        imageSrc: 'https://v3b.fal.media/files/b/0a92ed4c/Qv-Gu3HgGLdZTP-Guq6wn_gm2TaSRT.jpg',
        imageAlt: 'Image-to-video reference still.',
      },
      {
        imageSrc: 'https://v3b.fal.media/files/b/0a935643/1_y_Iw3TbDfMgsI9Kggki_XflHpwqR.jpg',
        imageAlt: 'Video-to-video example still.',
      },
    ][index] ?? {
      imageSrc: 'https://v3b.fal.media/files/b/0a92ef89/pnoNbRn5PCLOiRFxqTIp5_yMdhmu89.jpg',
      imageAlt: 'AI video example still.',
    };
    return {
      ...item,
      ...visuals,
    };
  });
  const compactHeroPoints = heroMicroPoints.slice(0, 2);
  const compareSeo = seoContent.compare ?? {};
  const compareSeoTitle = compareSeo.title ?? 'Compare AI video models - before you render';
  const compareSeoBody =
    compareSeo.body ??
    'MaxVideoAI lets you test multiple AI video models in one workspace. Engines differ on speed, prompt fidelity, motion, realism, and style, so you can review outputs side by side, choose the best model for each shot, and keep pricing visible before every render.';
  const compareSeoLinks =
    Array.isArray(compareSeo.popularLinks) && compareSeo.popularLinks.length
      ? compareSeo.popularLinks.filter((item): item is { label: string; slug: string } => {
          return typeof item?.label === 'string' && typeof item?.slug === 'string';
        })
      : POPULAR_COMPARISON_LINKS;
  const compareSeoAllLabel = compareSeo.seeAllLabel ?? 'See all AI video engine comparisons';
  const compareSeoImageAlt =
    compareSeo.imageAlt ?? 'MaxVideoAI comparison page screenshot showing two AI engines side by side.';
  const faqSeo = seoContent.faq;
  const localizedFaq =
    faqSeo && Array.isArray(faqSeo.items) && faqSeo.items.length
      ? faqSeo
      : home.faq;
  const defaultWhyCards = [
    { title: 'Live product, not a roadmap.', body: 'Log in and use the same workspace we run internally today.' },
    { title: 'Wallet-first billing.', body: 'Top up once, monitor spend, and get automatic refunds on failed renders.' },
    { title: 'All your engines in one place.', body: 'Switch between Sora, Veo, Pika, MiniMax, and more without juggling dashboards.' },
  ];
  const whyCards = Array.isArray(home.whyCards) && home.whyCards.length ? home.whyCards : defaultWhyCards;
  const pricing = home.pricing;
  const trust = home.trust;
  const trustCards = Array.isArray(trust.cards)
    ? (trust.cards as Array<{ eyebrow: string; title: string; body: string }>)
    : [];
  const trustQuote =
    trust.quote && typeof trust.quote === 'object'
      ? (trust.quote as {
          eyebrow?: string;
          value?: string;
          status?: string;
          meta?: string[];
          note?: string;
        })
      : null;
  const toolsWorkflow = home.toolsWorkflow;
  const generateWaysResources = home.generateWaysResources ?? {};
  const homepageSlots = await getHomepageSlotsCached();
  const heroLightboxCopy = HERO_LIGHTBOX_COPY_BY_LOCALE[locale] ?? HERO_LIGHTBOX_COPY_BY_LOCALE.en;

  const heroTileConfigs = HERO_SLOT_KEYS.map((key, index) => {
    const slot = homepageSlots.hero.find((entry) => entry.key === key);
    const fallback = HERO_TILES[index] ?? HERO_TILES[0];
    const video = slot?.video ?? null;
    const label = slot?.title || video?.engineLabel || fallback.label;
    const videoSrc = video?.videoUrl ?? fallback.videoSrc;
    const posterSrc = video?.thumbUrl ?? fallback.posterSrc;
    const videoPosterSrc = buildOptimizedPoster(posterSrc);
    const rawAdminPriceLabel = slot?.subtitle?.trim() || null;
    const adminPriceLabel = rawAdminPriceLabel ? localizePricePrefix(rawAdminPriceLabel, locale) : null;
    const promptSummary = truncateText(video?.promptExcerpt ?? video?.prompt ?? slot?.subtitle ?? null, 80);
    const alt = getImageAlt({
      kind: 'renderThumb',
      engine: label,
      label: promptSummary ?? `${label} homepage highlight`,
      prompt: video?.promptExcerpt ?? video?.prompt ?? null,
      locale,
    });
    const engineId = normalizeEngineId(video?.engineId ?? fallback.engineId) ?? fallback.engineId;
    const durationSec = video?.durationSec ?? fallback.durationSec;
    const resolution = fallback.resolution;

    const canonicalSlug =
      HERO_TILE_EXAMPLE_SLUGS[engineId] ??
      fallback.examplesSlug ??
      (engineId.includes('/') ? null : engineId);
    const detailHref = video?.id ? `/video/${encodeURIComponent(video.id)}` : null;
    const generateHref = video?.id ? `/app?from=${encodeURIComponent(video.id)}` : null;
    const modelHref = canonicalSlug ? `/models/${encodeURIComponent(canonicalSlug)}` : null;
    const detailMeta = video
      ? {
          prompt: truncateText(video.promptExcerpt ?? video.prompt ?? null, 140),
          engineLabel: video.engineLabel ?? label,
          durationSec: video.durationSec ?? null,
        }
      : null;

    return {
      id: key,
      label,
      videoSrc,
      posterSrc,
      videoPosterSrc,
      alt,
      showAudioIcon: fallback.showAudioIcon ?? false,
      engineId,
      durationSec,
      resolution,
      fallbackPriceLabel: adminPriceLabel ?? fallback.fallbackPriceLabel,
      minPriceCents: fallback.minPriceCents ?? null,
      minPriceCurrency: fallback.minPriceCurrency ?? 'USD',
      examplesSlug: canonicalSlug,
      detailHref,
      generateHref,
      modelHref,
      detailMeta,
      adminPriceLabel,
    };
  });

  const heroPriceMap: Record<string, string> =
    heroTileConfigs.some((tile) => !tile.adminPriceLabel)
      ? await resolveHeroTilePrices(
          heroTileConfigs
            .filter((tile) => !tile.adminPriceLabel)
            .map((tile) => ({
              id: tile.id,
              engineId: tile.engineId,
              durationSec: tile.durationSec,
              resolution: tile.resolution,
              fallbackPriceLabel: tile.fallbackPriceLabel,
              minPriceCents: tile.minPriceCents,
              minPriceCurrency: tile.minPriceCurrency,
            })),
          { pricePrefix: PRICE_PREFIX_BY_LOCALE[locale] ?? PRICE_PREFIX_BY_LOCALE.en }
        )
      : {};

  const softwareSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'MaxVideoAI',
    applicationCategory: 'Video',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '5.00',
      priceCurrency: 'USD',
      category: 'Starter credits',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.9',
      ratingCount: '3200',
    },
    description: seoDescription,
    url: 'https://maxvideoai.com',
  };
  const videoJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: 'MaxVideoAI - Generate cinematic AI video',
    description: 'Create watermark-free AI videos with Sora 2, Veo 3.1, Veo 3 Fast, Pika 2.2, MiniMax Hailuo 02, and Hunyuan Image.',
    thumbnailUrl: ['https://maxvideoai.com/og/price-before.png'],
    uploadDate: '2025-10-01T12:00:00+00:00',
    duration: 'PT45S',
    contentUrl: 'https://maxvideoai.com/hero/sora2.mp4',
    embedUrl: 'https://maxvideoai.com/',
    publisher: {
      '@type': 'Organization',
      name: 'MaxVideoAI',
      logo: {
        '@type': 'ImageObject',
        url: 'https://maxvideoai.com/favicon-512.png',
      },
    },
  };
  return (
    <div>
      <section className="container-page section max-w-[1200px] flex flex-col items-center gap-3 pt-4 pb-5 text-center sm:gap-6 sm:pt-10 sm:pb-12 lg:gap-8 lg:pt-12 lg:pb-14 halo-hero">
        <div className="mx-auto grid w-full max-w-[330px] grid-cols-2 gap-1.5 px-2 sm:flex sm:w-auto sm:max-w-none sm:flex-wrap sm:items-center sm:justify-center sm:gap-4 sm:px-0">
          {badges.map((badge, index) => (
            <span
              key={badge}
              className={`min-w-0 whitespace-nowrap overflow-hidden text-ellipsis text-center rounded-pill border border-hairline bg-surface py-0.5 text-[9px] font-semibold uppercase leading-none tracking-micro text-text-secondary sm:shrink-0 sm:px-3 sm:py-1 sm:text-xs ${
                badges.length === 3 && index === 2
                  ? 'col-span-2 mx-auto w-auto max-w-[90%] px-2.5 sm:col-auto sm:mx-0 sm:max-w-none sm:px-3'
                  : 'w-full px-1.5 sm:w-auto'
              }`}
            >
              {badge}
            </span>
          ))}
        </div>
        <div className="flex flex-col gap-3 sm:gap-5">
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary sm:text-4xl">{hero.title}</h1>
          <p className="mx-auto text-sm leading-relaxed text-text-secondary sm:max-w-[62ch] sm:text-lg">
            {hero.subtitle}
          </p>
          <p className="mx-auto text-xs leading-relaxed text-text-secondary sm:-mt-2 sm:max-w-[72ch] sm:text-sm">
            {heroSeoParagraph}
          </p>
        </div>
        <div className="flex w-full flex-nowrap items-center justify-center gap-2 sm:w-auto sm:gap-4">
          <ButtonLink
            href="/app"
            prefetch={false}
            size="md"
            className="min-h-[38px] px-3 py-2 text-[11px] shadow-card whitespace-nowrap sm:min-h-[48px] sm:px-6 sm:py-3 sm:text-sm"
            linkComponent={Link}
          >
            {hero.primaryCta}
          </ButtonLink>
          <ButtonLink
            href={{ pathname: '/examples' }}
            variant="outline"
            size="md"
            className="min-h-[38px] px-3 py-2 text-[11px] whitespace-nowrap sm:min-h-[48px] sm:px-6 sm:py-3 sm:text-sm"
            linkComponent={Link}
          >
            {hero.secondaryCta}
          </ButtonLink>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:grid-gap-sm">
          {heroTileConfigs.map((tile, index) => (
            <HeroMediaTile
              key={tile.id}
              label={tile.label}
              priceLabel={tile.adminPriceLabel ?? heroPriceMap[tile.id] ?? tile.fallbackPriceLabel}
              videoSrc={tile.videoSrc}
              posterSrc={tile.posterSrc}
              videoPosterSrc={tile.videoPosterSrc}
              alt={tile.alt}
              showAudioIcon={tile.showAudioIcon}
              priority={index === 0}
              detailHref={tile.detailHref}
              generateHref={tile.generateHref}
              modelHref={tile.modelHref}
              detailMeta={tile.detailMeta}
              authenticatedHref="/generate"
              guestHref="/login?next=/generate"
              overlayHref={tile.generateHref ?? undefined}
              audioBadgeLabel={HERO_AUDIO_BADGE_BY_LOCALE[locale] ?? HERO_AUDIO_BADGE_BY_LOCALE.en}
              overlayLabel={(HERO_OVERLAY_LABEL_TEMPLATE_BY_LOCALE[locale] ?? HERO_OVERLAY_LABEL_TEMPLATE_BY_LOCALE.en).replace(
                '{engine}',
                tile.label
              )}
              lightboxCopy={heroLightboxCopy}
            />
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {compactHeroPoints.map((point) => (
            <div
              key={point}
              className="inline-flex items-center rounded-pill border border-hairline bg-surface/70 px-3 py-1.5 text-[11px] font-medium text-text-primary shadow-card sm:text-xs"
            >
              {point}
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-muted-foreground">
          <Link href={{ pathname: '/pricing' }} className="underline underline-offset-2">
            {pricingPreviewLabel}
          </Link>
        </p>
      </section>

      <section className="border-t border-hairline bg-surface text-text-secondary section-compact">
        <div className="container-page flex max-w-[1200px] flex-col items-center gap-4 text-center">
          <span className="rounded-pill border border-hairline px-3 py-1 text-xs font-semibold uppercase tracking-micro text-text-muted">
            {worksWith.label}
          </span>
          <div className="flex flex-wrap items-center justify-center gap-6 text-2xl font-semibold text-text-primary sm:text-3xl">
            {worksWithBrandItems.map((item) => (
              item.slug ? (
                <Link
                  key={item.label}
                  href={{ pathname: '/models/[slug]', params: { slug: item.slug } }}
                  className="transition hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                >
                  {item.label}
                </Link>
              ) : (
                <span key={item.label}>{item.label}</span>
              )
            ))}
          </div>
          {worksWithSuffix ? (
            <Link
              href={{ pathname: '/models' }}
              className="text-sm font-medium text-text-muted underline decoration-transparent underline-offset-4 transition hover:text-text-primary hover:decoration-current"
            >
              {worksWithSuffix}
            </Link>
          ) : null}
          <p className="text-xs text-text-muted">{worksWithCaption}</p>
        </div>
      </section>

      <section className="border-t border-hairline bg-bg section py-10 sm:py-12 lg:py-16 halo-workspace-left">
        <div className="container-page flex max-w-[1200px] flex-col items-center gap-[var(--grid-gap-xl)] lg:flex-row lg:items-center">
          <div className="w-full sm:max-w-[62ch] stack-gap-lg text-left lg:w-[38%] lg:pr-4">
            <h2 className="text-2xl font-semibold text-text-primary sm:text-3xl">{heroScreenshot.title}</h2>
            <div className="rounded-[22px] border border-hairline bg-surface p-2 shadow-float lg:hidden">
              <div className="relative w-full overflow-hidden rounded-[16px]">
                <Image
                  src="/assets/marketing/app-dashboard.webp"
                  alt={getImageAlt({ kind: 'uiShot', label: heroScreenshot.alt, locale })}
                  width={1679}
                  height={1127}
                  sizes="100vw"
                  className="h-auto w-full"
                />
              </div>
            </div>
            <p className="text-sm text-text-secondary sm:text-base">{heroScreenshot.body}</p>
            <ButtonLink
              href="/app"
              prefetch={false}
              size="md"
              className="w-fit"
              linkComponent={Link}
            >
              {workspaceCtaLabel}
            </ButtonLink>
          </div>
          <div className="relative hidden w-full lg:ml-auto lg:block lg:w-[62%]">
            <div className="rounded-[24px] border border-hairline bg-surface p-2 shadow-float">
              <div className="overflow-hidden rounded-[18px]">
                <Image
                  src="/assets/marketing/app-dashboard.webp"
                  alt={getImageAlt({ kind: 'uiShot', label: heroScreenshot.alt, locale })}
                  width={1679}
                  height={1127}
                  sizes="(min-width: 1280px) 1040px, (min-width: 1024px) 820px, 100vw"
                  priority
                  className="h-auto w-full"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-hairline bg-surface section-compact">
        <div className="container-page max-w-[1200px] stack-gap-lg">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="max-w-3xl">
              <h2 className="text-2xl font-semibold text-text-primary sm:text-3xl">{generateWaysTitle}</h2>
              <p className="mt-3 text-sm leading-relaxed text-text-secondary sm:text-base">{definitionBody}</p>
            </div>
            <a
              href="https://startupfa.me/s/maxvideoai?utm_source=maxvideoai.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex flex-wrap items-center justify-center gap-3 rounded-pill border border-hairline bg-bg px-4 py-2 transition hover:border-text-muted hover:bg-surface/80 lg:justify-self-end"
              aria-label={startupFameLabel}
            >
              <span className="text-[11px] font-semibold uppercase tracking-micro text-text-muted sm:text-xs">
                {startupFameLabel}
              </span>
              <span className="inline-flex items-center rounded-full border border-[#d9d3cb] bg-[#f6f1ea] px-3 py-1 text-[11px] font-semibold text-[#5d4b37]">
                Featured on Startup Fame
              </span>
            </a>
          </div>
          <GenerateWaysMobileTabs items={generateWaysCards} />
          <div className="hidden gap-4 sm:grid lg:grid-cols-3">
            {generateWaysCards.map((item, index) => (
              <div
                key={item.title}
                className="rounded-[22px] border border-hairline bg-bg px-5 py-5 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.18)]"
              >
                <div className="relative -mx-2 -mt-2 mb-4 overflow-hidden rounded-[16px] border border-hairline bg-surface">
                  <Image
                    src={item.imageSrc}
                    alt={item.imageAlt}
                    width={1200}
                    height={750}
                    sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
                    className="aspect-[16/10] w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/5 to-transparent" />
                </div>
                <span className="inline-flex rounded-full border border-hairline bg-surface px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-4 text-base font-semibold text-text-primary">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">{item.body}</p>
              </div>
            ))}
          </div>
          <div className="rounded-[20px] border border-hairline bg-bg px-4 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-3">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                    {generateWaysResources.models?.eyebrow ?? 'Models'}
                  </span>
                  <p className="mt-2 text-sm text-text-secondary">
                    {generateWaysResources.models?.body ??
                      'Open the model hub for specs, limits, pricing, and workflow notes before you commit to one engine.'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {heroTileConfigs.slice(0, 3).map((tile) =>
                    tile.modelHref ? (
                      <Link
                        key={`home-model-link-${tile.id}`}
                        href={tile.modelHref}
                        className="inline-flex items-center rounded-pill border border-hairline bg-surface px-3 py-1.5 text-sm font-medium text-text-primary transition hover:border-text-muted hover:bg-surface/80"
                      >
                        {tile.label}
                      </Link>
                    ) : null
                  )}
                  <Link
                    href={{ pathname: '/models' }}
                    className="inline-flex items-center rounded-pill border border-brand/30 bg-brand/5 px-3 py-1.5 text-sm font-medium text-brand transition hover:border-brand/50 hover:bg-brand/10 hover:text-brandHover"
                  >
                    {generateWaysResources.models?.cta ?? 'Browse model pages'}
                  </Link>
                </div>
              </div>
              <div className="h-px w-full bg-hairline lg:h-14 lg:w-px" />
              <div className="flex flex-col items-start gap-3 lg:min-w-[260px]">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                    {generateWaysResources.examples?.eyebrow ?? 'Examples'}
                  </span>
                  <p className="mt-2 text-sm text-text-secondary">
                    {generateWaysResources.examples?.body ??
                      'Browse the examples gallery to review prompts, outputs, and engine choices before you launch your own run.'}
                  </p>
                </div>
                <ButtonLink href="/examples" linkComponent={Link} variant="outline" size="md" className="w-fit">
                  {generateWaysResources.examples?.cta ?? 'Browse examples'}
                </ButtonLink>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-hairline bg-bg section">
        <div className="container-page max-w-[1200px] stack-gap-lg">
          <div className="max-w-3xl">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
              {toolsWorkflow.eyebrow}
            </span>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
              {toolsWorkflow.title}
            </h2>
            <p className="mt-4 text-sm leading-7 text-text-secondary sm:text-base">{toolsWorkflow.body}</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <ReferenceStartCard
              eyebrow={toolsWorkflow.cards.image.eyebrow}
              title={toolsWorkflow.cards.image.title}
              body={toolsWorkflow.cards.image.body}
              href="/app/image"
              cta={toolsWorkflow.cards.image.cta}
              imageSrc="https://videohub-uploads-us.s3.amazonaws.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/1212fdd0-0299-4e07-8546-c8fc0925432d.webp"
              imageAlt="Image workspace result prepared before video generation."
            />
            <ReferenceStartCard
              eyebrow={toolsWorkflow.cards.character.eyebrow}
              title={toolsWorkflow.cards.character.title}
              body={toolsWorkflow.cards.character.body}
              href="/tools/character-builder"
              cta={toolsWorkflow.cards.character.cta}
              imageSrc="https://videohub-uploads-us.s3.amazonaws.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/762032e6-d6f1-41cd-a1f3-690a60188a74.webp"
              imageAlt="Reusable character reference generated before prompts and video."
            />
            <ReferenceStartCard
              eyebrow={toolsWorkflow.cards.angle.eyebrow}
              title={toolsWorkflow.cards.angle.title}
              body={toolsWorkflow.cards.angle.body}
              href="/tools/angle"
              cta={toolsWorkflow.cards.angle.cta}
              imageSrc="https://videohub-uploads-us.s3.amazonaws.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/6cff997e-f531-455d-819f-a0481b4cda5c-tool_angle_57d123d8-acdd-4667-9ad4-fdb256313b6a-1.webp"
              imageAlt="Alternate camera angle generated from one source image before video."
            />
          </div>
        </div>
      </section>

      <section className="border-t border-hairline bg-surface section py-10 sm:py-12 lg:py-16">
        <div className="container-page flex max-w-[1200px] flex-col items-center gap-[var(--grid-gap-xl)] lg:flex-row-reverse lg:items-center">
          <div className="w-full sm:max-w-[62ch] stack-gap-lg text-left lg:w-[38%] lg:pl-4">
            <h2 className="text-2xl font-semibold text-text-primary sm:text-3xl">{compareSeoTitle}</h2>
            <div className="rounded-[22px] border border-hairline bg-bg p-2 shadow-float lg:hidden">
              <div className="relative w-full overflow-hidden rounded-[16px]">
                <Image
                  src="/assets/marketing/vs-kling-sora-scorecard.png?v=3"
                  alt={getImageAlt({ kind: 'uiShot', label: compareSeoImageAlt, locale })}
                  width={2278}
                  height={1928}
                  sizes="100vw"
                  className="h-auto w-full"
                />
              </div>
            </div>
            <p className="text-sm leading-relaxed text-text-secondary sm:text-base">{compareSeoBody}</p>
            <div className="flex flex-wrap gap-3 text-sm">
              {compareSeoLinks.map((item) => (
                <Link
                  key={item.slug}
                  href={{ pathname: '/ai-video-engines/[slug]', params: { slug: item.slug } }}
                  className="inline-flex items-center rounded-pill border border-brand/30 bg-brand/5 px-3 py-1.5 font-medium text-brand transition hover:border-brand/50 hover:bg-brand/10 hover:text-brandHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 dark:border-hairline dark:bg-surface-2 dark:text-text-primary dark:hover:border-brand/40 dark:hover:bg-surface"
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href={{ pathname: '/ai-video-engines' }}
                className="inline-flex items-center rounded-pill border border-brand/40 bg-brand px-3 py-1.5 font-semibold text-on-brand transition hover:bg-brandHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 dark:border-brand/30"
              >
                {compareSeoAllLabel}
              </Link>
            </div>
          </div>
          <div className="relative hidden w-full lg:block lg:w-[62%]">
            <div className="rounded-[24px] border border-hairline bg-bg p-2 shadow-float">
              <div className="overflow-hidden rounded-[18px]">
                <Image
                  src="/assets/marketing/vs-kling-sora-scorecard.png?v=3"
                  alt={getImageAlt({ kind: 'uiShot', label: compareSeoImageAlt, locale })}
                  width={2278}
                  height={1928}
                  sizes="(min-width: 1280px) 1040px, (min-width: 1024px) 820px, 100vw"
                  className="h-auto w-full"
                />
              </div>
            </div>
          </div>
        </div>
        <div className="container-page mt-8 max-w-[1200px]">
          <div className="grid gap-3 md:grid-cols-3">
            {whyCards.map((item) => (
              <article key={item.title} className="rounded-2xl border border-hairline bg-bg p-4 shadow-card">
                <h3 className="text-base font-semibold text-text-primary">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-hairline bg-bg section">
        <div className="container-page max-w-[1200px]">
          <div className="max-w-3xl">
            <span className="rounded-pill border border-hairline px-3 py-1 text-xs font-semibold uppercase tracking-micro text-text-muted">
              {pricing.badge}
            </span>
            <h2 className="mt-4 text-balance text-3xl font-semibold text-text-primary sm:text-4xl">
              {pricing.title}
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-text-secondary sm:text-lg">
              {pricing.body}
            </p>
          </div>

          <div className="mt-8 grid gap-3 lg:grid-cols-[1.24fr_0.96fr]">
            <article className="rounded-card border border-hairline bg-gradient-to-br from-brand/5 via-surface to-surface p-6 shadow-card">
              <span className="rounded-pill border border-brand/15 bg-brand/5 px-3 py-1 text-xs font-semibold uppercase tracking-micro text-brand">
                {trustCards[0]?.eyebrow}
              </span>
              <h3 className="mt-4 text-xl font-semibold text-text-primary">{trustCards[0]?.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-text-secondary">{trustCards[0]?.body}</p>
              <div className="mt-5 rounded-2xl border border-brand/10 bg-surface p-4 shadow-[0_16px_36px_-24px_rgba(47,91,191,0.45)] backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
                <div className="flex flex-wrap gap-2">
                  {trustQuote?.meta?.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-hairline bg-surface px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted dark:border-white/10 dark:bg-white/[0.06] dark:text-text-secondary"
                    >
                      {item}
                    </span>
                  ))}
                </div>
                <div className="mt-4 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                      {trustQuote?.eyebrow}
                    </p>
                    <p className="mt-1 text-3xl font-semibold tracking-tight text-text-primary">{trustQuote?.value}</p>
                  </div>
                  <p className="max-w-[12rem] text-right text-sm font-medium leading-6 text-text-secondary">
                    {trustQuote?.status}
                  </p>
                </div>
                {trustQuote?.note ? (
                  <p className="mt-3 text-xs leading-5 text-text-muted">{trustQuote.note}</p>
                ) : null}
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-text-muted">
                <TextLink href={{ pathname: '/pricing' }} className="text-sm" linkComponent={Link}>
                  {pricing.link}
                </TextLink>
                {trust.footnote ? <span className="text-xs uppercase tracking-micro text-text-muted">{trust.footnote}</span> : null}
              </div>
            </article>

            <div className="grid gap-3">
              {trustCards.slice(1).map((card) => (
                <article key={card.title} className="rounded-card border border-hairline bg-surface p-6 shadow-card">
                  <span className="rounded-pill border border-hairline px-3 py-1 text-xs font-semibold uppercase tracking-micro text-text-muted">
                    {card.eyebrow}
                  </span>
                  <h3 className="mt-4 text-lg font-semibold text-text-primary">{card.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-text-secondary">{card.body}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
      <section className="border-t border-hairline bg-surface">
        <MiniFAQ faq={localizedFaq} />
      </section>
      <Script id="software-jsonld" type="application/ld+json">
        {JSON.stringify(softwareSchema)}
      </Script>
      <Script id="home-video-jsonld" type="application/ld+json">
        {JSON.stringify(videoJsonLd)}
      </Script>
      <Script
        id="home-organization-jsonld"
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'MaxVideo AI',
            url: 'https://maxvideoai.com',
            logo: 'https://maxvideoai.com/favicon-512.png',
            sameAs: [],
            description:
              'Independent hub for AI video generation. Price before you generate. Works with Sora, Veo, LTX-2, Kling, Pika, MiniMax, Wan, Nano Banana.',
          }),
        }}
      />
      <Script
        id="home-software-jsonld"
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'MaxVideo AI',
            applicationCategory: 'VideoEditorApplication',
            operatingSystem: 'Web',
            url: 'https://maxvideoai.com',
            offers: {
              '@type': 'Offer',
              price: '0',
              priceCurrency: 'USD',
              description: 'Pay-as-you-go. Load credits to render; no subscription.',
            },
            featureList: [
              'Multi-engine routing (Sora, Veo, LTX-2, Kling, Pika, MiniMax, Wan, Nano Banana)',
              'Live pricing before render',
              'Wallet-first billing with automatic refunds',
              'Composer, gallery, and job tracking in one workspace',
            ],
            publisher: {
              '@type': 'Organization',
              name: 'MaxVideo AI',
            },
          }),
        }}
      />
      </div>
  );
}
