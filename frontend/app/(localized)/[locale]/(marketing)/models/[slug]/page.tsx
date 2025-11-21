import { Link } from '@/i18n/navigation';
import Image from 'next/image';
import Head from 'next/head';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { resolveDictionary } from '@/lib/i18n/server';
import { PARTNER_BRAND_MAP } from '@/lib/brand-partners';
import { listFalEngines, getFalEngineBySlug, type FalEngineEntry } from '@/config/falEngines';
import type { AppLocale } from '@/i18n/locales';
import { locales, localePathnames } from '@/i18n/locales';
import { buildSlugMap } from '@/lib/i18nSlugs';
import { buildMetadataUrls } from '@/lib/metadataUrls';
import { resolveLocalesForEnglishPath } from '@/lib/seo/alternateLocales';
import { getEngineLocalized } from '@/lib/models/i18n';
import { buildOptimizedPosterUrl } from '@/lib/media-helpers';
import { normalizeEngineId } from '@/lib/engine-alias';
import { type ExampleGalleryVideo } from '@/components/examples/ExamplesGalleryGrid';
import { listExamples, type GalleryVideo } from '@/server/videos';
import { serializeJsonLd } from '../model-jsonld';

type PageParams = {
  params: {
    locale: AppLocale;
    slug: string;
  };
};

export const dynamicParams = false;
export const revalidate = 300;

const SORA2_SEO = {
  title: 'Sora 2 – AI Text-to-Video & Image-to-Video in MaxVideoAI (720p, 4–12s)',
  description:
    'Create short, cinematic 4–12 second 720p videos with Sora 2 inside MaxVideoAI. Text-to-video and image-to-video with audio, 16:9 or 9:16, transparent per-second pricing.',
};

const PREFERRED_SORA_HERO_ID = 'job_74677d4f-9f28-4e47-b230-64accef8e239';
const PREFERRED_SORA_DEMO_ID = 'job_7fbd6334-8535-438a-98a2-880205744b6b';

export function generateStaticParams() {
  const engines = listFalEngines();
  return locales.flatMap((locale) => engines.map((entry) => ({ locale, slug: entry.modelSlug })));
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://maxvideoai.com';
const MODELS_BASE_PATH_MAP = buildSlugMap('models');

function buildDetailSlugMap(slug: string) {
  return locales.reduce<Record<AppLocale, string>>((acc, locale) => {
    const base = MODELS_BASE_PATH_MAP[locale] ?? 'models';
    acc[locale] = `${base}/${slug}`;
    return acc;
  }, {} as Record<AppLocale, string>);
}

type DetailCopy = {
  backLabel: string;
  overviewTitle: string;
  overview: {
    brand: string;
    engineId: string;
    slug: string;
    logoPolicy: string;
    platformPrice: string;
  };
  logoPolicies: {
    logoAllowed: string;
    textOnly: string;
  };
  promptsTitle: string;
  faqTitle: string;
  buttons: {
    pricing: string;
    launch: string;
  };
  breadcrumb: {
    home: string;
    models: string;
  };
};

const DEFAULT_DETAIL_COPY: DetailCopy = {
  backLabel: '← Back to models',
  overviewTitle: 'Overview',
  overview: {
    brand: 'Brand',
    engineId: 'Engine ID',
    slug: 'Slug',
    logoPolicy: 'Logo policy',
    platformPrice: 'Live pricing updates inside the Generate workspace.',
  },
  logoPolicies: {
    logoAllowed: 'Logo usage permitted',
    textOnly: 'Text-only (wordmark)',
  },
  promptsTitle: 'Prompt ideas',
  faqTitle: 'FAQ',
  buttons: {
    pricing: 'Open Generate',
    launch: 'Launch workspace',
  },
  breadcrumb: {
    home: 'Home',
    models: 'Models',
  },
};

const MODEL_OG_IMAGE_MAP: Record<string, string> = {
  'sora-2':
    'https://videohub-uploads-us.s3.amazonaws.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/a5cbd8d3-33c7-47b5-8480-7f23aab89891-job_684c1b3d-2679-40d1-adb7-06151b3e8739.jpg',
  'sora-2-pro':
    'https://videohub-uploads-us.s3.amazonaws.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/a5cbd8d3-33c7-47b5-8480-7f23aab89891-job_684c1b3d-2679-40d1-adb7-06151b3e8739.jpg',
  'veo-3-1': '/hero/veo3.jpg',
  'veo-3-1-fast': '/hero/veo3.jpg',
  'pika-text-to-video': '/hero/pika-22.jpg',
  'minimax-hailuo-02-text': '/hero/minimax-video01.jpg',
};

function toAbsoluteUrl(url?: string | null): string {
  if (!url) return `${SITE}/og/price-before.png`;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('/')) return `${SITE}${url}`;
  return `${SITE}/${url}`;
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { slug, locale } = params;
  const engine = getFalEngineBySlug(slug);
  if (!engine) {
    return {
      title: 'Model not found - MaxVideo AI',
      robots: { index: false, follow: false },
    };
  }

  const localized = await getEngineLocalized(slug, locale);
  const detailSlugMap = buildDetailSlugMap(slug);
  const publishableLocales = Array.from(resolveLocalesForEnglishPath(`/models/${slug}`));
  const metadataUrls = buildMetadataUrls(locale, detailSlugMap, { availableLocales: publishableLocales });
  const fallbackTitle = engine.seo.title ?? `${engine.marketingName} — MaxVideo AI`;
  const isSora2 = slug === 'sora-2';
  const title = isSora2 ? SORA2_SEO.title : localized.seo.title ?? fallbackTitle;
  const description = isSora2
    ? SORA2_SEO.description
    : localized.seo.description ??
      engine.seo.description ??
      'Explore availability, prompts, pricing, and render policies for this model on MaxVideoAI.';
  const ogImagePath = localized.seo.image ?? MODEL_OG_IMAGE_MAP[slug] ?? engine.media?.imagePath ?? '/og/price-before.png';
  const ogImage = toAbsoluteUrl(ogImagePath);

  return {
    title,
    description,
    alternates: {
      canonical: metadataUrls.canonical,
      languages: metadataUrls.languages,
    },
    openGraph: {
      type: 'article',
      url: metadataUrls.canonical,
      siteName: 'MaxVideo AI',
      title,
      description,
      locale: metadataUrls.ogLocale,
      alternateLocale: metadataUrls.alternateOg,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

type FeaturedMedia = {
  id: string | null;
  prompt: string | null;
  videoUrl: string | null;
  posterUrl: string | null;
  durationSec?: number | null;
  hasAudio?: boolean;
  href?: string | null;
  label?: string | null;
};

function formatPriceLabel(priceCents: number | null | undefined, currency: string | null | undefined): string | null {
  if (typeof priceCents !== 'number' || Number.isNaN(priceCents)) {
    return null;
  }
  const normalizedCurrency = typeof currency === 'string' && currency.length ? currency.toUpperCase() : 'USD';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: normalizedCurrency,
      maximumFractionDigits: 2,
    }).format(priceCents / 100);
  } catch {
    return `${normalizedCurrency} ${(priceCents / 100).toFixed(2)}`;
  }
}

