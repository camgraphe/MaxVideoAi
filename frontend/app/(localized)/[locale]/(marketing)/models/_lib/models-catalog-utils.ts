import path from 'node:path';
import { promises as fs } from 'node:fs';

import engineCatalog from '@/config/engine-catalog.json';
import type { FalEngineEntry } from '@/config/falEngines';
import type { AppLocale } from '@/i18n/locales';
import { buildSlugMap } from '@/lib/i18nSlugs';
import { isImageOnlyModel, supportsVideoGeneration, type ModelCatalogScope } from '@/lib/models/catalog';
import { applyDisplayedPriceMarginCents } from '@/lib/pricing-display';

export const MODELS_SLUG_MAP = buildSlugMap('models');
export const MODELS_HERO_IMAGE_URL = '/assets/models/models-hero-horses-reference.webp';
export type ModelsPageScope = Extract<ModelCatalogScope, 'all' | 'video' | 'image'>;

export const DEFAULT_ENGINE_TYPE_LABELS = {
  textImage: 'Text + Image to Video',
  text: 'Text to Video',
  imageVideo: 'Image to Video',
  image: 'Image Model',
  default: 'AI Model',
} as const;

type EngineCatalogEntry = (typeof engineCatalog)[number];

export type EngineScore = {
  engineId?: string;
  modelSlug?: string;
  fidelity?: number;
  visualQuality?: number | null;
  motion?: number;
  consistency?: number;
  anatomy?: number;
  textRendering?: number;
  lipsyncQuality?: number | null;
  sequencingQuality?: number | null;
  controllability?: number | null;
  speedStability?: number | null;
  pricing?: number | null;
};

type EngineScoresFile = {
  scores?: EngineScore[];
};

type EngineKeySpecsEntry = {
  modelSlug?: string;
  engineId?: string;
  keySpecs?: Record<string, unknown>;
};

type EngineKeySpecsFile = {
  specs?: EngineKeySpecsEntry[];
};

type ScopeNavLabelMap = Record<ModelsPageScope, string>;

export type ScopePageDefaults = {
  metaTitle: string;
  metaDescription: string;
  heroTitle: string;
  heroSubhead: string;
  heroBullets: string[];
  gridSrTitle: string;
  bridgeText: string;
  chooseOutcomeTitle: string;
  chooseOutcomeSubtitle: string;
  reliabilityTitle: string;
  reliabilitySubtitle: string;
  ctaTitle: string;
  ctaSubtitle: string;
  ctaPills: string[];
  ctaMicrocopy: string;
  ctaPrimaryLabel: string;
  ctaPrimaryHref: string;
  ctaSecondaryLabel: string;
  ctaSecondaryHref: string;
  nextStepsTitle: string;
  nextStepLinks: Array<{ label: string; href: string | { pathname: string; params?: Record<string, string> } }>;
  breadcrumbCurrent?: string;
};

export const MODELS_SCOPE_NAV_LABELS: Record<AppLocale, ScopeNavLabelMap> = {
  en: { all: 'All models', video: 'Video models', image: 'Image models' },
  fr: { all: 'Tous les modèles', video: 'Modèles vidéo', image: "Modèles d'image" },
  es: { all: 'Todos los modelos', video: 'Modelos de video', image: 'Modelos de imagen' },
};

