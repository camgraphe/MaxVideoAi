import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { AppLocale } from '../frontend/i18n/locales.ts';
import {
  COPY_BY_MODEL_SLUG,
  getModelDecisionCopy,
} from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-copy.ts';

const LOCALES = ['en', 'fr', 'es'] as const satisfies readonly AppLocale[];
const CONTENT_ROOT = path.join(process.cwd(), 'content', 'models');
const write = process.argv.includes('--write');

async function migrateExistingProjection(slug: string, locale: AppLocale): Promise<boolean> {
  const filePath = path.join(CONTENT_ROOT, locale, `${slug}.json`);
  const document = JSON.parse(await fs.readFile(filePath, 'utf8')) as Record<string, unknown>;
  const copy = getModelDecisionCopy(slug, locale);
  if (!copy) throw new Error(`Missing old decision projection for ${slug}/${locale}`);
  const expected = { modelSlug: slug, ...copy };

  if (document.decision !== undefined) {
    if (JSON.stringify(document.decision) !== JSON.stringify(expected)) {
      throw new Error(`Existing decision content differs for ${slug}/${locale}`);
    }
    return false;
  }

  if (write) {
    document.decision = expected;
    await fs.writeFile(filePath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  }
  return true;
}

type NewImageLocale = (typeof LOCALES)[number];
type NewImageOverlay = {
  marketingName: string;
  seo: { title: string; description: string };
  overview: string;
  pricingNotes: string;
  hero: {
    title: string;
    intro: string;
    badge: string;
    ctaPrimary: { label: string; href: string };
    secondaryLinks: Array<{ label: string; href: string }>;
  };
};

const NEW_IMAGE_PROFILES = {
  'nano-banana-lite': {
    en: { eyebrow: 'GOOGLE FAST IMAGE MODEL', highlights: ['fast, efficient 1K', 'local image edits', 'quick visual exploration'] },
    fr: { eyebrow: 'MODÈLE IMAGE GOOGLE RAPIDE', highlights: ['plus rapide pour les images 1K', 'edits locaux', 'explorations rapides'] },
    es: { eyebrow: 'MODELO DE IMAGEN RÁPIDO DE GOOGLE', highlights: ['más rápido para imágenes 1K', 'ediciones locales', 'exploración rápida'] },
  },
  'seedream-5-0-pro': {
    en: { eyebrow: 'PROFESSIONAL BYTEDANCE IMAGE MODEL', highlights: ['professional ByteDance image route', 'dense infographics', 'polished reference frames'] },
    fr: { eyebrow: 'MODÈLE IMAGE BYTEDANCE PROFESSIONNEL', highlights: ['route image professionnelle ByteDance', 'infographies denses', 'frames propres'] },
    es: { eyebrow: 'MODELO DE IMAGEN PROFESIONAL DE BYTEDANCE', highlights: ['ruta profesional de imagen ByteDance', 'infografías densas', 'fotogramas pulidos'] },
  },
} as const;

const IMAGE_LABELS = {
  en: {
    openWorkspace: 'Open image workspace', viewPricing: 'View pricing', promptExamples: 'Prompt examples',
    viewImage: 'View image', capabilities: 'Capabilities', workflow: 'Workflow', output: 'Output', livePrice: 'Live price',
    promptCardTitle: 'Need prompt examples?', promptCardBody: 'Open the Prompt Lab for a structured starting point.',
    textToImage: 'Text-to-image', imageToImage: 'Image-to-image', delivery: 'Output setup', priceCheck: 'Price check',
    fullPricing: 'View full pricing', pricingSuffix: 'pricing at a glance', exampleSuffix: 'example',
  },
  fr: {
    openWorkspace: 'Ouvrir l’espace image', viewPricing: 'Voir les tarifs', promptExamples: 'Exemples de prompts',
    viewImage: 'Voir l’image', capabilities: 'Capacités', workflow: 'Workflow', output: 'Sortie', livePrice: 'Prix en direct',
    promptCardTitle: 'Besoin d’exemples de prompts ?', promptCardBody: 'Ouvrez le Prompt Lab pour partir d’une structure claire.',
    textToImage: 'Text-to-image', imageToImage: 'Image-to-image', delivery: 'Réglages de sortie', priceCheck: 'Vérification du prix',
    fullPricing: 'Voir tous les tarifs', pricingSuffix: 'tarifs en bref', exampleSuffix: 'exemple',
  },
  es: {
    openWorkspace: 'Abrir el espacio de imágenes', viewPricing: 'Ver precios', promptExamples: 'Ejemplos de prompts',
    viewImage: 'Ver imagen', capabilities: 'Capacidades', workflow: 'Flujo', output: 'Salida', livePrice: 'Precio en vivo',
    promptCardTitle: '¿Necesitas ejemplos de prompts?', promptCardBody: 'Abre el Prompt Lab para empezar con una estructura clara.',
    textToImage: 'Text-to-image', imageToImage: 'Image-to-image', delivery: 'Ajustes de salida', priceCheck: 'Revisión del precio',
    fullPricing: 'Ver todos los precios', pricingSuffix: 'precios de un vistazo', exampleSuffix: 'ejemplo',
  },
} as const;

function localizeModelHref(locale: NewImageLocale, href: string): string {
  if (!href.startsWith('/models/')) return href;
  const suffix = href.slice('/models'.length);
  if (locale === 'fr') return `/fr/modeles${suffix}`;
  if (locale === 'es') return `/es/modelos${suffix}`;
  return href;
}

function pricingHref(locale: NewImageLocale, slug: string): string {
  if (locale === 'fr') return `/fr/tarifs#${slug}-pricing`;
  if (locale === 'es') return `/es/precios#${slug}-pricing`;
  return `/pricing#${slug}-pricing`;
}

function buildNewImageDecision(slug: keyof typeof NEW_IMAGE_PROFILES, locale: NewImageLocale, overlay: NewImageOverlay) {
  const profile = NEW_IMAGE_PROFILES[slug][locale];
  const labels = IMAGE_LABELS[locale];
  const secondaryLinks = overlay.hero.secondaryLinks.map((link) => ({ ...link, href: localizeModelHref(locale, link.href) }));
  if (secondaryLinks.length < 2) throw new Error(`${slug}/${locale} needs two existing secondary links`);
  for (const highlight of profile.highlights) {
    if (!overlay.overview.toLocaleLowerCase(locale).includes(highlight.toLocaleLowerCase(locale))) {
      throw new Error(`${slug}/${locale} subtitle does not contain ${highlight}`);
    }
  }

  return {
    modelSlug: slug,
    hero: {
      eyebrow: profile.eyebrow,
      title: overlay.hero.title,
      subtitle: overlay.overview,
      subtitleHighlights: [...profile.highlights],
      paragraph: overlay.hero.intro,
      primaryCta: overlay.hero.ctaPrimary,
      secondaryCta: secondaryLinks[0],
      quickLinks: [
        { label: labels.openWorkspace, href: overlay.hero.ctaPrimary.href },
        { label: labels.viewPricing, href: pricingHref(locale, slug) },
        { label: labels.promptExamples, href: '#prompting' },
        secondaryLinks[1],
      ],
    },
    media: {
      caption: `${overlay.marketingName} ${labels.exampleSuffix}`,
      description: overlay.hero.intro,
      renderLabel: labels.viewImage,
      badges: overlay.hero.badge.split('·').map((value) => value.trim()).filter(Boolean),
      altContext: overlay.hero.title,
    },
    features: [
      { title: labels.capabilities, body: overlay.overview, tone: 'quality' },
      { title: labels.workflow, body: overlay.hero.intro, tone: 'reference' },
      { title: labels.output, body: overlay.hero.badge, tone: 'duration' },
      { title: labels.livePrice, body: overlay.pricingNotes, tone: 'price' },
    ],
    decisionCards: [
      { title: secondaryLinks[0].label, body: overlay.overview, cta: secondaryLinks[0] },
      { title: secondaryLinks[1].label, body: overlay.hero.intro, cta: secondaryLinks[1] },
      { title: labels.promptCardTitle, body: labels.promptCardBody, cta: { label: labels.promptExamples, href: '#prompting' } },
    ],
    referenceWorkflows: [
      { title: labels.textToImage, body: overlay.hero.intro },
      { title: labels.imageToImage, body: overlay.overview },
      { title: labels.delivery, body: overlay.hero.badge },
      { title: labels.priceCheck, body: overlay.pricingNotes },
    ],
    pricingCopy: {
      title: `${overlay.marketingName} ${labels.pricingSuffix}`,
      subtitle: overlay.pricingNotes,
      footnote: overlay.pricingNotes,
      ctaLabel: labels.fullPricing,
      ctaHref: pricingHref(locale, slug),
    },
    meta: overlay.seo,
  };
}

async function migrateNewImageProjection(slug: keyof typeof NEW_IMAGE_PROFILES, locale: NewImageLocale): Promise<boolean> {
  const filePath = path.join(CONTENT_ROOT, locale, `${slug}.json`);
  const document = JSON.parse(await fs.readFile(filePath, 'utf8')) as Record<string, unknown> & NewImageOverlay;
  const expected = buildNewImageDecision(slug, locale, document);
  if (document.decision != null) {
    if (JSON.stringify(document.decision) !== JSON.stringify(expected)) {
      throw new Error(`Existing new image decision differs for ${slug}/${locale}`);
    }
    return false;
  }
  if (write) {
    document.decision = expected;
    await fs.writeFile(filePath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  }
  return true;
}

async function main() {
  const slugs = Object.keys(COPY_BY_MODEL_SLUG).sort();
  if (slugs.length !== 38) throw new Error(`Expected 38 old copy slugs, received ${slugs.length}`);
  let pending = 0;

  for (const slug of slugs) {
    for (const locale of LOCALES) {
      if (await migrateExistingProjection(slug, locale)) pending += 1;
    }
  }

  for (const slug of Object.keys(NEW_IMAGE_PROFILES).sort() as Array<keyof typeof NEW_IMAGE_PROFILES>) {
    for (const locale of LOCALES) {
      if (await migrateNewImageProjection(slug, locale)) pending += 1;
    }
  }

  console.log(`${write ? 'wrote' : 'would write'} ${pending} decision projections`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
