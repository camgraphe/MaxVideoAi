import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { TextLink } from '@/components/ui/TextLink';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import Script from 'next/script';
import { getContentEntries, getEntryBySlug, type ContentEntry } from '@/lib/content/markdown';
import type { AppLocale } from '@/i18n/locales';
import { localePathnames, localeRegions, locales } from '@/i18n/locales';
import { buildSlugMap } from '@/lib/i18nSlugs';
import { buildMetadataUrls, SITE_BASE_URL } from '@/lib/metadataUrls';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { getBreadcrumbLabels } from '@/lib/seo/breadcrumbs';
import { resolveDictionary } from '@/lib/i18n/server';

interface Params {
  locale: AppLocale;
  slug: string;
}

export const dynamicParams = false;

const localeDateMap: Record<AppLocale, string> = {
  en: 'en-US',
  fr: 'fr-FR',
  es: 'es-ES',
};

const BLOG_TITLE_OVERRIDES: Partial<Record<string, Partial<Record<AppLocale, string>>>> = {
  'sora-2-sequenced-prompts': {
    en: 'Sora 2 sequenced prompts for AI video – MaxVideoAI blog',
    fr: 'Sora 2 prompts séquencés vidéo IA – Blog MaxVideoAI',
    es: 'Sora 2 prompts secuenciales para video IA – Blog MaxVideoAI',
  },
};
const BLOG_SLUG_MAP = buildSlugMap('blog');

type ArticleNextStep = {
  eyebrow: string;
  title: string;
  body: string;
  links: Array<{ href: string; label: string }>;
};