const MODELS_SCOPE_DEFAULTS: Record<AppLocale, Record<ModelsPageScope, ScopePageDefaults>> = {
  en: {
    all: {
      metaTitle: 'AI Models: Specs, Limits & Pricing | MaxVideoAI',
      metaDescription:
        'Catalog of AI video and image models with specs, limits, and pricing signals. Review capabilities before you generate.',
      heroTitle: 'AI Models (Specs, Limits, and Pricing)',
      heroSubhead: 'Browse video and image models in one catalog, then move into the dedicated hub you need.',
      heroBullets: [
        'Open any model for full specs, pricing details, and workflow guidance.',
        'Use the category hubs to focus on video or image generation without mixing intents.',
      ],
      gridSrTitle: 'AI video and image models with specs, limits, and pricing on MaxVideoAI',
      bridgeText: 'Use the model cards to review capabilities first, then jump into the video or image hub for a tighter shortlist.',
      chooseOutcomeTitle: 'Choose a model family first',
      chooseOutcomeSubtitle: 'Start with the type of media you need to generate, then refine by limits and pricing.',
      reliabilityTitle: 'Checks that matter before launch',
      reliabilitySubtitle: 'Validate capability fit, output constraints, and price exposure before you commit to a workflow.',
      ctaTitle: 'Start from the right media hub',
      ctaSubtitle: 'Open the dedicated video or image hub when you want filters, copy, and next steps aligned to that workflow.',
      ctaPills: ['Video models', 'Image models', 'Live pricing'],
      ctaMicrocopy: 'Category-first navigation • Live pricing • Model-level constraints',
      ctaPrimaryLabel: 'Open video models',
      ctaPrimaryHref: '/models/video',
      ctaSecondaryLabel: 'Open image models',
      ctaSecondaryHref: '/models/image',
      nextStepsTitle: 'Next steps',
      nextStepLinks: [
        { label: 'Browse video models', href: '/models/video' },
        { label: 'Browse image models', href: '/models/image' },
        { label: 'Compare video engines', href: '/ai-video-engines' },
      ],
    },
    video: {
      metaTitle: 'AI Video Models: Specs, Limits & Pricing | MaxVideoAI',
      metaDescription:
        'Compare AI video models by input support, max duration, resolution, and pricing before you render.',
      heroTitle: 'AI Video Models (Specs, Limits, and Pricing)',
      heroSubhead: 'Review video-first model constraints, compare workflows, and shortlist the right engine before rendering.',
      heroBullets: [
        'Check text-to-video, image-to-video, extension, and edit support by model.',
        'Use the video compare hub only after the shortlist is clear.',
      ],
      gridSrTitle: 'AI video models with specs, limits, and pricing on MaxVideoAI',
      bridgeText: 'Use the model cards to review video capabilities, limits, and pricing before selecting an engine for production.',
      chooseOutcomeTitle: 'Choose by video workflow and constraints',
      chooseOutcomeSubtitle: 'Start from supported video inputs, duration limits, and price exposure.',
      reliabilityTitle: 'Video model checks that matter',
      reliabilitySubtitle: 'Validate motion workflow fit, output constraints, and pricing signals before rendering.',
      ctaTitle: 'Start generating video in seconds',
      ctaSubtitle: 'Pick a video model above, then generate or compare shortlisted engines side by side.',
      ctaPills: ['Video pricing', 'Runtime limits', 'Prompt references'],
      ctaMicrocopy: 'Video specs • Live pricing • Real output references',
      ctaPrimaryLabel: 'Open video workspace',
      ctaPrimaryHref: '/app',
      ctaSecondaryLabel: 'Compare video engines',
      ctaSecondaryHref: '/ai-video-engines',
      nextStepsTitle: 'Next steps',
      nextStepLinks: [
        { label: 'Choose an engine by use case', href: '/ai-video-engines' },
        { label: 'Compare Kling 3 Pro vs Veo 3.1', href: { pathname: '/ai-video-engines/[slug]', params: { slug: 'kling-3-pro-vs-veo-3-1' } } },
        { label: 'View Veo 3.1 Fast profile', href: { pathname: '/models/[slug]', params: { slug: 'veo-3-1-fast' } } },
      ],
      breadcrumbCurrent: 'Video models',
    },
    image: {
      metaTitle: 'AI Image Models: Specs, Limits & Pricing | MaxVideoAI',
      metaDescription:
        'Review AI image models by generation mode, references, resolution, and per-image pricing before you create stills.',
      heroTitle: 'AI Image Models (Specs, Limits, and Pricing)',
      heroSubhead: 'Review still-image model capabilities, edit constraints, and per-image pricing before you generate.',
      heroBullets: [
        'Check text-to-image and edit workflows, reference limits, and resolution options.',
        'Use the image workspace when you are ready to generate stills or reference-led edits.',
      ],
      gridSrTitle: 'AI image models with specs, limits, and pricing on MaxVideoAI',
      bridgeText: 'Use the model cards to review still-image workflows, edit constraints, and pricing before choosing a model.',
      chooseOutcomeTitle: 'Choose by still-image workflow',
      chooseOutcomeSubtitle: 'Start from create vs edit, reference needs, output size, and price per image.',
      reliabilityTitle: 'Image model checks that matter',
      reliabilitySubtitle: 'Validate reference limits, output controls, and pricing before launching still-image runs.',
      ctaTitle: 'Start generating stills in seconds',
      ctaSubtitle: 'Pick an image model above, then open the Image Lab to generate drafts, finals, or edit runs.',
      ctaPills: ['Per-image pricing', 'Reference limits', 'Resolution options'],
      ctaMicrocopy: 'Image specs • Live pricing • Reference-aware workflows',
      ctaPrimaryLabel: 'Open image workspace',
      ctaPrimaryHref: '/app/image',
      ctaSecondaryLabel: 'Browse all models',
      ctaSecondaryHref: '/models',
      nextStepsTitle: 'Next steps',
      nextStepLinks: [
        { label: 'Open the image workspace', href: '/app/image' },
        { label: 'View Nano Banana 2 profile', href: { pathname: '/models/[slug]', params: { slug: 'nano-banana-2' } } },
        { label: 'View Nano Banana Pro profile', href: { pathname: '/models/[slug]', params: { slug: 'nano-banana-pro' } } },
      ],
      breadcrumbCurrent: 'Image models',
    },
  },
  fr: {
    all: {
      metaTitle: 'Modèles IA : specs, limites et prix | MaxVideoAI',
      metaDescription:
        "Catalogue des modèles IA vidéo et image avec specs, limites et signaux de prix. Vérifiez les capacités avant de générer.",
      heroTitle: 'Modèles IA (specs, limites et prix)',
      heroSubhead: "Parcourez les modèles vidéo et image dans un même catalogue, puis basculez vers le hub dédié selon votre besoin.",
      heroBullets: [
        'Ouvrez chaque modèle pour ses specs, prix et conseils de workflow.',
        "Utilisez les hubs de catégorie pour séparer clairement les usages vidéo et image.",
      ],
      gridSrTitle: 'Modèles IA vidéo et image avec specs, limites et prix sur MaxVideoAI',
      bridgeText: "Utilisez les cartes modèle pour valider les capacités, puis ouvrez le hub vidéo ou image pour une shortlist plus nette.",
      chooseOutcomeTitle: 'Choisir d’abord une famille de modèles',
      chooseOutcomeSubtitle: "Commencez par le média à générer, puis affinez par limites et prix.",
      reliabilityTitle: 'Contrôles utiles avant lancement',
      reliabilitySubtitle: "Validez l’adéquation des capacités, les contraintes de sortie et l’exposition coût avant de choisir un workflow.",
      ctaTitle: 'Commencez par le bon hub média',
      ctaSubtitle: "Ouvrez le hub vidéo ou image quand vous voulez une navigation et des filtres alignés sur ce workflow.",
      ctaPills: ['Modèles vidéo', "Modèles d'image", 'Tarifs live'],
      ctaMicrocopy: 'Navigation par catégorie • Tarifs live • Contraintes par modèle',
      ctaPrimaryLabel: 'Voir les modèles vidéo',
      ctaPrimaryHref: '/models/video',
      ctaSecondaryLabel: "Voir les modèles d'image",
      ctaSecondaryHref: '/models/image',
      nextStepsTitle: 'Étapes suivantes',
      nextStepLinks: [
        { label: 'Parcourir les modèles vidéo', href: '/models/video' },
        { label: "Parcourir les modèles d'image", href: '/models/image' },
        { label: 'Comparer les modèles vidéo', href: '/ai-video-engines' },
      ],
    },
    video: {
      metaTitle: 'Modèles vidéo IA : specs, limites et prix | MaxVideoAI',
      metaDescription:
        'Comparez les modèles vidéo IA par entrées supportées, durée max, résolution et prix avant rendu.',
      heroTitle: 'Modèles vidéo IA (specs, limites et prix)',
      heroSubhead: 'Passez en revue les contraintes vidéo, comparez les workflows et retenez le bon modèle avant rendu.',
      heroBullets: [
        "Vérifiez texte→vidéo, image→vidéo, extension et édition selon le modèle.",
        'Utilisez le comparatif vidéo uniquement une fois la shortlist clarifiée.',
      ],
      gridSrTitle: 'Modèles vidéo IA avec specs, limites et prix sur MaxVideoAI',
      bridgeText: 'Utilisez les cartes modèle pour valider les capacités vidéo, les limites et les prix avant sélection.',
      chooseOutcomeTitle: 'Choisir par workflow vidéo et contraintes',
      chooseOutcomeSubtitle: 'Partez des entrées vidéo supportées, des durées max et du coût.',
      reliabilityTitle: 'Contrôles qui comptent pour la vidéo',
      reliabilitySubtitle: 'Validez le fit du workflow, les contraintes de sortie et les signaux de prix avant rendu.',
      ctaTitle: 'Lancez une génération vidéo en quelques secondes',
      ctaSubtitle: 'Choisissez un modèle vidéo ci-dessus, puis générez ou comparez vos modèles shortlistés.',
      ctaPills: ['Tarifs vidéo', 'Limites runtime', 'Références de prompt'],
      ctaMicrocopy: 'Specs vidéo • Tarifs live • Références de sorties réelles',
      ctaPrimaryLabel: 'Ouvrir le studio vidéo',
      ctaPrimaryHref: '/app',
      ctaSecondaryLabel: 'Ouvrir le comparatif vidéo',
      ctaSecondaryHref: '/ai-video-engines',
      nextStepsTitle: 'Étapes suivantes',
      nextStepLinks: [
        { label: 'Choisir un modèle par use case', href: '/ai-video-engines' },
        { label: 'Comparer Kling 3 Pro vs Veo 3.1', href: { pathname: '/ai-video-engines/[slug]', params: { slug: 'kling-3-pro-vs-veo-3-1' } } },
        { label: 'Voir le profil Veo 3.1 Fast', href: { pathname: '/models/[slug]', params: { slug: 'veo-3-1-fast' } } },
      ],
      breadcrumbCurrent: 'Modèles vidéo',
    },
    image: {
      metaTitle: "Modèles d'image IA : specs, limites et prix | MaxVideoAI",
      metaDescription:
        "Consultez les modèles d'image IA par mode de génération, références, résolution et prix par image avant création.",
      heroTitle: "Modèles d'image IA (specs, limites et prix)",
      heroSubhead: "Passez en revue les capacités image fixe, les contraintes d'édition et les prix par image avant génération.",
      heroBullets: [
        'Vérifiez create/edit, limites de références et options de résolution.',
        "Utilisez l’Image Lab quand vous êtes prêt à générer des images fixes ou des retouches guidées.",
      ],
      gridSrTitle: "Modèles d'image IA avec specs, limites et prix sur MaxVideoAI",
      bridgeText: "Utilisez les cartes modèle pour valider les workflows image, les contraintes de retouche et le prix avant choix.",
      chooseOutcomeTitle: "Choisir par workflow d'image fixe",
      chooseOutcomeSubtitle: "Partez de create vs edit, des besoins en références, de la taille de sortie et du prix par image.",
      reliabilityTitle: "Contrôles qui comptent pour l'image",
      reliabilitySubtitle: "Validez limites de références, contrôles de sortie et prix avant de lancer vos runs image.",
      ctaTitle: 'Lancez une génération image en quelques secondes',
      ctaSubtitle: "Choisissez un modèle image ci-dessus, puis ouvrez l’Image Lab pour générer des tests, des versions finales ou des retouches.",
      ctaPills: ['Prix par image', 'Limites de références', 'Options de résolution'],
      ctaMicrocopy: "Specs image • Tarifs live • Workflows guidés par références",
      ctaPrimaryLabel: "Ouvrir l'Image Lab",
      ctaPrimaryHref: '/app/image',
      ctaSecondaryLabel: 'Voir tous les modèles',
      ctaSecondaryHref: '/models',
      nextStepsTitle: 'Étapes suivantes',
      nextStepLinks: [
        { label: "Ouvrir le studio image", href: '/app/image' },
        { label: 'Voir le profil Nano Banana 2', href: { pathname: '/models/[slug]', params: { slug: 'nano-banana-2' } } },
        { label: 'Voir le profil Nano Banana Pro', href: { pathname: '/models/[slug]', params: { slug: 'nano-banana-pro' } } },
      ],
      breadcrumbCurrent: "Modèles d'image",
    },
  },
  es: {
    all: {
      metaTitle: 'Modelos IA: specs, límites y precios | MaxVideoAI',
      metaDescription:
        'Catálogo de modelos IA de video e imagen con specs, límites y señales de precio. Revisa capacidades antes de generar.',
      heroTitle: 'Modelos IA (specs, límites y precios)',
      heroSubhead: 'Explora modelos de video e imagen en un solo catálogo y luego entra en el hub específico que necesites.',
      heroBullets: [
        'Abre cualquier modelo para ver especificaciones, precios y guía de workflow.',
        'Usa hubs por categoría para separar con claridad los usos de video e imagen.',
      ],
      gridSrTitle: 'Modelos IA de video e imagen con specs, límites y precios en MaxVideoAI',
      bridgeText: 'Usa las tarjetas de modelo para validar capacidades y luego entra en el hub de video o imagen para afinar la selección.',
      chooseOutcomeTitle: 'Elige primero una familia de modelos',
      chooseOutcomeSubtitle: 'Empieza por el medio que quieres generar y luego filtra por límites y precio.',
      reliabilityTitle: 'Comprobaciones útiles antes de lanzar',
      reliabilitySubtitle: 'Valida encaje de capacidades, restricciones de salida y exposición de coste antes de fijar el workflow.',
      ctaTitle: 'Empieza por el hub de media correcto',
      ctaSubtitle: 'Abre el hub de video o imagen cuando quieras filtros, textos y siguientes pasos alineados al workflow.',
      ctaPills: ['Modelos de video', 'Modelos de imagen', 'Precios en vivo'],
      ctaMicrocopy: 'Navegación por categoría • Precios en vivo • Restricciones por modelo',
      ctaPrimaryLabel: 'Abrir modelos de video',
      ctaPrimaryHref: '/models/video',
      ctaSecondaryLabel: 'Abrir modelos de imagen',
      ctaSecondaryHref: '/models/image',
      nextStepsTitle: 'Siguientes pasos',
      nextStepLinks: [
        { label: 'Explorar modelos de video', href: '/models/video' },
        { label: 'Explorar modelos de imagen', href: '/models/image' },
        { label: 'Comparar motores de video', href: '/ai-video-engines' },
      ],
    },
    video: {
      metaTitle: 'Modelos de video IA: specs, límites y precios | MaxVideoAI',
      metaDescription:
        'Compara modelos de video IA por entradas soportadas, duración máxima, resolución y precio antes de renderizar.',
      heroTitle: 'Modelos de video IA (specs, límites y precios)',
      heroSubhead: 'Revisa restricciones de video, compara workflows y elige el motor correcto antes de renderizar.',
      heroBullets: [
        'Comprueba soporte texto→video, imagen→video, extensión y edición por modelo.',
        'Usa el comparativo de video solo cuando la shortlist ya esté clara.',
      ],
      gridSrTitle: 'Modelos de video IA con specs, límites y precios en MaxVideoAI',
      bridgeText: 'Usa las tarjetas de modelo para revisar capacidades de video, límites y precios antes de elegir motor.',
      chooseOutcomeTitle: 'Elige por workflow de video y restricciones',
      chooseOutcomeSubtitle: 'Empieza por entradas de video soportadas, duración máxima y coste.',
      reliabilityTitle: 'Comprobaciones que importan en video',
      reliabilitySubtitle: 'Valida encaje del workflow, restricciones de salida y señales de precio antes de renderizar.',
      ctaTitle: 'Empieza a generar video en segundos',
      ctaSubtitle: 'Elige un modelo de video arriba y luego genera o compara motores preseleccionados.',
      ctaPills: ['Precios de video', 'Límites runtime', 'Referencias de prompt'],
      ctaMicrocopy: 'Specs de video • Precios en vivo • Referencias de salidas reales',
      ctaPrimaryLabel: 'Abrir workspace de video',
      ctaPrimaryHref: '/app',
      ctaSecondaryLabel: 'Abrir comparativa de video',
      ctaSecondaryHref: '/ai-video-engines',
      nextStepsTitle: 'Siguientes pasos',
      nextStepLinks: [
        { label: 'Elegir modelo ideal', href: '/ai-video-engines' },
        { label: 'Comparar Kling 3 Pro vs Veo 3.1', href: { pathname: '/ai-video-engines/[slug]', params: { slug: 'kling-3-pro-vs-veo-3-1' } } },
        { label: 'Ver perfil de Veo 3.1 Fast', href: { pathname: '/models/[slug]', params: { slug: 'veo-3-1-fast' } } },
      ],
      breadcrumbCurrent: 'Modelos de video',
    },
    image: {
      metaTitle: 'Modelos de imagen IA: specs, límites y precios | MaxVideoAI',
      metaDescription:
        'Revisa modelos de imagen IA por modo de generación, referencias, resolución y precio por imagen antes de crear imágenes fijas.',
      heroTitle: 'Modelos de imagen IA (specs, límites y precios)',
      heroSubhead: 'Revisa capacidades de imagen fija, restricciones de edición y precio por imagen antes de generar.',
      heroBullets: [
        'Comprueba create/edit, límites de referencias y opciones de resolución.',
        'Usa Image Lab cuando estés listo para generar imágenes fijas o hacer ediciones guiadas.',
      ],
      gridSrTitle: 'Modelos de imagen IA con specs, límites y precios en MaxVideoAI',
      bridgeText: 'Usa las tarjetas de modelo para revisar flujos de imagen, límites de edición y precio antes de elegir.',
      chooseOutcomeTitle: 'Elige por workflow de imagen fija',
      chooseOutcomeSubtitle: 'Empieza por create vs edit, necesidades de referencia, tamaño de salida y precio por imagen.',
      reliabilityTitle: 'Comprobaciones que importan en imagen',
      reliabilitySubtitle: 'Valida límites de referencias, controles de salida y precios antes de lanzar runs de imagen.',
      ctaTitle: 'Empieza a generar imágenes en segundos',
      ctaSubtitle: 'Elige un modelo de imagen arriba y luego abre Image Lab para crear borradores, versiones finales o ediciones.',
      ctaPills: ['Precio por imagen', 'Límites de referencias', 'Opciones de resolución'],
      ctaMicrocopy: 'Specs de imagen • Precios en vivo • Workflows guiados por referencias',
      ctaPrimaryLabel: 'Abrir Image Lab',
      ctaPrimaryHref: '/app/image',
      ctaSecondaryLabel: 'Ver todos los modelos',
      ctaSecondaryHref: '/models',
      nextStepsTitle: 'Siguientes pasos',
      nextStepLinks: [
        { label: 'Abrir el workspace de imagen', href: '/app/image' },
        { label: 'Ver perfil de Nano Banana 2', href: { pathname: '/models/[slug]', params: { slug: 'nano-banana-2' } } },
        { label: 'Ver perfil de Nano Banana Pro', href: { pathname: '/models/[slug]', params: { slug: 'nano-banana-pro' } } },
      ],
      breadcrumbCurrent: 'Modelos de imagen',
    },
  },
};