function formatPromptExcerpt(prompt: string, maxWords = 22): string {
  const words = prompt.trim().split(/\s+/);
  if (words.length <= maxWords) return prompt.trim();
  return `${words.slice(0, maxWords).join(' ')}…`;
}

function toGalleryCard(video: GalleryVideo, brandId?: string): ExampleGalleryVideo {
  const promptExcerpt = formatPromptExcerpt(video.promptExcerpt || video.prompt || 'MaxVideoAI render');
  return {
    id: video.id,
    href: `/video/${encodeURIComponent(video.id)}`,
    engineLabel: video.engineLabel || 'Sora 2',
    engineIconId: 'sora-2',
    engineBrandId: brandId,
    priceLabel: formatPriceLabel(video.finalPriceCents ?? null, video.currency ?? null),
    prompt: promptExcerpt,
    aspectRatio: video.aspectRatio ?? null,
    durationSec: video.durationSec,
    hasAudio: video.hasAudio,
    optimizedPosterUrl: buildOptimizedPosterUrl(video.thumbUrl),
    rawPosterUrl: video.thumbUrl ?? null,
    videoUrl: video.videoUrl ?? null,
    recreateHref: `/app?engine=sora-2&from=${encodeURIComponent(video.id)}`,
  };
}

function toFeaturedMedia(entry?: ExampleGalleryVideo | null): FeaturedMedia | null {
  if (!entry) return null;
  return {
    id: entry.id,
    prompt: entry.prompt,
    videoUrl: entry.videoUrl ?? null,
    posterUrl: entry.optimizedPosterUrl ?? entry.rawPosterUrl ?? null,
    durationSec: entry.durationSec,
    hasAudio: entry.hasAudio,
    href: entry.href,
    label: entry.engineLabel,
  };
}

function isLandscape(aspect: string | null | undefined): boolean {
  if (!aspect) return true;
  const [w, h] = aspect.split(':').map(Number);
  if (!Number.isFinite(w) || !Number.isFinite(h) || h === 0) return true;
  return w / h >= 1;
}

function pickHeroMedia(cards: ExampleGalleryVideo[], preferredId: string | null, fallback: FeaturedMedia): FeaturedMedia {
  const preferred = preferredId ? cards.find((card) => card.id === preferredId) : null;
  if (preferred) {
    return toFeaturedMedia(preferred) ?? fallback;
  }
  const playable = cards.find((card) => Boolean(card.videoUrl)) ?? cards[0];
  return toFeaturedMedia(playable) ?? fallback;
}

function pickDemoMedia(
  cards: ExampleGalleryVideo[],
  heroId: string | null,
  preferredId: string | null,
  fallback: FeaturedMedia | null
): FeaturedMedia | null {
  const preferred =
    preferredId && preferredId !== heroId
      ? cards.find((card) => card.id === preferredId && Boolean(card.videoUrl))
      : null;
  if (preferred) {
    const resolved = toFeaturedMedia(preferred);
    if (resolved) return resolved;
  }
  const candidate =
    cards.find((card) => card.id !== heroId && Boolean(card.videoUrl) && isLandscape(card.aspectRatio)) ??
    cards.find((card) => card.id !== heroId);
  const resolved = toFeaturedMedia(candidate);
  if (resolved) return resolved;
  if (fallback && (!heroId || fallback.id !== heroId)) {
    return fallback;
  }
  return null;
}

async function renderSora2ModelPage({
  engine,
  backLabel,
}: {
  engine: FalEngineEntry;
  backLabel: string;
  locale: AppLocale;
}) {
  let examples: GalleryVideo[] = [];
  try {
    examples = await listExamples('date-desc', 60);
  } catch (error) {
    console.warn('[models/sora-2] failed to load examples', error);
  }
  const soraExamples = examples.filter(
    (video) => normalizeEngineId(video.engineId)?.trim().toLowerCase() === 'sora-2'
  );
  const galleryVideos = soraExamples.map((video) => toGalleryCard(video, engine.brandId));

  const fallbackMedia: FeaturedMedia = {
    id: 'sora-hero-fallback',
    prompt: 'Sora 2 demo clip from MaxVideoAI',
    videoUrl: engine.media?.videoUrl ?? engine.demoUrl ?? null,
    posterUrl: buildOptimizedPosterUrl(engine.media?.imagePath) ?? engine.media?.imagePath ?? null,
    durationSec: null,
    hasAudio: true,
    href: null,
    label: 'Sora 2',
  };

  const heroMedia = pickHeroMedia(galleryVideos, PREFERRED_SORA_HERO_ID, fallbackMedia);
  const demoMedia = pickDemoMedia(galleryVideos, heroMedia?.id ?? null, PREFERRED_SORA_DEMO_ID, fallbackMedia);
  const galleryCtaHref = heroMedia?.id
    ? `/app?engine=sora-2&from=${encodeURIComponent(heroMedia.id)}`
    : '/app?engine=sora-2';
  const relatedEngines = listFalEngines()
    .filter((entry) => entry.modelSlug !== 'sora-2')
    .sort((a, b) => (a.family === engine.family ? -1 : 0) - (b.family === engine.family ? -1 : 0))
    .slice(0, 3);

  return (
    <Sora2PageLayout
      backLabel={backLabel}
      heroMedia={heroMedia}
      demoMedia={demoMedia}
      galleryVideos={galleryVideos}
      galleryCtaHref={galleryCtaHref}
      relatedEngines={relatedEngines}
    />
  );
}