const BLOG_NEXT_STEPS: Partial<Record<string, Record<AppLocale, ArticleNextStep>>> = {
  'how-to-create-consistent-ai-characters': {
    en: {
      eyebrow: 'Next step',
      title: 'Use the character workflow',
      body: 'Build the reference first, then move into the tighter sheet guide or the still and video workflow.',
      links: [
        { href: '/tools/character-builder', label: 'Open Character Builder' },
        { href: '/blog/ai-character-sheet-generator', label: 'Read the 8-panel sheet guide' },
        { href: '/app/image', label: 'Generate the source still in Image' },
      ],
    },
    fr: {
      eyebrow: 'Étape suivante',
      title: 'Passez au workflow personnage',
      body: 'Créez d’abord la référence, puis passez au guide de la fiche 8 panneaux ou au workflow image et vidéo.',
      links: [
        { href: '/outils/character-builder', label: 'Ouvrir Character Builder' },
        { href: '/blog/generateur-de-fiche-personnage-ia', label: 'Lire le guide de la fiche 8 panneaux' },
        { href: '/app/image', label: 'Générer l’image source dans Image' },
      ],
    },
    es: {
      eyebrow: 'Siguiente paso',
      title: 'Pasa al flujo del personaje',
      body: 'Primero crea la referencia y luego pasa a la guía de la hoja de 8 paneles o al flujo de imagen y video.',
      links: [
        { href: '/herramientas/character-builder', label: 'Abrir Character Builder' },
        { href: '/blog/generador-de-fichas-de-personaje-con-ia', label: 'Leer la guía de la hoja de 8 paneles' },
        { href: '/app/image', label: 'Generar la imagen base en Image' },
      ],
    },
  },
  'ai-character-sheet-generator': {
    en: {
      eyebrow: 'Next step',
      title: 'Turn the sheet into a reusable workflow',
      body: 'Open the tool, go back to the broader consistency guide, or move the sheet into Nano Banana.',
      links: [
        { href: '/tools/character-builder', label: 'Open Character Builder' },
        { href: '/blog/how-to-create-consistent-ai-characters', label: 'Read the broader consistency guide' },
        { href: '/models/nano-banana', label: 'Use the sheet in Nano Banana' },
      ],
    },
    fr: {
      eyebrow: 'Étape suivante',
      title: 'Transformez la fiche en vrai workflow',
      body: 'Ouvrez l’outil, revenez au guide global de cohérence, ou passez la fiche dans Nano Banana.',
      links: [
        { href: '/outils/character-builder', label: 'Ouvrir Character Builder' },
        { href: '/blog/comment-creer-des-personnages-ia-coherents-dans-les-images-et-la-video', label: 'Lire le guide global de cohérence' },
        { href: '/modeles/nano-banana', label: 'Utiliser la fiche dans Nano Banana' },
      ],
    },
    es: {
      eyebrow: 'Siguiente paso',
      title: 'Convierte la hoja en un flujo reutilizable',
      body: 'Abre la herramienta, vuelve a la guía general de consistencia o lleva la hoja a Nano Banana.',
      links: [
        { href: '/herramientas/character-builder', label: 'Abrir Character Builder' },
        { href: '/blog/como-crear-personajes-de-ia-coherentes-en-imagenes-y-video', label: 'Leer la guía general de consistencia' },
        { href: '/modelos/nano-banana', label: 'Usar la hoja en Nano Banana' },
      ],
    },
  },
  'change-camera-angle-with-ai': {
    en: {
      eyebrow: 'Next step',
      title: 'Keep the better angle moving',
      body: 'Open the tool, compare it with the multi-angle guide, or refine the still before motion.',
      links: [
        { href: '/tools/angle', label: 'Open Angle' },
        { href: '/blog/multiple-camera-angles-from-one-image', label: 'Read the multi-angle planning guide' },
        { href: '/app/image', label: 'Continue in Image' },
      ],
    },
    fr: {
      eyebrow: 'Étape suivante',
      title: 'Faites avancer le meilleur angle',
      body: 'Ouvrez l’outil, comparez-le au guide multi-angle, ou affinez l’image avant le motion.',
      links: [
        { href: '/outils/angle', label: 'Ouvrir Angle' },
        { href: '/blog/explorer-plusieurs-angles-de-camera-a-partir-dune-image-approuvee', label: 'Lire le guide multi-angle' },
        { href: '/app/image', label: 'Continuer dans Image' },
      ],
    },
    es: {
      eyebrow: 'Siguiente paso',
      title: 'Haz avanzar el mejor ángulo',
      body: 'Abre la herramienta, compárala con la guía multiángulo o afina la imagen antes del motion.',
      links: [
        { href: '/herramientas/angle', label: 'Abrir Angle' },
        { href: '/blog/como-explorar-multiples-angulos-de-camara-desde-una-imagen-aprobada', label: 'Leer la guía multiángulo' },
        { href: '/app/image', label: 'Continuar en Image' },
      ],
    },
  },
  'multiple-camera-angles-from-one-image': {
    en: {
      eyebrow: 'Next step',
      title: 'Move from exploration to selection',
      body: 'Open the tool, revisit the single-angle correction guide, or browse examples before you commit the frame.',
      links: [
        { href: '/tools/angle', label: 'Open Angle' },
        { href: '/blog/change-camera-angle-with-ai', label: 'Read the single-angle correction guide' },
        { href: '/examples', label: 'Browse examples' },
      ],
    },
    fr: {
      eyebrow: 'Étape suivante',
      title: 'Passez de l’exploration à la sélection',
      body: 'Ouvrez l’outil, revenez au guide de correction d’un seul angle, ou parcourez des exemples avant de figer le frame.',
      links: [
        { href: '/outils/angle', label: 'Ouvrir Angle' },
        { href: '/blog/lia-peut-elle-changer-langle-de-camera-dune-photo', label: 'Lire le guide de correction d’un seul angle' },
        { href: '/galerie', label: 'Parcourir les exemples' },
      ],
    },
    es: {
      eyebrow: 'Siguiente paso',
      title: 'Pasa de la exploración a la selección',
      body: 'Abre la herramienta, vuelve a la guía de corrección de un solo ángulo o revisa ejemplos antes de fijar el frame.',
      links: [
        { href: '/herramientas/angle', label: 'Abrir Angle' },
        { href: '/blog/la-ia-puede-cambiar-el-angulo-de-camara-de-una-foto', label: 'Leer la guía de corrección de un solo ángulo' },
        { href: '/galeria', label: 'Ver ejemplos' },
      ],
    },
  },
};

function getCanonicalBlogSlug(post: Pick<ContentEntry, 'slug' | 'canonicalSlug' | 'lang'>) {
  return post.canonicalSlug ?? (post.lang === 'en' ? post.slug : post.slug);
}

async function getBlogPosts(locale: AppLocale) {
  const localized = await getContentEntries(`content/${locale}/blog`);
  if (locale === 'en') {
    return localized;
  }

  const english = await getContentEntries('content/en/blog');
  const merged = new Map<string, ContentEntry>();

  english.forEach((post) => {
    merged.set(getCanonicalBlogSlug(post), post);
  });

  localized.forEach((post) => {
    merged.set(getCanonicalBlogSlug(post), post);
  });

  return Array.from(merged.values()).sort((a, b) => Date.parse(b.date ?? '') - Date.parse(a.date ?? ''));
}