export function getModelsScopeEnglishPath(scope: ModelsPageScope): string {
  return scope === 'all' ? '/models' : `/models/${scope}`;
}

export function getModelsScopePath(scope: ModelsPageScope, locale: AppLocale): string {
  const base = MODELS_SLUG_MAP[locale] ?? MODELS_SLUG_MAP.en ?? 'models';
  return scope === 'all' ? `/${base}` : `/${base}/${scope}`;
}

export function getScopeDefaults(scope: ModelsPageScope, locale: AppLocale): ScopePageDefaults {
  return MODELS_SCOPE_DEFAULTS[locale][scope];
}

export async function loadEngineKeySpecs(): Promise<Map<string, Record<string, unknown>>> {
  const candidates = [
    path.join(process.cwd(), 'data', 'benchmarks', 'engine-key-specs.v1.json'),
    path.join(process.cwd(), '..', 'data', 'benchmarks', 'engine-key-specs.v1.json'),
  ];
  for (const candidate of candidates) {
    try {
      const raw = await fs.readFile(candidate, 'utf8');
      const data = JSON.parse(raw) as EngineKeySpecsFile;
      const map = new Map<string, Record<string, unknown>>();
      (data.specs ?? []).forEach((entry) => {
        const key = entry.modelSlug ?? entry.engineId;
        if (key && entry.keySpecs) {
          map.set(key, entry.keySpecs);
        }
      });
      return map;
    } catch {
      // keep trying
    }
  }
  return new Map();
}

