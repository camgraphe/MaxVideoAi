import { getContentEntries, getEntryBySlug, type ContentEntry } from '@/lib/content/markdown';
import { buildSlugMap } from '@/lib/i18nSlugs';
import type { AppLocale } from '@/i18n/locales';
import { localePathnames, locales } from '@/i18n/locales';

export type BlogPostParams = {
  locale: AppLocale;
  slug: string;
};

export type ArticleNextStep = {
  eyebrow: string;
  title: string;
  body: string;
  links: Array<{ href: string; label: string }>;
};

export type BlogArticleCopy = {
  backLink: string;
  relatedTitle: string;
  relatedBody: string;
  relatedCta: string;
};

export const BLOG_SLUG_MAP = buildSlugMap('blog');

export const localeDateMap: Record<AppLocale, string> = {
  en: 'en-US',
  fr: 'fr-FR',
  es: 'es-ES',
};

export const BLOG_TITLE_OVERRIDES: Partial<Record<string, Partial<Record<AppLocale, string>>>> = {
  'sora-2-sequenced-prompts': {
    en: 'Sora 2 sequenced prompts for AI video – MaxVideoAI blog',
    fr: 'Sora 2 prompts séquencés vidéo IA – Blog MaxVideoAI',
    es: 'Sora 2 prompts secuenciales para video IA – Blog MaxVideoAI',
  },
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
        {
          href: '/blog/comment-creer-des-personnages-ia-coherents-dans-les-images-et-la-video',
          label: 'Lire le guide global de cohérence',
        },
        { href: '/modeles/nano-banana', label: 'Utiliser la fiche dans Nano Banana' },
      ],
    },
    es: {
      eyebrow: 'Siguiente paso',
      title: 'Convierte la hoja en un flujo reutilizable',
      body: 'Abre la herramienta, vuelve a la guía general de consistencia o lleva la hoja a Nano Banana.',
      links: [
        { href: '/herramientas/character-builder', label: 'Abrir Character Builder' },
        {
          href: '/blog/como-crear-personajes-de-ia-coherentes-en-imagenes-y-video',
          label: 'Leer la guía general de consistencia',
        },
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
        {
          href: '/blog/explorer-plusieurs-angles-de-camera-a-partir-dune-image-approuvee',
          label: 'Lire le guide multi-angle',
        },
        { href: '/app/image', label: 'Continuer dans Image' },
      ],
    },
    es: {
      eyebrow: 'Siguiente paso',
      title: 'Haz avanzar el mejor ángulo',
      body: 'Abre la herramienta, compárala con la guía multiángulo o afina la imagen antes del motion.',
      links: [
        { href: '/herramientas/angle', label: 'Abrir Angle' },
        {
          href: '/blog/como-explorar-multiples-angulos-de-camara-desde-una-imagen-aprobada',
          label: 'Leer la guía multiángulo',
        },
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

export function getCanonicalBlogSlug(post: Pick<ContentEntry, 'slug' | 'canonicalSlug' | 'lang'>) {
  return post.canonicalSlug ?? (post.lang === 'en' ? post.slug : post.slug);
}

export async function getBlogPosts(locale: AppLocale) {
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

export function getBlogLinkProps(locale: AppLocale, post: Pick<ContentEntry, 'slug' | 'canonicalSlug' | 'lang'>) {
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

export function getNextStepCopy(locale: AppLocale, canonicalSlug: string): ArticleNextStep | null {
  return BLOG_NEXT_STEPS[canonicalSlug]?.[locale] ?? null;
}

export function toIsoDate(value?: string | null): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date.toISOString();
}

export async function getPost(locale: AppLocale, slug: string) {
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

export async function findLocalizedSlugs(canonicalSlug: string) {
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

export function formatBlogPostDate(locale: AppLocale, date: string) {
  return new Intl.DateTimeFormat(localeDateMap[locale], {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
}

export function demoteArticleHeadingContent(content: string) {
  return content.replace(/<\/?h1>/gi, (match) => match.replace(/h1/i, 'h2'));
}

export function buildLocalizedBlogPostPath(locale: AppLocale, slug: string) {
  const localizedPrefix = localePathnames[locale] ? `/${localePathnames[locale]}` : '';
  return `${localizedPrefix}/blog/${slug}`;
}