function getBlogLinkProps(locale: AppLocale, post: Pick<ContentEntry, 'slug' | 'canonicalSlug' | 'lang'>) {
  const canonicalSlug = getCanonicalBlogSlug(post);
  const localizedSlug = locale === 'en' || post.lang === locale ? post.slug : null;

  return localizedSlug
    ? {
        href: { pathname: '/blog/[slug]' as const, params: { slug: localizedSlug } },
      }
    : {
        href: { pathname: '/blog/[slug]' as const, params: { slug: canonicalSlug } },
        locale: 'en' as const,
        hrefLang: 'en',
      };
}

function getNextStepCopy(locale: AppLocale, canonicalSlug: string): ArticleNextStep | null {
  return BLOG_NEXT_STEPS[canonicalSlug]?.[locale] ?? null;
}

function toIsoDate(value?: string | null): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date.toISOString();
}

async function getPost(locale: AppLocale, slug: string) {
  const basePath = `content/${locale}/blog`;
  const direct = await getEntryBySlug(basePath, slug);
  if (direct) {
    return direct;
  }
  const entries = await getBlogPosts(locale);
  const canonicalMatch = entries.find((entry) => {
    if (entry.slug === slug) return true;
    if (getCanonicalBlogSlug(entry) === slug) return true;
    if (!entry.canonicalSlug && entry.lang === 'en' && entry.slug === slug) return true;
    return false;
  });
  return canonicalMatch ?? null;
}

async function findLocalizedSlugs(canonicalSlug: string) {
  const mapping: Partial<Record<AppLocale, string>> = {};
  await Promise.all(
    locales.map(async (locale) => {
      const entries = await getContentEntries(`content/${locale}/blog`);
      const match = entries.find(
        (entry) => (entry.canonicalSlug ?? (entry.lang === 'en' ? entry.slug : null)) === canonicalSlug
      );
      if (match) {
        mapping[locale] = match.slug;
      }
    })
  );
  return mapping;
}

export async function generateStaticParams(): Promise<Params[]> {
  const params: Params[] = [];
  for (const locale of locales) {
    const entries = await getBlogPosts(locale);
    entries.forEach((entry) => {
      params.push({ locale, slug: entry.slug });
    });
  }
  return params;
}

export async function generateMetadata(props: { params: Promise<Params> }): Promise<Metadata> {
  const params = await props.params;
  const post = await getPost(params.locale, params.slug);
  if (!post) {
    return { title: 'Post not found — MaxVideo AI' };
  }
  const lastModified = toIsoDate(post.updatedAt ?? post.date);
  const published = toIsoDate(post.date);
  const canonicalSlug = post.canonicalSlug ?? (post.lang === 'en' ? post.slug : undefined) ?? post.slug;
  const localizedSlugs = await findLocalizedSlugs(canonicalSlug);
  if (!localizedSlugs.en) {
    localizedSlugs.en = canonicalSlug;
  }

  const publishableLocales = new Set<AppLocale>(['en']);
  locales.forEach((code) => {
    if (code !== 'en' && localizedSlugs[code]) {
      publishableLocales.add(code);
    }
  });
  const slugMap: Partial<Record<AppLocale, string>> = {};
  const ensureSlugFor = (target: AppLocale) => {
    const slugValue = localizedSlugs[target] ?? canonicalSlug;
    slugMap[target] = `blog/${slugValue}`;
  };
  publishableLocales.forEach(ensureSlugFor);
  const hasLocalizedVersion = params.locale === 'en' || Boolean(localizedSlugs[params.locale]);
  if (hasLocalizedVersion) {
    ensureSlugFor(params.locale);
  }

  const overrideTitle =
    BLOG_TITLE_OVERRIDES[canonicalSlug]?.[params.locale] ?? BLOG_TITLE_OVERRIDES[canonicalSlug]?.en ?? null;
  const defaultTitle = `${post.title} — MaxVideo AI`;
  const pageTitle = overrideTitle ?? defaultTitle;
  const canonicalOverride = !hasLocalizedVersion ? `${SITE_BASE_URL}/blog/${canonicalSlug}` : undefined;

  const metadata = buildSeoMetadata({
    locale: params.locale,
    title: pageTitle,
    description: post.description,
    slugMap,
    englishPath: `/blog/${canonicalSlug}`,
    availableLocales: Array.from(publishableLocales),
    canonicalOverride,
    image: post.image ?? '/og/price-before.png',
    imageAlt: post.title,
    ogType: 'article',
    robots: !hasLocalizedVersion ? { index: false, follow: true } : undefined,
    openGraph: {
      ...(published ? { publishedTime: published } : {}),
      ...(lastModified ? { modifiedTime: lastModified, updatedTime: lastModified } : {}),
    },
    other: lastModified ? { 'last-modified': lastModified } : undefined,
  });

  return metadata;
}