export async function loadEngineScores(): Promise<Map<string, EngineScore>> {
  const candidates = [
    path.join(process.cwd(), 'data', 'benchmarks', 'engine-scores.v1.json'),
    path.join(process.cwd(), '..', 'data', 'benchmarks', 'engine-scores.v1.json'),
  ];
  for (const candidate of candidates) {
    try {
      const raw = await fs.readFile(candidate, 'utf8');
      const data = JSON.parse(raw) as EngineScoresFile;
      const map = new Map<string, EngineScore>();
      (data.scores ?? []).forEach((entry) => {
        const key = entry.modelSlug ?? entry.engineId;
        if (key) {
          map.set(key, entry);
        }
      });
      return map;
    } catch {
      // keep trying
    }
  }
  return new Map();
}

export function getCatalogBySlug() {
  return new Map<string, EngineCatalogEntry>(engineCatalog.map((entry) => [entry.modelSlug, entry]));
}

export function resolveSupported(value: unknown) {
  if (value == null) return null;
  const normalized = String(value).trim().toLowerCase();
  if (
    normalized === 'supported' ||
    normalized.startsWith('supported ') ||
    normalized.startsWith('supported (') ||
    normalized === 'yes' ||
    normalized === 'true'
  ) {
    return true;
  }
  if (
    normalized === 'not supported' ||
    normalized.startsWith('not supported ') ||
    normalized.startsWith('not supported (') ||
    normalized === 'no' ||
    normalized === 'false'
  ) {
    return false;
  }
  return null;
}