function Sora2PageLayout({
  backLabel,
  heroMedia,
  demoMedia,
  galleryVideos,
  galleryCtaHref,
  relatedEngines,
}: {
  backLabel: string;
  heroMedia: FeaturedMedia;
  demoMedia: FeaturedMedia | null;
  galleryVideos: ExampleGalleryVideo[];
  galleryCtaHref: string;
  relatedEngines: FalEngineEntry[];
}) {
  const heroPosterPreload = heroMedia.posterUrl ? buildOptimizedPosterUrl(heroMedia.posterUrl) ?? heroMedia.posterUrl : null;

  const heroHighlights = [
    'Text → Video and Image → Video in one place',
    'Multi-shot / sequenced prompts for mini-stories in a single clip',
    'Pay-as-you-go pricing – you only pay for the seconds you generate',
    'Available in Europe, UK and worldwide, no invite required',
    'Designed to sit alongside Veo, Pika, Kling, Wan, MiniMax Hailuo, etc.',
  ];

  const specSections = [
    {
      title: 'Duration & Output',
      items: ['Durations: 4 s, 8 s, 12 s (you choose)', 'Output resolution: 720p (1280×720)', 'If you need 1080p for higher-end delivery, you can switch to Sora 2 Pro in the same interface.'],
    },
    {
      title: 'Aspect Ratios',
      items: ['16:9 – classic horizontal / YouTube / web video', '9:16 – vertical / TikTok / Reels / Shorts', 'Both are supported in Text→Video and Image→Video.'],
    },
    {
      title: 'Inputs & File Types',
      items: [
        'Text prompts – short, cinematic descriptions in one to three sentences',
        'Reference images – PNG, JPG, WebP, GIF, AVIF up to ~50 MB',
        'No video input in this configuration: you start either from text or from a still image.',
      ],
    },
    {
      title: 'Audio',
      items: [
        'Sora 2 returns a video with audio – useful if you want a self-contained clip straight out of the engine.',
        'If you want to control or replace the sound: you can mute or swap the track in your editor, or use Sora 2 Pro, which exposes an audio toggle in the UI.',
      ],
    },
    {
      title: 'Pricing',
      items: [
        'Sora 2 uses a simple per-second pricing model:',
        'Internal config: perSecondCents = 12',
        'That’s $0.12 per second of video, for example: 4 seconds ≈ $0.48; 8 seconds ≈ $0.96; 12 seconds ≈ $1.44',
        'No monthly subscription is required: you top up a wallet and only pay for what you generate.',
      ],
    },
  ];

  const promptPatternSteps = [
    'Subject and action – who/what and what they’re doing',
    'Environment – where it happens (office, street, café, studio…)',
    'Camera – how we see it (wide shot, medium shot, close-up, over-the-shoulder…)',
    'Movement – how the camera moves (slow dolly-in, handheld, pan, drone-like…)',
    'Light & mood – golden hour, soft daylight, neon night, high contrast, moody…',
    'Format & duration – mention 16:9 or 9:16 and whether it’s a 4, 8 or 12 second moment',
  ];

  const imageToVideoSteps = [
    'Generate a reference frame in Nano Banana that matches your brand style or idea.',
    'Send that still into Sora 2 as Image → Video.',
    'Give Sora a prompt that focuses on motion and timing: how the camera should move, what the subject should do, how the shot should end at 4/8/12 seconds.',
    'Generate, review, tweak just the motion language if needed, regenerate.',
  ];

  const imageToVideoUseCases = [
    'product shots that must stay on-brand',
    'hero visuals for landing pages',
    'short looping scenes you might use in ads or UI backgrounds',
  ];

  const miniFilmTips = [
    'Aim for 2–3 shots maximum in one clip (beyond that, things can get noisy).',
    'Give each shot one main action and one clear camera move.',
    'Reuse key elements (“same woman in a blue blazer”, “same kitchen”, “same lighting”) so Sora understands continuity.',
    'Avoid trying to jump through five radically different locations in 8 seconds – Sora is good, but it’s still constrained by the clip length.',
  ];

  const strengths = [
    'Short, vivid moments',
    'Clear subject and action',
    'Simple environments (office, street, café, home…)',
    'Film-like camera behavior (dolly, pan, handheld, etc.)',
    'Great for UGC-feeling footage and cinematic inserts',
  ];

  const boundaries = [
    'Outputs are 720p, not 1080p – Sora 2 Pro covers higher resolution.',
    'It’s 4–12 seconds, not long-form. You stitch multiple clips if you want something longer.',
    'It doesn’t take video input; you start from text or image.',
    'It doesn’t expose seeds – you iterate by refining the prompt and re-running.',
    'Like all current models, it can struggle with very small or detailed text.',
  ];

  const safetyRules = [
    'You should not generate real people or public figures (no celebrities, politicians, etc.).',
    'No minors, sexual content, hateful content or graphic violence.',
    'Don’t use another person’s likeness without their consent.',
    'Some prompts and input images will be blocked if they violate these principles.',
  ];

  const safetyInterpretation = [
    'if you describe a generic user, model, character → fine',
    'if you try “make it look like [famous person]” or anything sensitive → it may fail or be filtered',
  ];

  const comparisonPoints = [
    'Sora 2 is your fast 720p idea machine.',
    'Sora 2 Pro is your higher-resolution, more controllable sibling.',
    'You might explore ideas and storyboard with Sora 2, then switch to Sora 2 Pro to regenerate your final picks in 1080p, with more control over audio and quality.',
  ];

  const faqEntries = [
    {
      q: 'Is Sora 2 available in Europe / the UK?',
      a: 'Yes. Through MaxVideoAI you can use Sora 2 from Europe, the UK and most locations where our service is available, without needing a direct invite or separate OpenAI account.',
    },
    {
      q: 'Can Sora 2 generate 1080p videos?',
      a: 'In this integration, Sora 2 outputs 720p. If you need 1080p, use Sora 2 Pro.',
    },
    {
      q: 'Does Sora 2 support image-to-video?',
      a: 'Yes. You can upload a PNG/JPG/WEBP/GIF/AVIF frame (up to ~50 MB) and Sora 2 will animate it based on your motion-focused prompt.',
    },
    {
      q: 'Can I remix or extend existing videos with Sora 2?',
      a: 'Not in this configuration. Sora 2 here is for text→video and image→video only. For advanced workflows, you can combine multiple short clips and edit them together.',
    },
    {
      q: 'How do I keep Sora 2 on-brand?',
      a: 'Use image references from Nano Banana or your own design system, mention your brand colors, and control the mood ("clean tech", "warm lifestyle", "dark cinematic") in your prompts. Once you’ve found a look you like, use it as a template and only change one variable at a time.',
    },
  ];

  return (
    <>
      {heroPosterPreload ? (
        <Head>
          <link rel="preload" as="image" href={heroPosterPreload} fetchPriority="high" />
        </Head>
      ) : null}
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-14 sm:px-6 lg:px-8">
        <Link href="/models" className="text-sm font-semibold text-accent hover:text-accentSoft">
          {backLabel}
        </Link>

        <section className="mt-6 space-y-4 rounded-3xl border border-hairline bg-white/80 p-6 shadow-card sm:p-8">
          <div className="space-y-6">
            <div className="space-y-3 text-center">
              <h1 className="text-3xl font-semibold text-text-primary sm:text-4xl">
                Sora 2 – AI Text-to-Video &amp; Image-to-Video in MaxVideoAI
              </h1>
              <p className="text-lg font-semibold text-text-primary">
                Sora 2 – Cinematic AI Video, Directly in MaxVideoAI (4–12s, 720p)
              </p>
              <p className="text-base text-text-secondary">
                Create short, cinematic videos with Sora 2 straight from your browser. MaxVideoAI gives you instant access to Sora 2 text-to-video and image-to-video, with transparent per-second pricing and a workspace built for testing, prototyping and producing social-ready clips.
              </p>
              <p className="text-base text-text-secondary">
                Describe your scene, choose a duration (4, 8 or 12 seconds), pick 16:9 or 9:16, and let Sora 2 generate polished footage you can use in ads, content or client work.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/app?engine=sora-2"
                className="inline-flex items-center rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-card transition hover:bg-accentSoft"
              >
                Start generating with Sora 2
              </Link>
              <Link
                href="/models/sora-2-pro"
                className="inline-flex items-center rounded-full border border-hairline px-5 py-2 text-sm font-semibold text-text-primary transition hover:border-accent hover:text-accent"
              >
                Compare Sora 2 vs Sora 2 Pro (1080p) →
              </Link>
            </div>
            <div className="flex justify-center">
              <div className="w-full max-w-5xl">
                <MediaPreview media={heroMedia} label="Featured Sora 2 clip" />
              </div>
            </div>
            <div className="space-y-3 rounded-2xl border border-hairline bg-bg px-4 py-3">
              <p className="text-sm font-semibold text-text-primary">Why Sora 2 is powerful inside MaxVideoAI:</p>
              <ul className="grid gap-2 text-sm text-text-secondary sm:grid-cols-2">
                {heroHighlights.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-14 space-y-4">
          <h2 className="text-2xl font-semibold text-text-primary">What Sora 2 Actually Is in MaxVideoAI</h2>
          <p className="text-base text-text-secondary">
            On paper, OpenAI Sora 2 is OpenAI’s short-form text-to-video engine. In practice, the way it behaves for you depends on how it’s integrated.
          </p>
          <p className="text-base text-text-secondary">
            In MaxVideoAI, Sora 2 is exposed as a focused, production-ready engine:
          </p>
          <ul className="grid gap-2 rounded-2xl border border-hairline bg-white/70 p-4 text-sm text-text-secondary sm:grid-cols-2">
            <li><strong className="text-text-primary">Clip length:</strong> 4, 8 or 12 seconds (single generation)</li>
            <li><strong className="text-text-primary">Output:</strong> 720p, ideal for social and concepting</li>
            <li><strong className="text-text-primary">Formats:</strong> 16:9 (landscape) and 9:16 (vertical)</li>
            <li>
              <strong className="text-text-primary">Inputs:</strong>
              <ul className="ml-4 list-disc space-y-1">
                <li>Text → Video (T2V)</li>
                <li>Image → Video (I2V) with PNG, JPG/JPEG, WebP, GIF or AVIF (up to ~50 MB)</li>
              </ul>
            </li>
            <li><strong className="text-text-primary">Audio:</strong> always on in this engine; Sora 2 generates sound with the video</li>
            <li><strong className="text-text-primary">Focus:</strong> short, high-impact clips rather than long-form sequences or video-to-video</li>
          </ul>
          <p className="text-base text-text-secondary">
            MaxVideoAI wraps all of this in a simple flow:
          </p>
          <ol className="space-y-2 rounded-2xl border border-hairline bg-white/70 p-4 text-sm text-text-secondary">
            <li>1. Pick Sora 2 as the engine.</li>
            <li>2. Choose Text → Video or Image → Video.</li>
            <li>3. Set duration and aspect ratio.</li>
            <li>4. Paste a structured prompt.</li>
            <li>5. See the final price per clip before you generate.</li>
            <li>6. Compare against other engines in the same GUI.</li>
          </ol>
          <p className="text-base text-text-secondary">
            This turns Sora 2 into a fast idea machine: you can get from “rough concept in your head” to “visually convincing clip” in a few minutes.
          </p>
        </section>

        <section className="mt-14 space-y-4">
          <h2 className="text-2xl font-semibold text-text-primary">Real Specs – Sora 2 in MaxVideoAI</h2>
          <blockquote className="rounded-2xl border border-accent/30 bg-accent/5 px-4 py-3 text-sm text-text-secondary">
            These specs describe Sora 2 exactly as you can use it today via MaxVideoAI – not theoretical capabilities.
          </blockquote>
          <div className="grid gap-4 md:grid-cols-2">
            {specSections.map((section) => (
              <article key={section.title} className="space-y-2 rounded-2xl border border-hairline bg-white/80 p-4 shadow-card">
                <h3 className="text-lg font-semibold text-text-primary">{section.title}</h3>
                <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
          <p className="text-sm font-semibold text-text-primary">
            Key value proposition: Sora 2 in MaxVideoAI is the fastest way to test ideas, prototypes and social concepts – you get studio-style motion &amp; sound at a predictable cost per second.
          </p>
        </section>

        <section className="mt-14 space-y-4">
          <h2 className="text-2xl font-semibold text-text-primary">Sora 2 Example Gallery</h2>
          <p className="text-base text-text-secondary">
            Below on this page, you’ll see a live gallery of Sora 2 examples powered by MaxVideoAI – real outputs rendered using the same engine and settings you have access to.
          </p>
          <p className="text-base text-text-secondary">
            You can also explore more clips in the main{' '}
            <Link href="/examples?engine=sora-2" className="font-semibold text-accent hover:text-accentSoft">
              Examples gallery
            </Link>
            .
          </p>
          {galleryVideos.length ? (
            <div className="mt-6 space-y-4">
              <div className="overflow-x-auto pb-2">
                <div className="flex min-w-full gap-4">
                  {galleryVideos.slice(0, 6).map((video) => (
                    <article
                      key={video.id}
                      className="flex w-64 shrink-0 flex-col overflow-hidden rounded-2xl border border-hairline bg-white shadow-card"
                    >
                      <Link href={video.href} className="group relative block aspect-video bg-neutral-100">
                        {video.optimizedPosterUrl || video.rawPosterUrl ? (
                          <Image
                            src={video.optimizedPosterUrl ?? video.rawPosterUrl ?? ''}
                            alt={`${video.engineLabel} – ${video.prompt}`}
                            fill
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                            sizes="256px"
                            quality={70}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-neutral-200 text-xs font-semibold text-text-muted">
                            No preview
                          </div>
                        )}
                      </Link>
                      <div className="space-y-1 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">
                          {video.engineLabel} · {video.durationSec}s
                        </p>
                        <p className="text-sm font-semibold leading-snug text-text-primary line-clamp-2">{video.prompt}</p>
                        {video.recreateHref ? (
                          <Link
                            href={video.recreateHref}
                            className="inline-flex items-center text-[11px] font-semibold text-accent transition hover:text-accentSoft"
                          >
                            Recreate this shot →
                          </Link>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-hairline bg-white/60 px-4 py-4 text-sm text-text-secondary">
              No public Sora 2 examples yet. Visit the{' '}
              <Link href="/examples?engine=sora-2" className="font-semibold text-accent hover:text-accentSoft">
                examples gallery
              </Link>{' '}
              to see live renders as they publish.
            </div>
          )}
          <div className="mt-4">
            <Link
              href={galleryCtaHref}
              className="inline-flex items-center rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white shadow-card transition hover:bg-neutral-800"
            >
              Open this scene in Generate and adapt it with your own brand →
            </Link>
          </div>
        </section>

        <section className="mt-14 space-y-4">
          <h2 className="text-2xl font-semibold text-text-primary">Text-to-Video with Sora 2</h2>
          <p className="text-base text-text-secondary">
            Sora 2 works best when you treat your prompt like a concise shot list rather than a random wishlist of adjectives.
          </p>
          <div className="space-y-3 rounded-2xl border border-hairline bg-white/80 p-4 shadow-card">
            <h3 className="text-lg font-semibold text-text-primary">A simple pattern that works</h3>
            <p className="text-sm text-text-secondary">In MaxVideoAI, prompts that follow this structure tend to behave well:</p>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-text-secondary">
              {promptPatternSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <div className="rounded-xl border border-dashed border-hairline bg-bg px-4 py-3 text-sm text-text-secondary">
              <p className="font-semibold text-text-primary">Example skeleton:</p>
              <p className="mt-2 italic">
                Wide shot of [subject] in [environment], lit by [lighting], camera [movement], 8 seconds, 16:9, cinematic, natural colors.
              </p>
              <p className="mt-2">
                Drop that into MaxVideoAI, choose Sora 2, and you’re off.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-14 space-y-4">
          <h2 className="text-2xl font-semibold text-text-primary">Image-to-Video with Sora 2 + Nano Banana</h2>
          <p className="text-base text-text-secondary">
            One of the advantages of using Sora via MaxVideoAI is that you can pair it with an image engine like Nano Banana.
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3 rounded-2xl border border-hairline bg-white/80 p-4 shadow-card">
              <h3 className="text-lg font-semibold text-text-primary">Typical flow:</h3>
              <ol className="list-decimal space-y-2 pl-5 text-sm text-text-secondary">
                {imageToVideoSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
            <div className="space-y-3 rounded-2xl border border-hairline bg-white/80 p-4 shadow-card">
              <h3 className="text-lg font-semibold text-text-primary">Why this matters:</h3>
              <p className="text-sm text-text-secondary">
                Because the look is anchored by your reference image, you can iterate on movement and timing while keeping style and composition consistent. That’s extremely useful for:
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
                {imageToVideoUseCases.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-14 space-y-4">
          <h2 className="text-2xl font-semibold text-text-primary">Multi-Shot &amp; Sequenced Clips – The Sora 2 “Mini-Film” Trick</h2>
          <p className="text-base text-text-secondary">
            This is one of the most exciting capabilities of Sora 2: it can interpret multi-step prompts and compress several shots into a single 8 or 12 second clip.
          </p>
          <p className="text-base text-text-secondary">
            If you give Sora 2 a prompt like “First… then… finally…” or clearly separate Shot 1, Shot 2, Shot 3, it tries to stage the clip as a sequence of beats, with changes in framing and subject action.
          </p>
          <div className="space-y-3 rounded-2xl border border-hairline bg-white/80 p-4 shadow-card">
            <h3 className="text-lg font-semibold text-text-primary">How we recommend doing it</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
              {miniFilmTips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mt-14 space-y-6">
          <h2 className="text-2xl font-semibold text-text-primary">Demo: One Sequenced Prompt</h2>
          <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
            <div className="space-y-4 rounded-2xl border border-hairline bg-white/80 p-4 shadow-card">
              <p className="text-sm font-semibold text-text-primary">Prompt – 8 second cinematic lifestyle commercial (16:9)</p>
              <div className="rounded-xl border border-dashed border-hairline bg-bg px-4 py-3 text-sm text-text-secondary">
                <p>8 second cinematic lifestyle commercial of a man in his 30s using a sleek smartwatch while jogging at sunrise in an urban park.</p>
                <p className="mt-2"><strong>Shot 1 (2 s):</strong> close-up of the watch on his wrist, sunlight reflecting off the glass as he adjusts the strap.</p>
                <p className="mt-2"><strong>Shot 2 (4 s):</strong> side-angle tracking shot as he runs along the path, warm light flaring behind skyscrapers.</p>
                <p className="mt-2"><strong>Shot 3 (2 s):</strong> close-up of him glancing at the screen, subtle smile, breath visible in cool morning air.</p>
                <p className="mt-2"><strong>Lighting:</strong> golden hour, cinematic natural tones.</p>
                <p className="mt-2"><strong>Audio:</strong> rhythmic ambient footsteps + faint upbeat music.</p>
                <p className="mt-2"><strong>Camera:</strong> dynamic handheld tracking, 50 mm lens look.</p>
                <p className="mt-2"><strong>Negative:</strong> no logos, no slow-motion, no text overlays.</p>
              </div>
            </div>
            <div className="rounded-2xl border border-hairline bg-white/80 p-3 shadow-card">
              {demoMedia ? (
                <MediaPreview media={demoMedia} label="Sora 2 sequenced demo" />
              ) : (
                <div className="flex h-full min-h-[280px] items-center justify-center rounded-xl border border-dashed border-hairline bg-bg text-sm text-text-secondary">
                  Demo clip coming soon.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mt-14 space-y-6">
          <h2 className="text-2xl font-semibold text-text-primary">Tips &amp; Limitations in Plain English</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3 rounded-2xl border border-hairline bg-white/80 p-4 shadow-card">
              <h3 className="text-lg font-semibold text-text-primary">Play to its strengths:</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
                {strengths.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="space-y-3 rounded-2xl border border-hairline bg-white/80 p-4 shadow-card">
              <h3 className="text-lg font-semibold text-text-primary">Know its boundaries:</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
                {boundaries.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
          <p className="text-sm text-text-secondary">
            When you understand this and write prompts accordingly, Sora 2 becomes a predictable tool instead of a slot machine.
          </p>
        </section>

        <section className="mt-14 space-y-4">
          <h2 className="text-2xl font-semibold text-text-primary">Safety &amp; People / Likeness</h2>
          <div className="space-y-3 rounded-2xl border border-hairline bg-white/80 p-4 shadow-card">
            <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
              {safetyRules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
            <p className="text-sm text-text-secondary">From a user point of view, that means:</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
              {safetyInterpretation.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <p className="text-sm text-text-secondary">
            This is how both MaxVideoAI and Sora 2 stay usable and safe for professionals.
          </p>
        </section>

        <section className="mt-14 space-y-4">
          <h2 className="text-2xl font-semibold text-text-primary">Sora 2 vs Sora 2 Pro – Quick Overview</h2>
          <div className="space-y-3 rounded-2xl border border-hairline bg-white/80 p-4 shadow-card">
            <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
              {comparisonPoints.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <Link
              href="/models/sora-2-pro"
              className="inline-flex items-center rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow-card transition hover:bg-neutral-800"
            >
              Start with Sora 2, move to Sora 2 Pro when you’re ready for 1080p →
            </Link>
          </div>
        </section>

        <section className="mt-14 space-y-4">
          <h2 className="text-2xl font-semibold text-text-primary">FAQ – Sora 2 in MaxVideoAI</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {faqEntries.map((entry) => (
              <article key={entry.q} className="rounded-2xl border border-hairline bg-white/80 p-4 shadow-card">
                <h3 className="text-sm font-semibold text-text-primary">{entry.q}</h3>
                <p className="mt-2 text-sm text-text-secondary">{entry.a}</p>
              </article>
            ))}
          </div>
        </section>

        {relatedEngines.length ? (
          <section className="mt-14 space-y-4">
            <h2 className="text-2xl font-semibold text-text-primary">Explore other models</h2>
            <p className="text-sm text-text-secondary">
              Compare pricing, latency, and output options across other engines available in MaxVideoAI.
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              {relatedEngines.map((entry) => (
                <article
                  key={entry.modelSlug}
                  className="rounded-2xl border border-hairline bg-white/90 p-4 shadow-card transition hover:-translate-y-1 hover:border-accent/60"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">{entry.brandId}</p>
                  <h3 className="mt-2 text-lg font-semibold text-text-primary">
                    {entry.marketingName ?? entry.engine.label}
                  </h3>
                  <p className="mt-2 text-sm text-text-secondary line-clamp-3">
                    {entry.seo?.description ??
                      'See technical specs, prompts, and live availability for this engine.'}
                  </p>
                  <Link
                    href={{ pathname: '/models/[slug]', params: { slug: entry.modelSlug } }}
                    className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent transition hover:text-accentSoft"
                  >
                    View model →
                  </Link>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-14 space-y-3 rounded-3xl border border-hairline bg-white/90 px-6 py-6 text-text-primary shadow-card sm:px-8">
          <p className="text-base text-text-secondary">
            Sora 2 in MaxVideoAI gives you a direct, pay-as-you-go way to use one of the most impressive short-form video models available – without infrastructure setup or guesswork.
          </p>
          <p className="text-base text-text-secondary">
            Use it to explore ideas, build mini-sequences, and test creative directions fast. When you need more resolution or control, you can always step up to Sora 2 Pro.
          </p>
          <Link
            href="/app?engine=sora-2"
            className="inline-flex w-fit items-center rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-card transition hover:bg-accentSoft"
          >
            Start generating with Sora 2 now →
          </Link>
        </section>
      </main>
    </>
  );
}

function MediaPreview({ media, label }: { media: FeaturedMedia; label: string }) {
  const posterSrc = media.posterUrl ?? null;
  return (
    <figure className="group relative overflow-hidden rounded-[22px] border border-hairline bg-white shadow-card">
      <div className="relative w-full overflow-hidden rounded-t-[22px] bg-neutral-100">
        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
          <div className="absolute inset-0">
            {media.videoUrl ? (
              <video
                className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                poster={posterSrc ?? undefined}
              >
                <source src={media.videoUrl} type="video/mp4" />
              </video>
            ) : posterSrc ? (
              <Image
                src={posterSrc}
                alt={media.prompt ? `Sora 2 preview – ${media.prompt}` : label}
                fill
                className="h-full w-full object-cover"
                sizes="(max-width: 768px) 100vw, 720px"
                quality={80}
                loading="eager"
                fetchPriority="high"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-neutral-50 text-sm font-semibold text-text-muted">
                Sora 2 preview
              </div>
            )}
            {media.hasAudio ? (
              <span className="absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-micro text-white">
                Audio on
              </span>
            ) : null}
            {media.durationSec ? (
              <span className="absolute right-3 top-3 rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-micro text-text-primary shadow-card">
                {media.durationSec}s
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <figcaption className="space-y-1 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{label}</p>
        {media.prompt ? <p className="text-sm font-semibold leading-snug text-text-primary">{media.prompt}</p> : null}
        {media.href ? (
          <Link
            href={media.href}
            className="inline-flex items-center text-xs font-semibold text-accent transition hover:text-accentSoft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            View render →
          </Link>
        ) : null}
      </figcaption>
    </figure>
  );
}

export default async function ModelDetailPage({ params }: PageParams) {
  const { slug, locale: routeLocale } = params;
  const engine = getFalEngineBySlug(slug);
  if (!engine) {
    notFound();
  }

  if (slug === 'sora-2') {
    const activeLocale = routeLocale ?? 'en';
    const { dictionary } = await resolveDictionary();
    const detailCopy: DetailCopy = {
      ...DEFAULT_DETAIL_COPY,
      ...(dictionary.models.detail ?? {}),
      breadcrumb: { ...DEFAULT_DETAIL_COPY.breadcrumb, ...(dictionary.models.detail?.breadcrumb ?? {}) },
    };
    return await renderSora2ModelPage({
      engine,
      backLabel: detailCopy.backLabel,
      locale: activeLocale,
    });
  }

  const { dictionary } = await resolveDictionary();
  const activeLocale = routeLocale ?? 'en';
  if (process.env.NODE_ENV === 'development') {
    console.info('[models/page] locale debug', { slug, routeLocale, activeLocale });
  }
  const localizedContent = await getEngineLocalized(slug, activeLocale);
  const detailSlugMap = buildDetailSlugMap(slug);
  const publishableLocales = Array.from(resolveLocalesForEnglishPath(`/models/${slug}`));
  const metadataUrls = buildMetadataUrls(activeLocale, detailSlugMap, { availableLocales: publishableLocales });
  const allEngines = listFalEngines();
  const rankEngine = (entry: FalEngineEntry) => (entry.family === engine.family ? 0 : 1);
  type RelatedCopyContent = { title?: string; subtitle?: string; cta?: string };
  const relatedContent = (dictionary.models as typeof dictionary.models & { related?: RelatedCopyContent }).related ?? {};
  const relatedEngines = allEngines
    .filter((entry) => entry.modelSlug !== slug)
    .sort((a, b) => {
      const familyDiff = rankEngine(a) - rankEngine(b);
      if (familyDiff !== 0) {
        return familyDiff;
      }
      return (a.marketingName ?? a.engine.label).localeCompare(b.marketingName ?? b.engine.label);
    })
    .slice(0, 3);
  const relatedCopy = {
    title: relatedContent.title ?? 'Explore other engines',
    subtitle:
      relatedContent.subtitle ?? 'Compare price tiers, latency, and prompt presets across the rest of the catalog.',
    cta: relatedContent.cta ?? 'View model →',
  };

  const detailCopy: DetailCopy = {
    ...DEFAULT_DETAIL_COPY,
    ...(dictionary.models.detail ?? {}),
    overview: {
      ...DEFAULT_DETAIL_COPY.overview,
      ...(dictionary.models.detail?.overview ?? {}),
    },
    logoPolicies: {
      ...DEFAULT_DETAIL_COPY.logoPolicies,
      ...(dictionary.models.detail?.logoPolicies ?? {}),
    },
    buttons: {
      ...DEFAULT_DETAIL_COPY.buttons,
      ...(dictionary.models.detail?.buttons ?? {}),
    },
    breadcrumb: {
      ...DEFAULT_DETAIL_COPY.breadcrumb,
      ...(dictionary.models.detail?.breadcrumb ?? {}),
    },
  };

  const marketingName = localizedContent.marketingName ?? engine.marketingName;
  const versionLabel = localizedContent.versionLabel ?? engine.versionLabel;
  const seoDescription = localizedContent.seo.description ?? engine.seo.description ?? null;
  const overviewSummary = localizedContent.overview ?? seoDescription;
  const heroContent = localizedContent.hero;
  const introText = heroContent?.intro ?? overviewSummary;
  const bestUseCases = localizedContent.bestUseCases;
  const technicalOverview = localizedContent.technicalOverview ?? [];
  const technicalOverviewTitle = localizedContent.technicalOverviewTitle ?? 'Technical overview';
  const promptStructure = localizedContent.promptStructure;
  const tips = localizedContent.tips;
  const compareLink = localizedContent.compareLink;
  const heroPrimaryCta = heroContent?.ctaPrimary;
  const secondaryCtas = heroContent?.secondaryLinks ?? [];
  const brand = PARTNER_BRAND_MAP.get(engine.brandId);
  const showSoraSeo = engine.modelSlug.startsWith('sora-2');
  const promptEntries =
    localizedContent.prompts.length > 0
      ? localizedContent.prompts
      : engine.prompts.map(({ title, prompt, notes }) => ({ title, prompt, notes }));
  const faqEntries =
    localizedContent.faqs.length > 0
      ? localizedContent.faqs
      : (engine.faqs ?? []).map(({ question, answer }) => ({ question, answer }));
  const pricingNotes = localizedContent.pricingNotes ?? null;
  const canonicalUrl = metadataUrls.canonical;
  const breadcrumbTitleBase = localizedContent.seo.title ?? marketingName ?? slug;
  const breadcrumbTitle = breadcrumbTitleBase.replace(/ —.*$/, '');
  const localePathPrefix = localePathnames[activeLocale] ? `/${localePathnames[activeLocale].replace(/^\/+/, '')}` : '';
  const homePathname = localePathPrefix || '/';
  const localizedHomeUrl = homePathname === '/' ? `${SITE}/` : `${SITE}${homePathname}`;
  const localizedModelsSlug = (MODELS_BASE_PATH_MAP[activeLocale] ?? 'models').replace(/^\/+/, '');
  const modelsPathname =
    homePathname === '/'
      ? `/${localizedModelsSlug}`
      : `${homePathname.replace(/\/+$/, '')}/${localizedModelsSlug}`.replace(/\/{2,}/g, '/');
  const localizedModelsUrl = `${SITE}${modelsPathname}`;
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: detailCopy.breadcrumb.home,
        item: localizedHomeUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: detailCopy.breadcrumb.models,
        item: localizedModelsUrl,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: breadcrumbTitle,
        item: canonicalUrl,
      },
    ],
  };
  const platformPriceInfo = detailCopy.overview.platformPrice
    ? {
        label: detailCopy.overview.platformPrice,
        href: '/generate',
      }
    : null;

  const soraSoftwareSchema = showSoraSeo
    ? {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'OpenAI Sora 2 via MaxVideo AI',
        applicationCategory: 'VideoGenerationApplication',
        operatingSystem: 'Web',
        provider: {
          '@type': 'Organization',
          name: 'MaxVideo AI',
          url: 'https://maxvideoai.com',
        },
        description: seoDescription ?? undefined,
        isAccessibleForFree: false,
      }
    : null;
  const schemaPayloads = [showSoraSeo && soraSoftwareSchema, breadcrumbLd].filter(Boolean) as object[];
  const heroPosterSrc = localizedContent.seo.image ?? engine.media?.imagePath ?? null;
  const heroPosterPreload = heroPosterSrc ? buildOptimizedPosterUrl(heroPosterSrc) ?? heroPosterSrc : null;

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
      {heroPosterPreload ? (
        <Head>
          <link rel="preload" as="image" href={heroPosterPreload} fetchPriority="high" />
        </Head>
      ) : null}
      {schemaPayloads.map((schema, index) => (
        <script
          key={`schema-${index}`}
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }}
        />
      ))}
      <Link href="/models" className="text-sm font-semibold text-accent hover:text-accentSoft">
        {detailCopy.backLabel}
      </Link>
      <header className="mt-6 space-y-3">
        <div className="flex flex-wrap items-center gap-4">
          {brand && engine.logoPolicy === 'logoAllowed' ? (
            <span className="flex items-center">
              <Image src={brand.assets.light.svg} alt={`${marketingName} logo`} width={140} height={32} className="h-9 w-auto dark:hidden" />
              <Image src={brand.assets.dark.svg} alt={`${marketingName} logo`} width={140} height={32} className="hidden h-9 w-auto dark:inline-flex" />
            </span>
          ) : null}
          <div>
            <h1 className="text-3xl font-semibold text-text-primary sm:text-4xl">
              {heroContent?.title ?? marketingName}
            </h1>
            {versionLabel ? (
              <p className="text-sm uppercase tracking-micro text-text-muted">{versionLabel}</p>
            ) : null}
          </div>
          
        </div>
      {introText ? <p className="text-sm text-text-secondary">{introText}</p> : null}
      </header>

      {(heroPrimaryCta?.label || secondaryCtas.length) ? (
        <div className="mt-6 flex flex-wrap gap-3">
          {heroPrimaryCta?.label && heroPrimaryCta.href ? (
            <Link
              href={heroPrimaryCta.href}
              className="inline-flex items-center rounded-pill bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-card transition hover:bg-accentSoft"
            >
              {heroPrimaryCta.label}
            </Link>
          ) : null}
          {secondaryCtas
            .filter((cta): cta is { label: string; href: string } => Boolean(cta.label && cta.href))
            .map((cta) => (
              <Link
                key={`${cta.href}-${cta.label}`}
                href={cta.href!}
                className="inline-flex items-center rounded-pill border border-hairline px-5 py-2 text-sm font-semibold text-text-primary transition hover:border-accent hover:text-accent"
              >
                {cta.label}
              </Link>
            ))}
        </div>
      ) : null}

      {bestUseCases?.items && bestUseCases.items.length ? (
        <section className="mt-10 rounded-card border border-hairline bg-white p-6 shadow-card">
          <h2 className="text-lg font-semibold text-text-primary">
            {bestUseCases.title ?? 'Best use cases'}
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-text-secondary">
            {bestUseCases.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {technicalOverview.length ? (
        <section className="mt-10 rounded-card border border-hairline bg-white p-6 shadow-card">
          <h2 className="text-lg font-semibold text-text-primary">{technicalOverviewTitle}</h2>
          <div className="mt-4 grid gap-4 text-sm text-text-secondary sm:grid-cols-2">
            {technicalOverview.map((entry, index) => (
              <article key={`${entry.label ?? index}-${entry.body}`} className="space-y-1">
                {entry.label ? <strong className="block text-text-primary">{entry.label}</strong> : null}
                {entry.body ? <p>{entry.body}</p> : null}
                {entry.link?.href && entry.link?.label ? (
                  <a
                    href={entry.link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-accent hover:text-accentSoft"
                  >
                    {entry.link.label}
                  </a>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {promptStructure ? (
        <section className="mt-10 rounded-card border border-hairline bg-white p-6 shadow-card">
          <h2 className="text-lg font-semibold text-text-primary">{promptStructure.title ?? 'Prompt structure'}</h2>
          {promptStructure.quote ? (
            <blockquote className="mt-3 border-l-2 border-accent pl-3 text-sm text-text-secondary italic">
              {promptStructure.quote}
            </blockquote>
          ) : null}
          {promptStructure.description ? (
            <p className="mt-3 text-sm text-text-secondary">{promptStructure.description}</p>
          ) : null}
          {promptStructure.steps && promptStructure.steps.length ? (
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-text-secondary">
              {promptStructure.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {tips?.items && tips.items.length ? (
        <section className="mt-10 rounded-card border border-hairline bg-white p-6 shadow-card">
          <h2 className="text-lg font-semibold text-text-primary">{tips.title ?? 'Tips & tricks'}</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-text-secondary">
            {tips.items.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {compareLink?.href && compareLink.label ? (
        <p className="mt-6 text-sm text-text-secondary">
          {compareLink.before ?? ''}
          <Link href={compareLink.href} className="font-semibold text-accent hover:text-accentSoft">
            {compareLink.label}
          </Link>
          {compareLink.after ?? ''}
        </p>
      ) : null}

      <section className="mt-10 space-y-4">
        <div className="rounded-card border border-hairline bg-white p-6 shadow-card">
          <h2 className="text-lg font-semibold text-text-primary">{detailCopy.overviewTitle}</h2>
          <dl className="mt-4 grid gap-3 text-sm text-text-secondary sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-micro text-text-muted">{detailCopy.overview.brand}</dt>
              <dd>{brand ? brand.label : engine.brandId}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-micro text-text-muted">{detailCopy.overview.engineId}</dt>
              <dd>{engine.id}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-micro text-text-muted">{detailCopy.overview.slug}</dt>
              <dd>/models/{engine.modelSlug}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-micro text-text-muted">{detailCopy.overview.logoPolicy}</dt>
              <dd>{detailCopy.logoPolicies[engine.logoPolicy as keyof DetailCopy['logoPolicies']] ?? detailCopy.logoPolicies.textOnly}</dd>
            </div>
            {platformPriceInfo ? (
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase tracking-micro text-text-muted">{detailCopy.overview.platformPrice}</dt>
                <dd>
                  <Link href={platformPriceInfo.href} className="text-sm font-semibold text-accent hover:text-accentSoft">
                    {platformPriceInfo.label}
                  </Link>
                </dd>
              </div>
            ) : null}
          </dl>
          {pricingNotes ? <p className="mt-3 text-xs text-text-muted">{pricingNotes}</p> : null}
        </div>
      </section>

      {promptEntries.length > 0 && (
        <section className="mt-10 space-y-4">
          <h2 className="text-lg font-semibold text-text-primary">{detailCopy.promptsTitle}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {promptEntries.map((entry) => (
              <article key={entry.title} className="rounded-card border border-hairline bg-white p-4 text-sm text-text-secondary shadow-card">
                <h3 className="text-sm font-semibold text-text-primary">{entry.title}</h3>
                <p className="mt-1 text-sm text-text-secondary">{entry.prompt}</p>
                {entry.notes ? <p className="mt-2 text-xs text-text-muted">{entry.notes}</p> : null}
              </article>
            ))}
          </div>
        </section>
      )}

      {faqEntries.length > 0 && (
        <section className="mt-10 space-y-4">
          <h2 className="text-lg font-semibold text-text-primary">{detailCopy.faqTitle}</h2>
          <div className="space-y-3 text-sm text-text-secondary">
            {faqEntries.map(({ question, answer }) => (
              <article key={question} className="rounded-card border border-hairline bg-white p-4 shadow-card">
                <h3 className="text-sm font-semibold text-text-primary">{question}</h3>
                <p className="mt-1 text-sm text-text-secondary">{answer}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {relatedEngines.length ? (
        <section className="mt-12">
          <div className="mb-6 space-y-2">
            <h2 className="text-xl font-semibold text-text-primary">{relatedCopy.title}</h2>
            <p className="text-sm text-text-secondary">{relatedCopy.subtitle}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {relatedEngines.map((candidate) => {
              const label = candidate.marketingName ?? candidate.engine.label;
              return (
                <article key={candidate.modelSlug} className="rounded-2xl border border-hairline bg-white/90 p-5 shadow-card">
                  <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{candidate.brandId}</p>
                  <h3 className="mt-2 text-lg font-semibold text-text-primary">{label}</h3>
                  <p className="mt-2 text-sm text-text-secondary">
                    {candidate.seo?.description ?? 'Latency, pricing, and prompt guides are documented on the detail page.'}
                  </p>
                  <Link
                    href={{ pathname: '/models/[slug]', params: { slug: candidate.modelSlug } }}
                    className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent transition hover:text-accentSoft"
                  >
                    {relatedCopy.cta} <span aria-hidden>→</span>
                  </Link>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      <footer className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/generate"
          className="inline-flex items-center rounded-pill border border-hairline px-4 py-2 text-sm font-semibold text-text-primary transition hover:border-accent hover:text-accent"
        >
          {detailCopy.buttons.pricing}
        </Link>
        <Link
          href="/app"
          className="inline-flex items-center rounded-pill bg-accent px-4 py-2 text-sm font-semibold text-white shadow-card transition hover:bg-accentSoft"
        >
          {detailCopy.buttons.launch}
        </Link>
      </footer>
    </div>
  );
}