export default async function BlogPostPage(props: { params: Promise<Params> }) {
  const params = await props.params;
  const { locale, slug } = params;
  const post = await getPost(locale, slug);
  if (!post) {
    notFound();
  }
  const { dictionary } = await resolveDictionary({ locale });
  const blogCopy = dictionary.blog;
  const articleCopy = blogCopy.article ?? {
    backLink: '← Back to blog',
    relatedTitle: 'Related reading',
    relatedBody: 'More workflow notes and engine breakdowns curated for you.',
    relatedCta: 'Read article',
  };
  if (post.slug !== slug) {
    const localizedPrefix = localePathnames[locale] ? `/${localePathnames[locale]}` : '';
    redirect(`${localizedPrefix}/blog/${post.slug}`);
  }

  const dateFormatter = new Intl.DateTimeFormat(localeDateMap[locale], {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const formattedDate = dateFormatter.format(new Date(post.date));
  const canonicalSlug = post.canonicalSlug ?? (post.lang === 'en' ? post.slug : undefined) ?? post.slug;
  const localizedSlugs = await findLocalizedSlugs(canonicalSlug);
  if (!localizedSlugs.en) {
    localizedSlugs.en = canonicalSlug;
  }
  const publishableLocales = new Set<AppLocale>(['en']);
  locales.forEach((code) => {
    if (code !== 'en' && localizedSlugs[code]) {
      publishableLocales.add(code);
    }
  });
  const slugMap: Partial<Record<AppLocale, string>> = {};
  const ensureSlugFor = (target: AppLocale) => {
    const targetSlug = localizedSlugs[target] ?? canonicalSlug;
    slugMap[target] = `blog/${targetSlug}`;
  };
  publishableLocales.forEach(ensureSlugFor);
  const hasLocalizedVersion = locale === 'en' || Boolean(localizedSlugs[locale]);
  if (hasLocalizedVersion) {
    ensureSlugFor(locale);
  }
  const metadataUrls = buildMetadataUrls(locale, slugMap, {
    englishPath: `/blog/${canonicalSlug}`,
    availableLocales: Array.from(publishableLocales),
  });
  const canonicalUrl = !hasLocalizedVersion ? `${SITE_BASE_URL}/blog/${canonicalSlug}` : metadataUrls.canonical;
  const breadcrumbLabels = getBreadcrumbLabels(locale);
  const blogListUrl = buildMetadataUrls(locale, BLOG_SLUG_MAP, { englishPath: '/blog' }).canonical;
  const localePrefix = localePathnames[locale] ? `/${localePathnames[locale]}` : '';
  const homeUrl = `${SITE_BASE_URL}${localePrefix || ''}`;
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: breadcrumbLabels.home,
        item: homeUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: breadcrumbLabels.blog,
        item: blogListUrl,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: post.title,
        item: canonicalUrl,
      },
    ],
  };
  const publishedIso = toIsoDate(post.date) ?? post.date;
  const modifiedIso = toIsoDate(post.updatedAt ?? post.date) ?? publishedIso;
  const demotedContent = post.content.replace(/<\/?h1>/gi, (match) => match.replace(/h1/i, 'h2'));
  const relatedPool = (await getBlogPosts(locale)).filter((entry) => getCanonicalBlogSlug(entry) !== canonicalSlug);
  const relatedPosts = relatedPool
    .sort((a, b) => Date.parse(b.date ?? '') - Date.parse(a.date ?? ''))
    .slice(0, 3);
  const nextStep = getNextStepCopy(locale, canonicalSlug);

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    datePublished: publishedIso,
    dateModified: modifiedIso,
    inLanguage: localeRegions[locale],
    image: post.image ?? '/og/price-before.png',
    author: {
      '@type': 'Organization',
      name: 'MaxVideo AI',
    },
    publisher: {
      '@type': 'Organization',
      name: 'MaxVideo AI',
      logo: {
        '@type': 'ImageObject',
        url: '/og/price-before.png',
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': canonicalUrl,
    },
  };

  return (
    <div className="container-page max-w-5xl section">
      <div className="stack-gap-lg">
        <TextLink href="/blog" className="text-sm" linkComponent={Link}>
          {articleCopy.backLink}
        </TextLink>

        <article className="overflow-hidden rounded-[28px] border border-hairline bg-surface/90 shadow-card backdrop-blur">
          <header className="relative border-b border-hairline bg-gradient-to-br from-surface to-bg/60">
            {post.image ? (
              <div className="relative h-64 w-full overflow-hidden bg-bg sm:h-80">
                <Image
                  src={post.image}
                  alt={post.title}
                  fill
                  priority
                  fetchPriority="high"
                  sizes="(min-width: 1024px) 960px, 100vw"
                  className="object-cover"
                  style={{ objectPosition: post.imagePosition ?? 'center' }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/90 via-60% to-surface/10" />
              </div>
            ) : (
              <div className="h-24 w-full bg-gradient-to-r from-surface-2 via-surface-3 to-surface-2 sm:h-28" />
            )}
            <div className="relative z-10 stack-gap-lg px-6 pb-10 pt-8 sm:px-10">
              <div className="flex flex-wrap items-center gap-4 text-xs uppercase tracking-micro text-text-muted">
                <span className="rounded-pill border border-hairline bg-surface/80 px-3 py-1 font-semibold text-text-secondary shadow-sm">
                  {formattedDate}
                </span>
                <div className="flex flex-wrap gap-2">
                  {post.keywords?.map((keyword) => (
                    <span key={keyword} className="rounded-pill bg-surface-2 px-3 py-1 font-semibold text-brand">
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
              <div className="max-w-3xl stack-gap-sm">
                <h1 className="text-3xl font-semibold tracking-tight text-text-primary sm:text-5xl">{post.title}</h1>
                <p className="text-base leading-relaxed text-text-secondary sm:text-lg">{post.description}</p>
              </div>
            </div>
          </header>

          <div className="blog-prose px-6 py-10 sm:px-10" dangerouslySetInnerHTML={{ __html: demotedContent }} />
        </article>

        {nextStep ? (
          <section className="rounded-[28px] border border-hairline bg-surface/90 p-6 shadow-card sm:p-8">
            <div className="max-w-3xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-muted">{nextStep.eyebrow}</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">{nextStep.title}</h2>
              <p className="mt-3 text-sm leading-7 text-text-secondary sm:text-base">{nextStep.body}</p>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              {nextStep.links.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="inline-flex items-center rounded-full border border-hairline bg-bg px-4 py-2 text-sm font-semibold text-text-primary transition hover:border-border-hover hover:bg-surface-hover"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {relatedPosts.length ? (
          <section className="stack-gap">
            <div>
              <h2 className="text-2xl font-semibold text-text-primary sm:text-3xl">{articleCopy.relatedTitle}</h2>
              <p className="text-sm text-text-secondary">{articleCopy.relatedBody}</p>
            </div>
            <div className="grid grid-gap-sm md:grid-cols-3">
              {relatedPosts.map((related) => {
                const relatedLinkProps = getBlogLinkProps(locale, related);
                return (
                  <article key={getCanonicalBlogSlug(related)} className="rounded-2xl border border-hairline bg-surface/90 p-5 shadow-card">
                    <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">
                      {new Date(related.date).toLocaleDateString(localeDateMap[locale], {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                    <h3 className="mt-2 text-base font-semibold text-text-primary">{related.title}</h3>
                    <p className="mt-2 text-sm text-text-secondary">{related.description}</p>
                    <Link
                      {...relatedLinkProps}
                      className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-link transition hover:text-link-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                    >
                      {articleCopy.relatedCta} <span aria-hidden>→</span>
                    </Link>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>

      <Script
        id={`breadcrumb-${locale}-${post.slug}-jsonld`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <Script
        id={`article-${locale}-${post.slug}-jsonld`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />

      {post.structuredData?.map((json, index) => (
        <Script
          key={`faq-jsonld-${post.slug}-${index}`}
          id={`faq-jsonld-${post.slug}-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: json }}
        />
      ))}
    </div>
  );
}