export function extractMaxResolution(value?: string | null, fallback?: string[]) {
  const candidates = [value ?? '', ...(fallback ?? [])];
  let explicitMax = 0;
  let explicitLabel: string | null = null;
  let fallbackMax = 0;
  candidates.forEach((entry) => {
    const normalized = entry.toLowerCase();
    if (normalized.includes('4k')) {
      explicitMax = Math.max(explicitMax, 2160);
      if (!explicitLabel) explicitLabel = '4K';
      return;
    }
    const dimensionMatch = entry.trim().match(/^(\d{3,4})\s*[x×]\s*(\d{3,4})$/);
    if (dimensionMatch) {
      const width = Number(dimensionMatch[1]);
      const height = Number(dimensionMatch[2]);
      const max = Math.max(width, height);
      if (!Number.isNaN(max) && max > explicitMax) {
        explicitMax = max;
        explicitLabel = `${dimensionMatch[1]}×${dimensionMatch[2]}`;
      }
      return;
    }
    const pMatches = normalized.match(/(\d{3,4})p/g) ?? [];
    if (pMatches.length) {
      pMatches.forEach((match) => {
        const num = Number(match.replace('p', ''));
        if (!Number.isNaN(num)) explicitMax = Math.max(explicitMax, num);
      });
      return;
    }
    const matches = normalized.match(/(\d{3,4})/g) ?? [];
    matches.forEach((match) => {
      const num = Number(match);
      if (!Number.isNaN(num)) fallbackMax = Math.max(fallbackMax, num);
    });
  });
  const max = explicitMax || fallbackMax;
  if (!max) return { label: 'Data pending', value: null };
  if (explicitLabel) return { label: explicitLabel, value: max };
  return { label: `${max}p`, value: max };
}

export function extractMaxDuration(value?: string | null, fallback?: number | null) {
  if (typeof value === 'string') {
    const match = value.match(/(\d+(?:\.\d+)?)/);
    if (match) {
      const num = Number(match[1]);
      if (!Number.isNaN(num)) return { label: `${num}s`, value: num };
    }
  }
  if (typeof fallback === 'number') {
    return { label: `${fallback}s`, value: fallback };
  }
  return { label: 'Data pending', value: null };
}

export function getMinPricePerSecond(entry?: EngineCatalogEntry | null) {
  if (!entry?.engine) return null;
  const perSecond = entry.engine.pricingDetails?.perSecondCents;
  const candidates: number[] = [];
  if (typeof perSecond?.default === 'number') {
    candidates.push(applyDisplayedPriceMarginCents(perSecond.default));
    const audioOffDelta = entry.engine.pricingDetails?.addons?.audio_off?.perSecondCents;
    if (typeof audioOffDelta === 'number') {
      candidates.push(applyDisplayedPriceMarginCents(perSecond.default + audioOffDelta));
    }
  }
  if (perSecond?.byResolution) {
    Object.values(perSecond.byResolution).forEach((value) => {
      if (typeof value === 'number') candidates.push(applyDisplayedPriceMarginCents(value));
    });
  }
  if (typeof entry.engine.pricing?.base === 'number') {
    candidates.push(applyDisplayedPriceMarginCents(Math.round(entry.engine.pricing.base * 100)));
  }
  if (!candidates.length) return null;
  return Math.min(...candidates);
}

export function getPrelaunchPricingLabel(locale: AppLocale) {
  if (locale === 'fr') return 'Confirmé au lancement';
  if (locale === 'es') return 'Confirmado en lanzamiento';
  return 'TBD at launch';
}

export function getPrelaunchPricingNote(locale: AppLocale) {
  if (locale === 'fr') return 'Tarif final publié au lancement (date officielle à confirmer).';
  if (locale === 'es') return 'Precio final publicado en el lanzamiento (fecha oficial por confirmar).';
  return 'Final pricing will be published at launch (official date TBA).';
}

const SCORE_LABELS: Array<{ key: keyof EngineScore; label: string }> = [
  { key: 'fidelity', label: 'Prompt Adherence' },
  { key: 'visualQuality', label: 'Visual Quality' },
  { key: 'motion', label: 'Motion Realism' },
  { key: 'consistency', label: 'Temporal Consistency' },
  { key: 'anatomy', label: 'Human Fidelity' },
  { key: 'textRendering', label: 'Text & UI Legibility' },
  { key: 'lipsyncQuality', label: 'Audio & Lip Sync' },
  { key: 'sequencingQuality', label: 'Multi-Shot Sequencing' },
  { key: 'controllability', label: 'Controllability' },
  { key: 'speedStability', label: 'Speed & Stability' },
  { key: 'pricing', label: 'Pricing' },
];
export const SCORE_LABEL_KEYS = SCORE_LABELS.map((entry) => entry.key);
export const DEFAULT_SCORE_LABEL_MAP = SCORE_LABELS.reduce((acc, entry) => {
  acc[entry.key] = entry.label;
  return acc;
}, {} as Record<keyof EngineScore, string>);

export function computeOverall(score?: EngineScore | null) {
  if (!score) return null;
  const values = [score.fidelity, score.motion, score.consistency].filter(
    (value): value is number => typeof value === 'number'
  );
  if (!values.length) return null;
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.round(avg * 10) / 10;
}

export function deriveStrengths(score?: EngineScore | null, labels: Array<{ key: keyof EngineScore; label: string }> = SCORE_LABELS) {
  if (!score) return [];
  const entries = labels.map((entry) => {
    const value = score[entry.key];
    return typeof value === 'number' ? { label: entry.label, value } : null;
  }).filter((entry): entry is { label: string; value: number } => Boolean(entry));
  const nonPricing = entries.filter((entry) => entry.label !== 'Pricing');
  const pool = nonPricing.length ? nonPricing : entries;
  return pool
    .sort((a, b) => b.value - a.value)
    .slice(0, 2)
    .map((entry) => entry.label);
}

function toTitleCase(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

const PROVIDER_LABEL_OVERRIDES: Record<string, string> = {
  'google-veo': 'Google',
  google: 'Google',
  openai: 'OpenAI',
  minimax: 'MiniMax',
  lightricks: 'Lightricks',
  bytedance: 'ByteDance',
  pika: 'Pika',
  kling: 'Kling',
  wan: 'Wan',
};

const PROVIDER_STRIP_IDS = new Set(['openai', 'google', 'google-veo', 'minimax']);

export function formatProviderLabel(entry: FalEngineEntry, catalogEntry?: EngineCatalogEntry | null) {
  const raw = entry.brandId ?? entry.engine.brandId ?? catalogEntry?.brandId ?? entry.provider;
  if (!raw) return '';
  const normalized = String(raw).toLowerCase();
  return PROVIDER_LABEL_OVERRIDES[normalized] ?? toTitleCase(raw);
}

export function stripProvider(name: string, provider: string, providerId?: string | null) {
  if (!provider || !providerId || !PROVIDER_STRIP_IDS.has(providerId)) return name;
  const normalizedName = name.toLowerCase();
  const normalizedProvider = provider.toLowerCase();
  if (normalizedName.startsWith(normalizedProvider)) {
    return name.slice(provider.length).trim();
  }
  return name;
}

export function clampDescription(value: string, maxLength = 110) {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  const sliced = trimmed.slice(0, maxLength - 1).trim();
  const lastSpace = sliced.lastIndexOf(' ');
  const safeSlice = lastSpace > Math.floor(maxLength * 0.65) ? sliced.slice(0, lastSpace).trim() : sliced;
  return `${safeSlice}…`;
}

export const USE_CASE_MAP: Record<string, string> = {
  'seedance-2-0': 'premium multi-shot video with native audio and stronger motion realism',
  'seedance-2-0-fast': 'fast Seedance drafts for shot planning and creative iteration',
  'sora-2': 'cinematic scenes and character continuity',
  'sora-2-pro': 'studio-grade cinematic shots and hero scenes',
  'veo-3-1': 'ad-ready shots with reference, first/last and extend control',
  'veo-3-1-fast': 'fast ad cuts with first/last and extend workflows',
  'veo-3-1-lite': 'budget Veo drafts with start-image and first/last control',
  'seedance-1-5-pro': 'cinematic motion with camera lock',
  'kling-2-6-pro': 'motion-realistic cinematic clips',
  'kling-3-standard': 'multi-shot cinematic sequences with voice control',
  'kling-3-pro': 'multi-shot cinematic sequences with voice control',
  'kling-3-4k': 'native 4K final delivery renders',
  'kling-2-5-turbo': 'fast iterations with stable prompt adherence',
  'wan-2-6': 'structured prompts with clean transitions',
  'wan-2-5': 'budget-friendly prompt testing',
  'luma-ray-2': 'cinematic generation with source-video modify and reframe',
  'luma-ray-2-flash': 'fast cinematic drafts with source-video modify and reframe',
  'pika-text-to-video': 'stylized social-first clips',
  'ltx-2-3-pro': 'all-in-one LTX video workflows with audio and retakes',
  'ltx-2-3-fast': 'quick LTX 2.3 iterations for text and image video',
  'ltx-2': 'fast iteration with responsive motion',
  'ltx-2-fast': 'rapid testing and quick iteration',
  'minimax-hailuo-02-text': 'budget-friendly concept tests',
  'gpt-image-2': 'text-heavy stills, product photography, and controlled edits',
  'nano-banana': 'storyboards and still-first workflows',
  'nano-banana-pro': 'campaign stills and typography-focused edits',
  'nano-banana-2': 'grounded stills and wide-format image edits',
};

export const MODEL_CARD_DESCRIPTION_OVERRIDES: Partial<Record<AppLocale, Record<string, string>>> = {
  fr: {
    'seedance-2-0':
      'Idéal pour des vidéos multi-plans premium, avec audio natif, synchronisation labiale précise et mouvement réaliste.',
    'seedance-2-0-fast':
      'Idéal pour tester vite : tests Seedance, planification de plans et itérations, avec audio natif, lip-sync précis et génération rapide et stable.',
    'kling-3-standard':
      'Idéal pour créer des séquences cinématiques multi-plans, avec contrôle vocal et un rendu fidèle à vos instructions.',
    'kling-3-pro':
      'Idéal pour des séquences cinématiques multi-plans avec contrôle vocal, audio natif, lip-sync précis et forte contrôlabilité, en texte-vers-vidéo comme en image-vers-vidéo.',
    'kling-3-4k':
      'Idéal pour les masters finaux en 4K native : sorties premium, grands écrans et rendus approuvés après validation en Standard ou Pro.',
    'veo-3-1':
      'Idéal pour créer des plans pub maîtrisés : références, contrôle final et extension, avec un rendu fidèle et synchronisé.',
    'veo-3-1-fast':
      'Idéal pour produire vite des cuts pub : image de départ, contrôle final et extension, avec un excellent rapport vitesse/coût.',
    'ltx-2-3-fast':
      'Idéal pour des itérations rapides avec LTX 2.3, en texte-vers-vidéo et image-vers-vidéo, avec une excellente vitesse, stabilité et des tarifs compétitifs.',
    'sora-2':
      'Idéal pour des scènes cinématiques et la continuité des personnages, avec une forte fidélité humaine et des tarifs compétitifs, en texte-vers-vidéo, image-vers-vidéo et lip-sync.',
    'sora-2-pro':
      'Idéal pour des plans cinématiques premium et des scènes hero, avec une forte fidélité humaine et une qualité visuelle élevée, en texte-vers-vidéo et image-vers-vidéo.',
    'seedance-1-5-pro':
      'Idéal pour des mouvements cinématiques avec verrouillage caméra, avec audio natif, lip-sync précis et des tarifs compétitifs, en texte-vers-vidéo comme en image-vers-vidéo.',
    'veo-3-1-lite':
      'Idéal pour des tests Veo économiques, avec image de départ et contrôle début/fin, excellente rapidité et stabilité.',
    'luma-ray-2':
      'Idéal pour des générations cinématiques à partir d’une vidéo source, avec modification et recadrage, offrant une forte contrôlabilité et une haute qualité visuelle.',
    'luma-ray-2-flash':
      'Idéal pour des tests cinématiques rapides à partir d’une vidéo source, avec modification et recadrage, rapides, stables et économiques.',
    'pika-text-to-video':
      'Idéal pour des clips social stylisés, rapides, stables et économiques, en texte-vers-vidéo et image-vers-vidéo, avec contrôle début/fin.',
    'wan-2-6':
      'Idéal pour des prompts structurés et des transitions propres, rapides, stables et économiques, en texte-vers-vidéo et image-vers-vidéo.',
    'minimax-hailuo-02-text':
      'Idéal pour des tests de concepts économiques, rapides et stables, en texte-vers-vidéo et image-vers-vidéo, avec contrôle début/fin.',
    'gpt-image-2':
      'Idéal pour des images riches en texte, des packshots produit, des mockups UI et des edits guides par reference.',
    'nano-banana-2': 'Idéal pour des images fixes guidées et des retouches grand format, avec des performances fiables.',
    'nano-banana-pro': 'Idéal pour des visuels de campagne et des retouches typographiques, avec des performances fiables.',
  },
};

const DEFAULT_VALUE_SENTENCE = 'Best for {useCase} with strong {strengths} in {capabilities} workflows.';
export const DEFAULT_VALUE_SENTENCE_BY_LOCALE: Record<AppLocale, string> = {
  en: DEFAULT_VALUE_SENTENCE,
  fr: 'Idéal pour {useCase} avec de bons résultats sur {strengths} dans les workflows {capabilities}.',
  es: 'Ideal para {useCase} con buen nivel en {strengths} dentro de workflows {capabilities}.',
};
export const DEFAULT_CAPABILITY_KEYWORDS: Record<string, string> = {
  T2V: 'text-to-video',
  I2V: 'image-to-video',
  V2V: 'video-to-video',
  'Lip sync': 'lip sync',
  Audio: 'native audio',
  'First/Last': 'first/last frame control',
  Extend: 'extend workflows',
};
export const DEFAULT_VALUE_STRENGTHS_FALLBACK: Record<AppLocale, string> = {
  en: 'reliable outputs',
  fr: 'des résultats fiables',
  es: 'resultados fiables',
};
export const DEFAULT_VALUE_CAPABILITY_FALLBACK: Record<AppLocale, string> = {
  en: 'AI video',
  fr: 'vidéo IA',
  es: 'video IA',
};
export const DEFAULT_VALUE_CONJUNCTION: Record<AppLocale, string> = {
  en: 'and',
  fr: 'et',
  es: 'y',
};

function formatTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');
}

function joinWithConjunction(values: string[], conjunction: string) {
  if (!values.length) return '';
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} ${conjunction} ${values[1]}`;
  return `${values.slice(0, -1).join(', ')} ${conjunction} ${values[values.length - 1]}`;
}

const SPEC_TOKEN_REGEX = /(\$\d+|\d+(?:\.\d+)?\s*s|\d+\s*seconds?|\d+\s*fps|\d+\s*p|\d+\s*×\s*\d+|4k|1080p|720p|2160p|\d+–\d+\s*s)/gi;
const PAREN_SPEC_REGEX = /\([^)]*?(\d|p|fps|\$)[^)]*\)/gi;

export function sanitizeDescription(text: string) {
  const withoutParens = text.replace(PAREN_SPEC_REGEX, '');
  const withoutTokens = withoutParens.replace(SPEC_TOKEN_REGEX, '');
  const withoutHints = withoutTokens.replace(/\b(up to|from)\b\s*/gi, '');
  const withoutFragments = withoutHints
    .replace(/\s*\/+\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\(\s*\)/g, '')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/([,.;:])\s*[-–]\s*/g, '$1 ')
    .replace(/\s{2,}/g, ' ');
  return withoutFragments.replace(/\s+$/, '').trim();
}

function capabilityKeywords(
  capabilities: string[],
  map: Record<string, string>,
  conjunction: string,
  fallback: string
) {
  const translated = capabilities.map((cap) => map[cap] ?? cap.toLowerCase());
  if (!translated.length) return fallback;
  return joinWithConjunction(translated, conjunction);
}

export function buildValueSentence({
  slug,
  strengths,
  capabilities,
  fallback,
  template,
  strengthsFallback,
  capabilityFallback,
  conjunction,
  useCaseMap,
  capabilityMap,
}: {
  slug: string;
  strengths: string[];
  capabilities: string[];
  fallback: string;
  template: string;
  strengthsFallback: string;
  capabilityFallback: string;
  conjunction: string;
  useCaseMap: Record<string, string>;
  capabilityMap: Record<string, string>;
}) {
  const useCase = useCaseMap[slug] ?? fallback;
  const cleanedUseCase = sanitizeDescription(useCase);
  const strengthsText = strengths.length ? joinWithConjunction(strengths, conjunction) : strengthsFallback;
  const capabilityText = capabilityKeywords(capabilities, capabilityMap, conjunction, capabilityFallback);
  return formatTemplate(template, {
    useCase: cleanedUseCase,
    strengths: strengthsText,
    capabilities: capabilityText,
  });
}

type EngineTypeKey = 'textImage' | 'text' | 'imageVideo' | 'image' | 'default';

const ENGINE_TYPE_KEYS: EngineTypeKey[] = ['textImage', 'text', 'imageVideo', 'image', 'default'];

export function getEngineTypeKey(entry: FalEngineEntry): EngineTypeKey {
  if (entry.type && ENGINE_TYPE_KEYS.includes(entry.type as EngineTypeKey)) return entry.type as EngineTypeKey;
  const modes = new Set(entry.engine.modes);
  const hasTextVideo = modes.has('t2v') || modes.has('a2v');
  const hasImageVideo =
    modes.has('i2v') || modes.has('v2v') || modes.has('reframe') || modes.has('r2v') || modes.has('retake') || entry.engine.keyframes;
  if (isImageOnlyModel(entry)) return 'image';
  if (hasTextVideo && hasImageVideo) return 'textImage';
  if (hasTextVideo) return 'text';
  if (hasImageVideo || supportsVideoGeneration(entry)) return 'imageVideo';
  return 'default';
}

export function getEngineDisplayName(entry: FalEngineEntry): string {
  const name = entry.marketingName ?? entry.engine.label;
  return name
    .replace(/\s*\(.*\)$/, '')
    .replace(/\s+Text to Video$/i, '')
    .replace(/\s+Image to Video$/i, '')
    .trim();
}

function sentenceCaseHeroPart(value: string) {
  const trimmed = value.trim().replace(/[.。]+$/, '');
  if (!trimmed) return trimmed;
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}.`;
}

export function splitModelsHeroTitle(title: string) {
  const parenMatch = title.match(/^(.*?)\s*\((.*?)\)\s*$/);
  if (parenMatch) {
    return {
      lead: sentenceCaseHeroPart(parenMatch[1]),
      accent: sentenceCaseHeroPart(parenMatch[2]),
    };
  }
  const colonIndex = title.indexOf(':');
  if (colonIndex > 0) {
    return {
      lead: sentenceCaseHeroPart(title.slice(0, colonIndex)),
      accent: sentenceCaseHeroPart(title.slice(colonIndex + 1)),
    };
  }
  return {
    lead: sentenceCaseHeroPart(title),
    accent: '',
  };
}

export function splitHeroAccentTitle(accent: string) {
  const normalized = accent.trim();
  const prefixMatch = normalized.match(/^(All|Toutes les|Todos los|Todas las)\s+(.+)$/i);
  if (!prefixMatch) {
    return { prefix: '', emphasis: normalized };
  }
  return {
    prefix: `${prefixMatch[1]} `,
    emphasis: prefixMatch[2],
  };
}
