import type { Metadata } from 'next';
import Script from 'next/script';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { Link } from '@/i18n/navigation';
import { UIIcon } from '@/components/ui/UIIcon';
import { Clapperboard, Copy, Film, Sparkles, Timer, Wand2, Wallet } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { resolveDictionary } from '@/lib/i18n/server';
import { listFalEngines, type FalEngineEntry } from '@/config/falEngines';
import { localePathnames, type AppLocale } from '@/i18n/locales';
import { buildSlugMap } from '@/lib/i18nSlugs';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { SITE_BASE_URL } from '@/lib/metadataUrls';
import { getBreadcrumbLabels } from '@/lib/seo/breadcrumbs';
import { ModelsGallery } from '@/components/marketing/ModelsGallery';
import { getEnginePictogram } from '@/lib/engine-branding';
import { isImageOnlyModel, isModelInScope, supportsVideoGeneration, type ModelCatalogScope } from '@/lib/models/catalog';
import { getEngineLocalized } from '@/lib/models/i18n';
import { computeMarketingPriceRange } from '@/lib/pricing-marketing';
import { applyDisplayedPriceMarginCents } from '@/lib/pricing-display';
import { getLocalizedCapabilityKeywords, getLocalizedModelUseCases } from '@/lib/ltx-localization';
import engineCatalog from '@/config/engine-catalog.json';
const MODELS_SLUG_MAP = buildSlugMap('models');
type ModelsPageScope = Extract<ModelCatalogScope, 'all' | 'video' | 'image'>;

const DEFAULT_ENGINE_TYPE_LABELS = {
  textImage: 'Text + Image to Video',
  text: 'Text to Video',
  imageVideo: 'Image to Video',
  image: 'Image Model',
  default: 'AI Model',
} as const;

type EngineCatalogEntry = (typeof engineCatalog)[number];

type EngineScore = {
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

type ScopePageDefaults = {
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

const MODELS_SCOPE_NAV_LABELS: Record<AppLocale, ScopeNavLabelMap> = {
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
        { label: 'Comparer les moteurs vidéo', href: '/ai-video-engines' },
      ],
    },
    video: {
      metaTitle: 'Modèles vidéo IA : specs, limites et prix | MaxVideoAI',
      metaDescription:
        'Comparez les modèles vidéo IA par entrées supportées, durée max, résolution et prix avant rendu.',
      heroTitle: 'Modèles vidéo IA (specs, limites et prix)',
      heroSubhead: 'Passez en revue les contraintes vidéo, comparez les workflows et retenez le bon moteur avant rendu.',
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
      ctaSubtitle: 'Choisissez un modèle vidéo ci-dessus, puis générez ou comparez vos moteurs shortlistés.',
      ctaPills: ['Tarifs vidéo', 'Limites runtime', 'Références de prompt'],
      ctaMicrocopy: 'Specs vidéo • Tarifs live • Références de sorties réelles',
      ctaPrimaryLabel: 'Ouvrir le workspace vidéo',
      ctaPrimaryHref: '/app',
      ctaSecondaryLabel: 'Ouvrir le comparatif vidéo',
      ctaSecondaryHref: '/ai-video-engines',
      nextStepsTitle: 'Étapes suivantes',
      nextStepLinks: [
        { label: 'Choisir un moteur par use case', href: '/ai-video-engines' },
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
        "Utilisez l’Image Lab quand vous êtes prêt à générer des stills ou des edits guidés.",
      ],
      gridSrTitle: "Modèles d'image IA avec specs, limites et prix sur MaxVideoAI",
      bridgeText: "Utilisez les cartes modèle pour valider les workflows image, les contraintes d'edit et le prix avant choix.",
      chooseOutcomeTitle: "Choisir par workflow d'image fixe",
      chooseOutcomeSubtitle: "Partez de create vs edit, des besoins en références, de la taille de sortie et du prix par image.",
      reliabilityTitle: "Contrôles qui comptent pour l'image",
      reliabilitySubtitle: "Validez limites de références, contrôles de sortie et prix avant de lancer vos runs image.",
      ctaTitle: 'Lancez une génération image en quelques secondes',
      ctaSubtitle: "Choisissez un modèle image ci-dessus, puis ouvrez l’Image Lab pour générer brouillons, finals ou edits.",
      ctaPills: ['Prix par image', 'Limites de références', 'Options de résolution'],
      ctaMicrocopy: "Specs image • Tarifs live • Workflows guidés par références",
      ctaPrimaryLabel: "Ouvrir l'Image Lab",
      ctaPrimaryHref: '/app/image',
      ctaSecondaryLabel: 'Voir tous les modèles',
      ctaSecondaryHref: '/models',
      nextStepsTitle: 'Étapes suivantes',
      nextStepLinks: [
        { label: "Ouvrir le workspace image", href: '/app/image' },
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
        'Abre cualquier modelo para ver specs, precios y guía de workflow.',
        'Usa hubs por categoría para separar con claridad los usos de video e imagen.',
      ],
      gridSrTitle: 'Modelos IA de video e imagen con specs, límites y precios en MaxVideoAI',
      bridgeText: 'Usa las tarjetas de modelo para validar capacidades y luego entra en el hub de video o imagen para afinar la shortlist.',
      chooseOutcomeTitle: 'Elige primero una familia de modelos',
      chooseOutcomeSubtitle: 'Empieza por el medio que quieres generar y luego filtra por límites y precio.',
      reliabilityTitle: 'Comprobaciones útiles antes de lanzar',
      reliabilitySubtitle: 'Valida encaje de capacidades, restricciones de salida y exposición de coste antes de fijar el workflow.',
      ctaTitle: 'Empieza por el hub de media correcto',
      ctaSubtitle: 'Abre el hub de video o imagen cuando quieras filtros, copy y siguientes pasos alineados al workflow.',
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
      ctaSubtitle: 'Elige un modelo de video arriba y luego genera o compara motores shortlistados.',
      ctaPills: ['Precios de video', 'Límites runtime', 'Referencias de prompt'],
      ctaMicrocopy: 'Specs de video • Precios en vivo • Referencias de salidas reales',
      ctaPrimaryLabel: 'Abrir workspace de video',
      ctaPrimaryHref: '/app',
      ctaSecondaryLabel: 'Abrir comparativa de video',
      ctaSecondaryHref: '/ai-video-engines',
      nextStepsTitle: 'Siguientes pasos',
      nextStepLinks: [
        { label: 'Elegir motor por caso de uso', href: '/ai-video-engines' },
        { label: 'Comparar Kling 3 Pro vs Veo 3.1', href: { pathname: '/ai-video-engines/[slug]', params: { slug: 'kling-3-pro-vs-veo-3-1' } } },
        { label: 'Ver perfil de Veo 3.1 Fast', href: { pathname: '/models/[slug]', params: { slug: 'veo-3-1-fast' } } },
      ],
      breadcrumbCurrent: 'Modelos de video',
    },
    image: {
      metaTitle: 'Modelos de imagen IA: specs, límites y precios | MaxVideoAI',
      metaDescription:
        'Revisa modelos de imagen IA por modo de generación, referencias, resolución y precio por imagen antes de crear stills.',
      heroTitle: 'Modelos de imagen IA (specs, límites y precios)',
      heroSubhead: 'Revisa capacidades de imagen fija, restricciones de edición y precio por imagen antes de generar.',
      heroBullets: [
        'Comprueba create/edit, límites de referencias y opciones de resolución.',
        'Usa el Image Lab cuando estés listo para generar stills o edits guiados.',
      ],
      gridSrTitle: 'Modelos de imagen IA con specs, límites y precios en MaxVideoAI',
      bridgeText: 'Usa las tarjetas de modelo para revisar workflows de imagen, límites de edit y precio antes de elegir.',
      chooseOutcomeTitle: 'Elige por workflow de imagen fija',
      chooseOutcomeSubtitle: 'Empieza por create vs edit, necesidades de referencia, tamaño de salida y precio por imagen.',
      reliabilityTitle: 'Comprobaciones que importan en imagen',
      reliabilitySubtitle: 'Valida límites de referencias, controles de salida y precios antes de lanzar runs de imagen.',
      ctaTitle: 'Empieza a generar stills en segundos',
      ctaSubtitle: 'Elige un modelo de imagen arriba y luego abre el Image Lab para drafts, finales o edits.',
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

function getModelsScopeEnglishPath(scope: ModelsPageScope): string {
  return scope === 'all' ? '/models' : `/models/${scope}`;
}

function getModelsScopePath(scope: ModelsPageScope, locale: AppLocale): string {
  const base = MODELS_SLUG_MAP[locale] ?? MODELS_SLUG_MAP.en ?? 'models';
  return scope === 'all' ? `/${base}` : `/${base}/${scope}`;
}

function getScopeDefaults(scope: ModelsPageScope, locale: AppLocale): ScopePageDefaults {
  return MODELS_SCOPE_DEFAULTS[locale][scope];
}

async function loadEngineKeySpecs(): Promise<Map<string, Record<string, unknown>>> {
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

async function loadEngineScores(): Promise<Map<string, EngineScore>> {
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

function getCatalogBySlug() {
  return new Map<string, EngineCatalogEntry>(engineCatalog.map((entry) => [entry.modelSlug, entry]));
}

function resolveSupported(value: unknown) {
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

function extractMaxResolution(value?: string | null, fallback?: string[]) {
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

function extractMaxDuration(value?: string | null, fallback?: number | null) {
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

function getMinPricePerSecond(entry?: EngineCatalogEntry | null) {
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

function getPrelaunchPricingLabel(locale: AppLocale) {
  if (locale === 'fr') return 'Confirmé au lancement';
  if (locale === 'es') return 'Confirmado en lanzamiento';
  return 'TBD at launch';
}

function getPrelaunchPricingNote(locale: AppLocale) {
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
const SCORE_LABEL_KEYS = SCORE_LABELS.map((entry) => entry.key);
const DEFAULT_SCORE_LABEL_MAP = SCORE_LABELS.reduce((acc, entry) => {
  acc[entry.key] = entry.label;
  return acc;
}, {} as Record<keyof EngineScore, string>);

function computeOverall(score?: EngineScore | null) {
  if (!score) return null;
  const values = [score.fidelity, score.motion, score.consistency].filter(
    (value): value is number => typeof value === 'number'
  );
  if (!values.length) return null;
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.round(avg * 10) / 10;
}

function deriveStrengths(score?: EngineScore | null, labels: Array<{ key: keyof EngineScore; label: string }> = SCORE_LABELS) {
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

function formatProviderLabel(entry: FalEngineEntry, catalogEntry?: EngineCatalogEntry | null) {
  const raw = entry.brandId ?? entry.engine.brandId ?? catalogEntry?.brandId ?? entry.provider;
  if (!raw) return '';
  const normalized = String(raw).toLowerCase();
  return PROVIDER_LABEL_OVERRIDES[normalized] ?? toTitleCase(raw);
}

function stripProvider(name: string, provider: string, providerId?: string | null) {
  if (!provider || !providerId || !PROVIDER_STRIP_IDS.has(providerId)) return name;
  const normalizedName = name.toLowerCase();
  const normalizedProvider = provider.toLowerCase();
  if (normalizedName.startsWith(normalizedProvider)) {
    return name.slice(provider.length).trim();
  }
  return name;
}

function clampDescription(value: string, maxLength = 110) {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  const sliced = trimmed.slice(0, maxLength - 1).trim();
  const lastSpace = sliced.lastIndexOf(' ');
  const safeSlice = lastSpace > Math.floor(maxLength * 0.65) ? sliced.slice(0, lastSpace).trim() : sliced;
  return `${safeSlice}…`;
}

const USE_CASE_MAP: Record<string, string> = {
  'sora-2': 'cinematic scenes and character continuity',
  'sora-2-pro': 'studio-grade cinematic shots and hero scenes',
  'veo-3-1': 'ad-ready shots and precise framing control',
  'veo-3-1-fast': 'fast ad cuts and rapid iteration',
  'veo-3-1-first-last': 'storyboard-driven shots with fixed frames',
  'seedance-1-5-pro': 'cinematic motion with camera lock',
  'kling-2-6-pro': 'motion-realistic cinematic clips',
  'kling-3-standard': 'multi-shot cinematic sequences with voice control',
  'kling-3-pro': 'multi-shot cinematic sequences with voice control',
  'kling-2-5-turbo': 'fast iterations with stable prompt adherence',
  'wan-2-6': 'structured prompts with clean transitions',
  'wan-2-5': 'budget-friendly prompt testing',
  'pika-text-to-video': 'stylized social-first clips',
  'ltx-2-3-pro': 'all-in-one LTX video workflows with audio and retakes',
  'ltx-2-3-fast': 'quick LTX 2.3 iterations for text and image video',
  'ltx-2': 'fast iteration with responsive motion',
  'ltx-2-fast': 'rapid testing and quick iteration',
  'minimax-hailuo-02-text': 'budget-friendly concept tests',
  'nano-banana': 'storyboards and still-first workflows',
  'nano-banana-pro': 'campaign stills and typography-focused edits',
  'nano-banana-2': 'grounded stills and wide-format image edits',
};

const DEFAULT_VALUE_SENTENCE = 'Best for {useCase} with strong {strengths} in {capabilities} workflows.';
const DEFAULT_VALUE_SENTENCE_BY_LOCALE: Record<AppLocale, string> = {
  en: DEFAULT_VALUE_SENTENCE,
  fr: 'Idéal pour {useCase} avec de bons résultats sur {strengths} dans les workflows {capabilities}.',
  es: 'Ideal para {useCase} con buen nivel en {strengths} dentro de workflows {capabilities}.',
};
const DEFAULT_CAPABILITY_KEYWORDS: Record<string, string> = {
  T2V: 'text-to-video',
  I2V: 'image-to-video',
  V2V: 'video-to-video',
  'Lip sync': 'lip sync',
  Audio: 'native audio',
  'First/Last': 'first/last frame control',
  Extend: 'extend workflows',
};
const DEFAULT_VALUE_STRENGTHS_FALLBACK: Record<AppLocale, string> = {
  en: 'reliable outputs',
  fr: 'des résultats fiables',
  es: 'resultados fiables',
};
const DEFAULT_VALUE_CAPABILITY_FALLBACK: Record<AppLocale, string> = {
  en: 'AI video',
  fr: 'vidéo IA',
  es: 'video IA',
};
const DEFAULT_VALUE_CONJUNCTION: Record<AppLocale, string> = {
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

function sanitizeDescription(text: string) {
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

function buildValueSentence({
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

export async function generateModelsMetadata({
  params,
  scope = 'all',
}: {
  params: { locale: AppLocale };
  scope?: ModelsPageScope;
}): Promise<Metadata> {
  const locale = params.locale;
  const scopeDefaults = getScopeDefaults(scope, locale);
  const t = scope === 'all' ? await getTranslations({ locale, namespace: 'models.meta' }) : null;
  const meta = buildSeoMetadata({
    locale,
    title: scope === 'all' ? t!('title') : scopeDefaults.metaTitle,
    description: scope === 'all' ? t!('description') : scopeDefaults.metaDescription,
    ...(scope === 'all'
      ? {
          hreflangGroup: 'models' as const,
          slugMap: MODELS_SLUG_MAP,
        }
      : {
          englishPath: getModelsScopeEnglishPath(scope),
        }),
    image: '/og/models-hub.png',
    imageAlt: 'Model lineup overview with Price-Before chip.',
  });
  return meta;
}

type EngineTypeKey = 'textImage' | 'text' | 'imageVideo' | 'image' | 'default';

const ENGINE_TYPE_KEYS: EngineTypeKey[] = ['textImage', 'text', 'imageVideo', 'image', 'default'];

function getEngineTypeKey(entry: FalEngineEntry): EngineTypeKey {
  if (entry.type && ENGINE_TYPE_KEYS.includes(entry.type as EngineTypeKey)) return entry.type as EngineTypeKey;
  const modes = new Set(entry.engine.modes);
  const hasTextVideo = modes.has('t2v') || modes.has('a2v');
  const hasImageVideo = modes.has('i2v') || modes.has('r2v') || modes.has('retake') || entry.engine.keyframes;
  if (isImageOnlyModel(entry)) return 'image';
  if (hasTextVideo && hasImageVideo) return 'textImage';
  if (hasTextVideo) return 'text';
  if (hasImageVideo || supportsVideoGeneration(entry)) return 'imageVideo';
  return 'default';
}

function getEngineDisplayName(entry: FalEngineEntry): string {
  const name = entry.marketingName ?? entry.engine.label;
  return name
    .replace(/\s*\(.*\)$/, '')
    .replace(/\s+Text to Video$/i, '')
    .replace(/\s+Image to Video$/i, '')
    .trim();
}

export default async function ModelsCatalogPage({ scope = 'all' }: { scope?: ModelsPageScope }) {
  const { locale, dictionary } = await resolveDictionary();
  const activeLocale = locale as AppLocale;
  const scopeDefaults = getScopeDefaults(scope, activeLocale);
  const scopeLabels = MODELS_SCOPE_NAV_LABELS[activeLocale];
  const breadcrumbLabels = getBreadcrumbLabels(activeLocale);
  const localePrefix = localePathnames[activeLocale] ? `/${localePathnames[activeLocale]}` : '';
  const modelsBasePath = `${localePrefix}/${MODELS_SLUG_MAP[activeLocale] ?? MODELS_SLUG_MAP.en ?? 'models'}`.replace(
    /\/{2,}/g,
    '/'
  );
  const modelsPath = `${localePrefix}${getModelsScopePath(scope, activeLocale)}`.replace(/\/{2,}/g, '/');
  const homeUrl = `${SITE_BASE_URL}${localePrefix || ''}`;
  const modelsUrl = `${SITE_BASE_URL}${modelsPath}`;
  const modelsBaseUrl = `${SITE_BASE_URL}${modelsBasePath}`;
  const breadcrumbItems = [
    {
      '@type': 'ListItem',
      position: 1,
      name: breadcrumbLabels.home,
      item: homeUrl,
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: breadcrumbLabels.models,
      item: modelsBaseUrl,
    },
  ];
  if (scope !== 'all' && scopeDefaults.breadcrumbCurrent) {
    breadcrumbItems.push({
      '@type': 'ListItem',
      position: 3,
      name: scopeDefaults.breadcrumbCurrent,
      item: modelsUrl,
    });
  }
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbItems,
  };
  const content = dictionary.models;
  const galleryCopy = (content.gallery ?? {}) as unknown as {
    scoreLabels?: Record<keyof EngineScore, string>;
    valueSentence?: {
      template?: string;
      strengthsFallback?: string;
      capabilityFallback?: string;
      conjunction?: string;
      useCases?: Record<string, string>;
      capabilityKeywords?: Record<string, string>;
    };
    stats?: {
      typeShort?: string;
    };
  };
  const listingCopy = (content.listing ?? {}) as {
    hero?: {
      title?: string;
      subtitle?: string;
      bullets?: string[];
      compareLabel?: string;
    };
    grid?: {
      srTitle?: string;
      bridgeText?: string;
    };
    quickCompare?: {
      title?: string;
      subtitle?: string;
      shortcuts?: string[];
    };
    chooseOutcome?: {
      title?: string;
      subtitle?: string;
      tiles?: { title?: string; description?: string }[];
    };
    reliability?: {
      title?: string;
      subtitle?: string;
      items?: { title?: string; body?: string }[];
      faq?: { question?: string; answer?: string }[];
    };
    cta?: {
      title?: string;
      subtitle?: string;
      pills?: string[];
      microcopy?: string;
      primaryLabel?: string;
      secondaryLabel?: string;
    };
  };
  const heroTitle =
    scope === 'all'
      ? listingCopy.hero?.title ?? content.hero?.title ?? scopeDefaults.heroTitle
      : scopeDefaults.heroTitle;
  const heroSubhead =
    scope === 'all'
      ? listingCopy.hero?.subtitle ?? content.hero?.subtitle ?? scopeDefaults.heroSubhead
      : scopeDefaults.heroSubhead;
  const cardCtaLabel = content.cardCtaLabel ?? 'Explore model';
  const engineTypeLabels = {
    ...DEFAULT_ENGINE_TYPE_LABELS,
    ...(content.engineTypeLabels ?? {}),
  };
  const engineMetaCopy = (content.meta ?? {}) as Record<
    string,
    {
      displayName?: string;
      description?: string;
      priceBefore?: string;
      versionLabel?: string;
    }
  >;
  const keySpecsMap = await loadEngineKeySpecs();
  const scoresMap = await loadEngineScores();
  const catalogBySlug = getCatalogBySlug();

  const priorityOrder = [
    'sora-2',
    'sora-2-pro',
    'veo-3-1',
    'seedance-2-0',
    'seedance-1-5-pro',
    'veo-3-1-fast',
    'veo-3-1-first-last',
    'pika-text-to-video',
    'wan-2-6',
    'wan-2-5',
    'kling-3-standard',
    'kling-3-pro',
    'kling-2-6-pro',
    'kling-2-5-turbo',
    'ltx-2-3-fast',
    'ltx-2-3-pro',
    'ltx-2-fast',
    'ltx-2',
    'minimax-hailuo-02-text',
    'nano-banana-2',
    'nano-banana-pro',
    'nano-banana',
  ];

  const engineIndex = new Map<string, FalEngineEntry>(listFalEngines().map((entry) => [entry.modelSlug, entry]));
  const priorityEngines = priorityOrder
    .map((slug) => engineIndex.get(slug))
    .filter((entry): entry is FalEngineEntry => Boolean(entry));
  const remainingEngines = listFalEngines()
    .filter((entry) => !priorityOrder.includes(entry.modelSlug))
    .sort((a, b) => getEngineDisplayName(a).localeCompare(getEngineDisplayName(b)));
  const engines = [...priorityEngines, ...remainingEngines].filter((entry) => isModelInScope(entry, scope));

  const localizedMap = new Map<string, Awaited<ReturnType<typeof getEngineLocalized>>>(
    await Promise.all(
      engines.map(async (engine) => {
        const localized = await getEngineLocalized(engine.modelSlug, activeLocale);
        return [engine.modelSlug, localized] as const;
      })
    )
  );
  const pricingRangeMap = new Map(
    await Promise.all(
      engines.map(async (engine) => {
        const range = await computeMarketingPriceRange(engine.engine, { durationSec: 5, memberTier: 'member' });
        return [engine.modelSlug, range] as const;
      })
    )
  );

  const scoreLabelMap = { ...DEFAULT_SCORE_LABEL_MAP, ...(galleryCopy.scoreLabels ?? {}) };
  const scoreLabels = SCORE_LABEL_KEYS.map((key) => ({
    key,
    label: scoreLabelMap[key] ?? DEFAULT_SCORE_LABEL_MAP[key],
  }));
  const valueTemplate = galleryCopy.valueSentence?.template ?? DEFAULT_VALUE_SENTENCE_BY_LOCALE[activeLocale];
  const strengthsFallback =
    galleryCopy.valueSentence?.strengthsFallback ?? DEFAULT_VALUE_STRENGTHS_FALLBACK[activeLocale];
  const capabilityFallback =
    galleryCopy.valueSentence?.capabilityFallback ?? DEFAULT_VALUE_CAPABILITY_FALLBACK[activeLocale];
  const conjunction = galleryCopy.valueSentence?.conjunction ?? DEFAULT_VALUE_CONJUNCTION[activeLocale];
  const useCaseMap = { ...USE_CASE_MAP, ...getLocalizedModelUseCases(activeLocale), ...(galleryCopy.valueSentence?.useCases ?? {}) };
  const capabilityMap = {
    ...DEFAULT_CAPABILITY_KEYWORDS,
    ...getLocalizedCapabilityKeywords(activeLocale),
    ...(galleryCopy.valueSentence?.capabilityKeywords ?? {}),
  };

  const modelCards = engines.map((engine) => {
    const meta = engineMetaCopy[engine.modelSlug] ?? engineMetaCopy[engine.id] ?? null;
    const localized = localizedMap.get(engine.modelSlug);
    const engineTypeKey = getEngineTypeKey(engine);
    const engineType = engineTypeLabels[engineTypeKey] ?? DEFAULT_ENGINE_TYPE_LABELS[engineTypeKey];
    const versionLabel = localized?.versionLabel ?? meta?.versionLabel ?? engine.versionLabel ?? '';
    const displayName =
      localized?.marketingName ?? meta?.displayName ?? engine.cardTitle ?? getEngineDisplayName(engine);
    const catalogEntry = catalogBySlug.get(engine.modelSlug) ?? null;
    const keySpecs = keySpecsMap.get(engine.modelSlug) ?? {};
    const scoreEntry =
      scoresMap.get(engine.modelSlug) ?? scoresMap.get(engine.engine.id) ?? scoresMap.get(engine.id) ?? null;
    const overallScore = computeOverall(scoreEntry);
    const strengths = deriveStrengths(scoreEntry, scoreLabels);
    const providerId = (engine.brandId ?? engine.engine.brandId ?? catalogEntry?.brandId ?? '').toString().toLowerCase();
    const providerLabel = formatProviderLabel(engine, catalogEntry);
    const engineName = stripProvider(displayName, providerLabel, providerId) || displayName;
    const normalizedVersion = versionLabel.replace(/^v\s*/i, '').trim();
    const hasVersion =
      normalizedVersion &&
      (engineName.toLowerCase().includes(normalizedVersion.toLowerCase()) ||
        engineName.toLowerCase().includes(versionLabel.toLowerCase()));
    const titleLabel = normalizedVersion && !hasVersion ? `${engineName} ${normalizedVersion}` : engineName;
    const modes = new Set(catalogEntry?.engine?.modes ?? engine.engine.modes ?? []);
    const isImageOnly = isImageOnlyModel(engine);
    const t2v = resolveSupported((keySpecs as Record<string, unknown>).textToVideo) ?? modes.has('t2v');
    const i2v = resolveSupported((keySpecs as Record<string, unknown>).imageToVideo) ?? modes.has('i2v');
    const v2v = resolveSupported((keySpecs as Record<string, unknown>).videoToVideo) ?? modes.has('v2v');
    const firstLast =
      resolveSupported((keySpecs as Record<string, unknown>).firstLastFrame) ??
      Boolean(catalogEntry?.engine?.keyframes);
    const extend = Boolean(catalogEntry?.engine?.extend);
    const lipSync = resolveSupported((keySpecs as Record<string, unknown>).lipSync) ?? undefined;
    const audioSupported =
      resolveSupported((keySpecs as Record<string, unknown>).audioOutput) ??
      (catalogEntry?.engine?.audio == null ? null : Boolean(catalogEntry.engine.audio));
    const maxResolution = extractMaxResolution(
      (keySpecs as Record<string, string>).maxResolution,
      catalogEntry?.engine?.resolutions
    );
    const maxDuration = extractMaxDuration(
      (keySpecs as Record<string, string>).maxDuration,
      catalogEntry?.engine?.maxDurationSec ?? null
    );
    const pricingRange = pricingRangeMap.get(engine.modelSlug) ?? null;
    const priceFromCents = pricingRange?.min.cents ?? getMinPricePerSecond(catalogEntry);
    const isPrelaunchWaitlist = engine.availability === 'waitlist';
    const hasConfirmedPricing = !isPrelaunchWaitlist && typeof priceFromCents === 'number' && priceFromCents > 0;
    const showPrelaunchPricePlaceholder = isPrelaunchWaitlist;
    const priceFrom = hasConfirmedPricing
      ? isImageOnly
        ? `$${(priceFromCents / 100).toFixed(2)}`
        : `$${(priceFromCents / 100).toFixed(2)}/s`
      : showPrelaunchPricePlaceholder
        ? getPrelaunchPricingLabel(activeLocale)
        : 'Data pending';
    const capabilityKeywordsList = [
      t2v ? 'T2V' : null,
      i2v ? 'I2V' : null,
      v2v ? 'V2V' : null,
      lipSync ? 'Lip sync' : null,
      audioSupported ? 'Audio' : null,
      firstLast ? 'First/Last' : null,
      extend ? 'Extend' : null,
    ]
      .filter(Boolean) as string[];
    const capabilities = capabilityKeywordsList
      .filter((cap) => cap !== 'Lip sync' && cap !== 'Audio')
      .slice(0, 5) as string[];
    const compareDisabled = ['nano-banana', 'nano-banana-pro', 'nano-banana-2'].includes(engine.modelSlug);
    const bestForFallback = catalogEntry?.bestFor ? sanitizeDescription(catalogEntry.bestFor) : engineType;
    const generatedDescription = buildValueSentence({
      slug: engine.modelSlug,
      strengths,
      capabilities: capabilityKeywordsList,
      fallback: bestForFallback,
      template: valueTemplate,
      strengthsFallback,
      capabilityFallback,
      conjunction,
      useCaseMap,
      capabilityMap,
    });
    const microDescription = clampDescription(generatedDescription, 170);
    const pictogram = getEnginePictogram({
      id: engine.engine.id,
      brandId: engine.brandId ?? engine.engine.brandId,
      label: displayName,
    });

    return {
      id: engine.modelSlug,
      label: titleLabel,
      provider: providerLabel,
      description: microDescription,
      versionLabel,
      overallScore,
      priceNote: showPrelaunchPricePlaceholder ? getPrelaunchPricingNote(activeLocale) : null,
      priceNoteHref: null,
      href: { pathname: '/models/[slug]', params: { slug: engine.modelSlug } },
      backgroundColor: pictogram.backgroundColor,
      textColor: pictogram.textColor,
      strengths,
      capabilities: capabilities.slice(0, 5),
      stats: {
        priceFrom: priceFrom === 'Data pending' ? '—' : priceFrom,
        maxDuration: isImageOnly ? 'Image' : maxDuration.label === 'Data pending' ? '—' : maxDuration.label,
        maxResolution: maxResolution.label === 'Data pending' ? '—' : maxResolution.label,
      },
      statsLabels: {
        duration: isImageOnly ? galleryCopy.stats?.typeShort ?? 'Type' : undefined,
      },
      audioAvailable: Boolean(audioSupported),
      compareDisabled,
      filterMeta: {
        t2v,
        i2v,
        v2v,
        firstLast,
        extend,
        lipSync,
        audio: Boolean(audioSupported),
        maxResolution: maxResolution.value,
        maxDuration: maxDuration.value,
        priceFrom: (() => {
          return hasConfirmedPricing ? priceFromCents / 100 : null;
        })(),
        legacy: Boolean(engine.isLegacy),
      },
    };
  });

  const heroBullets =
    scope === 'all'
      ? listingCopy.hero?.bullets ?? scopeDefaults.heroBullets
      : scopeDefaults.heroBullets;

  const cardBySlug = new Map(modelCards.map((card) => [card.id, card]));
  const scopeTabs = (['all', 'video', 'image'] as const).map((value) => ({
    id: value,
    label: scopeLabels[value],
    href: value === 'all' ? '/models' : `/models/${value}`,
    active: scope === value,
  }));
  const showVideoCompare = scope === 'video';
  const quickCompareMicroLabels = listingCopy.quickCompare?.shortcuts ?? [];
  const quickCompareShortcuts = [
    { a: 'sora-2', b: 'veo-3-1', micro: quickCompareMicroLabels[0] ?? 'cinematic vs ad-ready' },
    { a: 'sora-2', b: 'kling-3-standard', micro: quickCompareMicroLabels[1] ?? 'cinematic vs multi-shot' },
    { a: 'veo-3-1', b: 'kling-3-standard', micro: quickCompareMicroLabels[2] ?? 'ads vs story' },
    { a: 'sora-2', b: 'wan-2-6', micro: quickCompareMicroLabels[3] ?? 'premium vs fast' },
    { a: 'veo-3-1', b: 'wan-2-6', micro: quickCompareMicroLabels[4] ?? 'ads vs budget' },
    { a: 'kling-3-standard', b: 'wan-2-6', micro: quickCompareMicroLabels[5] ?? 'control vs speed' },
  ].filter((shortcut) => cardBySlug.has(shortcut.a) && cardBySlug.has(shortcut.b));

  const outcomeCopy = listingCopy.chooseOutcome?.tiles ?? [];
  const outcomeTiles =
    scope === 'video'
      ? [
          {
            title: outcomeCopy[0]?.title ?? 'Text-to-video models',
            description: outcomeCopy[0]?.description ?? 'Shortlist models that support prompt-only generation.',
            engines: ['sora-2', 'sora-2-pro', 'veo-3-1', 'kling-3-standard', 'kling-3-pro', 'seedance-1-5-pro'],
            icon: Film,
          },
          {
            title: outcomeCopy[1]?.title ?? 'Image-to-video models',
            description: outcomeCopy[1]?.description ?? 'Check which models support references and image-led workflows.',
            engines: ['veo-3-1', 'veo-3-1-fast', 'pika-text-to-video', 'wan-2-6', 'ltx-2-3-pro'],
            icon: Clapperboard,
          },
          {
            title: outcomeCopy[2]?.title ?? 'Video-to-video and extension support',
            description: outcomeCopy[2]?.description ?? 'Identify models that support continuation or edit-style workflows.',
            engines: ['wan-2-6', 'kling-3-standard', 'kling-3-pro', 'veo-3-1-first-last'],
            icon: Timer,
          },
          {
            title: outcomeCopy[3]?.title ?? 'Limits and formats',
            description: outcomeCopy[3]?.description ?? 'Duration, max resolution, audio, and format constraints by model.',
            engines: ['sora-2', 'veo-3-1', 'kling-3-standard', 'ltx-2-3-pro', 'minimax-hailuo-02-text'],
            icon: Sparkles,
          },
          {
            title: outcomeCopy[4]?.title ?? 'Pricing per model and mode',
            description: outcomeCopy[4]?.description ?? 'Use per-second pricing and mode support to estimate cost accurately.',
            engines: ['veo-3-1', 'sora-2', 'wan-2-6', 'pika-text-to-video', 'seedance-1-5-pro'],
            icon: Wand2,
          },
          {
            title: outcomeCopy[5]?.title ?? 'Examples and prompt references',
            description: outcomeCopy[5]?.description ?? 'Open real outputs per model before selecting your production preset.',
            engines: ['sora-2', 'veo-3-1', 'wan-2-6', 'kling-3-standard', 'pika-text-to-video'],
            icon: Copy,
          },
        ]
      : scope === 'image'
        ? [
            {
              title: activeLocale === 'fr' ? 'Texte→image' : activeLocale === 'es' ? 'Texto→imagen' : 'Text-to-image',
              description:
                activeLocale === 'fr'
                  ? "Repérez les modèles pour générer des stills sans références d'entrée."
                  : activeLocale === 'es'
                    ? 'Identifica modelos para generar stills sin referencias de entrada.'
                    : 'Shortlist models for still generation without source references.',
              engines: ['nano-banana-2', 'nano-banana-pro', 'nano-banana'],
              icon: Film,
            },
            {
              title: activeLocale === 'fr' ? 'Édition guidée par image' : activeLocale === 'es' ? 'Edición guiada por imagen' : 'Image-guided editing',
              description:
                activeLocale === 'fr'
                  ? "Vérifiez quels modèles gèrent le mieux les références et les edits multi-image."
                  : activeLocale === 'es'
                    ? 'Comprueba qué modelos manejan mejor referencias y edits multiimagen.'
                    : 'Check which models best support references and multi-image edits.',
              engines: ['nano-banana-2', 'nano-banana-pro', 'nano-banana'],
              icon: Clapperboard,
            },
            {
              title: activeLocale === 'fr' ? 'Ratios et formats de sortie' : activeLocale === 'es' ? 'Ratios y formatos de salida' : 'Aspect ratios and output formats',
              description:
                activeLocale === 'fr'
                  ? 'Passez en revue les ratios larges, extrêmes et les formats de fichier disponibles.'
                  : activeLocale === 'es'
                    ? 'Revisa ratios amplios, extremos y formatos de archivo disponibles.'
                    : 'Review wide and extreme aspect ratios plus available file formats.',
              engines: ['nano-banana-2', 'nano-banana-pro'],
              icon: Sparkles,
            },
            {
              title: activeLocale === 'fr' ? 'Limites de références' : activeLocale === 'es' ? 'Límites de referencias' : 'Reference limits',
              description:
                activeLocale === 'fr'
                  ? 'Vérifiez combien d’images de référence chaque modèle accepte en edit.'
                  : activeLocale === 'es'
                    ? 'Comprueba cuántas imágenes de referencia acepta cada modelo en edit.'
                    : 'Check how many reference images each model accepts for edit runs.',
              engines: ['nano-banana-2', 'nano-banana-pro', 'nano-banana'],
              icon: Timer,
            },
            {
              title: activeLocale === 'fr' ? 'Prix par image' : activeLocale === 'es' ? 'Precio por imagen' : 'Per-image pricing',
              description:
                activeLocale === 'fr'
                  ? 'Comparez brouillons, finals et coûts annexes comme le grounding web.'
                  : activeLocale === 'es'
                    ? 'Compara drafts, finales y costes extra como grounding web.'
                    : 'Compare draft, final, and add-on costs such as web grounding.',
              engines: ['nano-banana-2', 'nano-banana-pro', 'nano-banana'],
              icon: Wand2,
            },
            {
              title: activeLocale === 'fr' ? 'Pages modèle et guidance' : activeLocale === 'es' ? 'Páginas de modelo y guidance' : 'Model pages and guidance',
              description:
                activeLocale === 'fr'
                  ? 'Ouvrez les fiches modèle pour les prompts, tips et contraintes détaillées.'
                  : activeLocale === 'es'
                    ? 'Abre las fichas de modelo para prompts, tips y restricciones detalladas.'
                    : 'Open model profiles for prompts, tips, and detailed constraints.',
              engines: ['nano-banana-2', 'nano-banana-pro', 'nano-banana'],
              icon: Copy,
            },
          ]
        : [
            {
              title: activeLocale === 'fr' ? 'Modèles vidéo' : activeLocale === 'es' ? 'Modelos de video' : 'Video models',
              description:
                activeLocale === 'fr'
                  ? 'Passez aux moteurs vidéo pour le rendu, le compare hub et les workflows de mouvement.'
                  : activeLocale === 'es'
                    ? 'Pasa a motores de video para render, compare hub y workflows de movimiento.'
                    : 'Jump to the video hub for rendering, compare pages, and motion workflows.',
              engines: ['sora-2', 'veo-3-1', 'kling-3-standard'],
              icon: Film,
            },
            {
              title: activeLocale === 'fr' ? "Modèles d'image" : activeLocale === 'es' ? 'Modelos de imagen' : 'Image models',
              description:
                activeLocale === 'fr'
                  ? "Ouvrez le hub image pour les stills, edits et workflows guidés par références."
                  : activeLocale === 'es'
                    ? 'Abre el hub de imagen para stills, edits y workflows guiados por referencias.'
                    : 'Open the image hub for stills, edits, and reference-led workflows.',
              engines: ['nano-banana-2', 'nano-banana-pro', 'nano-banana'],
              icon: Clapperboard,
            },
            {
              title: activeLocale === 'fr' ? 'Limites et formats' : activeLocale === 'es' ? 'Límites y formatos' : 'Limits and formats',
              description:
                activeLocale === 'fr'
                  ? 'Contrôlez durée, résolution, audio, références et formats de sortie par modèle.'
                  : activeLocale === 'es'
                    ? 'Controla duración, resolución, audio, referencias y formatos de salida por modelo.'
                    : 'Check duration, resolution, audio, references, and output format constraints by model.',
              engines: ['sora-2', 'veo-3-1', 'nano-banana-2'],
              icon: Sparkles,
            },
            {
              title: activeLocale === 'fr' ? 'Prix par workflow' : activeLocale === 'es' ? 'Precio por workflow' : 'Pricing by workflow',
              description:
                activeLocale === 'fr'
                  ? 'Séparez les moteurs facturés à la seconde des modèles facturés à l’image.'
                  : activeLocale === 'es'
                    ? 'Separa motores cobrados por segundo de modelos cobrados por imagen.'
                    : 'Separate per-second video engines from per-image still models.',
              engines: ['sora-2', 'wan-2-6', 'nano-banana-2'],
              icon: Wand2,
            },
            {
              title: activeLocale === 'fr' ? 'Références et prompts' : activeLocale === 'es' ? 'Referencias y prompts' : 'References and prompts',
              description:
                activeLocale === 'fr'
                  ? 'Ouvrez les fiches modèle pour les prompts, limitations et conseils opérationnels.'
                  : activeLocale === 'es'
                    ? 'Abre las fichas de modelo para prompts, limitaciones y consejos operativos.'
                    : 'Open model profiles for prompts, limitations, and operational guidance.',
              engines: ['sora-2', 'veo-3-1', 'nano-banana-2'],
              icon: Copy,
            },
          ];

  const fallbackFaqItemsByScope = {
    all: [
      {
        question: 'Should I start from the video hub or the image hub?',
        answer:
          'Use the video hub for motion workflows and compare pages. Use the image hub for still generation, edits, reference limits, and per-image pricing.',
      },
      {
        question: 'Are all models in this catalog video models?',
        answer:
          'No. The catalog now includes both video and image models, and future media categories can be separated through dedicated hubs.',
      },
      {
        question: 'How should I interpret pricing on this page?',
        answer:
          'Video models are generally priced per second, while still-image models are priced per image or output size. Open the model page for the exact billing pattern.',
      },
      {
        question: 'Where should I compare video engines side by side?',
        answer:
          'Use the video compare hub for side-by-side comparisons. Image models currently use the dedicated model pages rather than the compare hub.',
      },
    ],
    video: [
      {
        question: 'Which models support image-to-video?',
        answer:
          'Use the model cards and filters to see which engines support image-to-video inputs and reference-based modes.',
      },
      {
        question: 'Which models support video-to-video workflows?',
        answer:
          'Video-to-video and continuation support differ by model and mode. Check each card for the exact capabilities before running production jobs.',
      },
      {
        question: 'What are the typical limits by model?',
        answer:
          'Duration, resolution, audio support, and available formats vary by provider and mode. The catalog shows the latest known limits per model.',
      },
      {
        question: 'How is pricing calculated per model and mode?',
        answer:
          'Pricing is based on model, mode, duration, resolution, and optional add-ons. Use model-level pricing signals as planning inputs before launch.',
      },
      {
        question: 'Where can I see real outputs per model?',
        answer:
          'Use the examples gallery to inspect outputs, prompts, and settings tied to each model before choosing presets for production.',
      },
      {
        question: 'How often are limits and prices updated?',
        answer:
          'Limits and pricing references are refreshed as providers update their capabilities and as new model versions are validated in production.',
      },
    ],
    image: [
      {
        question: 'Which image models support editing existing references?',
        answer:
          'Use the model cards and detail pages to check which still-image models support edit workflows, how many references they accept, and what output controls they expose.',
      },
      {
        question: 'How should I compare per-image pricing?',
        answer:
          'Compare resolution tiers, batch size limits, and optional add-ons such as web grounding or output format controls on each model page.',
      },
      {
        question: 'What limits matter most for still-image models?',
        answer:
          'The main constraints are reference count, output count per request, supported resolutions, aspect ratios, and optional advanced controls.',
      },
      {
        question: 'Why is there no image compare hub yet?',
        answer:
          'Image models currently use dedicated detail pages rather than a side-by-side compare hub. The model pages carry the most accurate workflow and pricing context.',
      },
    ],
  } as const;
  const faqItems =
    scope === 'all' && listingCopy.reliability?.faq?.length && listingCopy.reliability.faq.every((item) => item.question && item.answer)
      ? listingCopy.reliability.faq
      : fallbackFaqItemsByScope[scope];

  const fallbackReliabilityItemsByScope = {
    all: [
      { title: 'Media type', body: 'Separate video engines from still-image models before evaluating specs or cost.' },
      { title: 'Limits and formats', body: 'Check duration, resolution, references, audio, and output format constraints.' },
      { title: 'Pricing model', body: 'Review whether pricing is per second, per image, by resolution, or add-on driven.' },
    ],
    video: [
      { title: 'Input type support', body: 'See text-to-video, image-to-video, and edit capabilities by model.' },
      { title: 'Limits and formats', body: 'Check max duration, resolution, audio, and format constraints.' },
      { title: 'Pricing signals', body: 'Review model-level price ranges before running full batches.' },
    ],
    image: [
      { title: 'Create vs edit support', body: 'Check which models support pure prompt generation versus reference-led edit workflows.' },
      { title: 'Reference and output limits', body: 'Verify max references, outputs per request, resolution tiers, and output controls.' },
      { title: 'Per-image pricing', body: 'Review price per image, resolution multipliers, and optional request-level add-ons.' },
    ],
  } as const;
  const reliabilityItems =
    scope === 'all' && listingCopy.reliability?.items && listingCopy.reliability.items.length === 3
      ? listingCopy.reliability.items
      : fallbackReliabilityItemsByScope[scope];

  const ctaPills = scope === 'all' ? listingCopy.cta?.pills ?? scopeDefaults.ctaPills : scopeDefaults.ctaPills;
  const galleryVisibleFilters: Array<'sort' | 'mode' | 'format' | 'duration' | 'price' | 'age'> =
    scope === 'video' ? ['sort', 'mode', 'format', 'duration', 'price', 'age'] : ['sort', 'format', 'price', 'age'];

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: modelCards.map((card, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: card.label,
      url: `${SITE_BASE_URL}${modelsBasePath}/${card.id}`,
    })),
  };

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  return (
    <main className="container-page max-w-6xl section">
      <div className="stack-gap-lg">
        <nav
          aria-label={activeLocale === 'fr' ? 'Vues du catalogue modèles' : activeLocale === 'es' ? 'Vistas del catálogo de modelos' : 'Model catalog views'}
          className="flex flex-wrap justify-center gap-2"
        >
          {scopeTabs.map((tab) => (
            <Link
              key={tab.id}
              href={tab.href}
              className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-micro transition ${
                tab.active
                  ? 'border-text-primary bg-text-primary text-bg'
                  : 'border-hairline bg-surface text-text-secondary hover:border-text-muted hover:text-text-primary'
              }`}
              aria-current={tab.active ? 'page' : undefined}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
        <header className="stack-gap-sm -mt-2 items-center text-center sm:-mt-4">
          <h1 className="text-3xl font-semibold text-text-primary sm:text-5xl">{heroTitle}</h1>
          <p className="sm:max-w-[62ch] text-base leading-relaxed text-text-secondary">{heroSubhead}</p>
          <ul className="grid gap-2 text-sm text-text-secondary sm:max-w-[62ch]">
            {heroBullets.map((bullet) => (
              <li key={bullet} className="flex items-center justify-center gap-2 text-center">
                <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-text-muted" aria-hidden="true" />
                <span className="text-center">{bullet}</span>
              </li>
            ))}
          </ul>
        </header>

        <section id="models-grid" className="stack-gap-md scroll-mt-24">
          <h2 className="sr-only">
            {scope === 'all'
              ? listingCopy.grid?.srTitle ?? scopeDefaults.gridSrTitle
              : scopeDefaults.gridSrTitle}
          </h2>
          <ModelsGallery
            cards={modelCards}
            ctaLabel={cardCtaLabel}
            copy={content.gallery}
            visibleFilters={galleryVisibleFilters}
            allowCompare={scope === 'video'}
          />
        </section>
        <p className="text-sm text-text-secondary text-center">
          {scope === 'all'
            ? listingCopy.grid?.bridgeText ?? scopeDefaults.bridgeText
            : scopeDefaults.bridgeText}
        </p>
        <div className="stack-gap-xl py-4 sm:py-10">
          {showVideoCompare && quickCompareShortcuts.length ? (
            <section className="content-visibility-auto rounded-2xl border border-hairline bg-slate-50/60 p-6 shadow-card dark:bg-white/5 sm:p-8">
              <div className="stack-gap-xs">
                <h2 className="text-2xl font-semibold text-text-primary sm:text-3xl">
                  {listingCopy.quickCompare?.title ?? 'Model checks by common scenarios'}
                </h2>
                <p className="text-sm text-text-secondary">
                  {listingCopy.quickCompare?.subtitle ??
                    'Open useful side-by-side checks when you need a decision view after reviewing model specs.'}
                </p>
              </div>
              <div className="mt-6 flex gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:overflow-visible">
                {quickCompareShortcuts.map((shortcut) => {
                  const leftCard = cardBySlug.get(shortcut.a);
                  const rightCard = cardBySlug.get(shortcut.b);
                  const leftLabel = leftCard?.label ?? shortcut.a;
                  const rightLabel = rightCard?.label ?? shortcut.b;
                  const leftColor = leftCard?.backgroundColor ?? 'var(--text-muted)';
                  const rightColor = rightCard?.backgroundColor ?? 'var(--text-muted)';
                  const sorted = [shortcut.a, shortcut.b].sort();
                  const compareSlug = `${sorted[0]}-vs-${sorted[1]}`;
                  const order = sorted[0] === shortcut.a ? undefined : shortcut.a;
                  const compareHref = order
                    ? { pathname: '/ai-video-engines/[slug]', params: { slug: compareSlug }, query: { order } }
                    : { pathname: '/ai-video-engines/[slug]', params: { slug: compareSlug } };
                  return (
                    <Link
                      key={`${shortcut.a}-${shortcut.b}`}
                      href={compareHref}
                      prefetch={false}
                      className="min-w-[220px] rounded-2xl border border-hairline bg-bg/70 px-4 py-3 text-xs font-semibold text-text-primary shadow-sm transition hover:-translate-y-0.5 hover:border-text-muted"
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: leftColor }} />
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: rightColor }} />
                        </span>
                        <span className="truncate">
                          {leftLabel} vs {rightLabel}
                        </span>
                      </div>
                      <span className="mt-1 block text-[10px] font-medium text-text-muted">{shortcut.micro}</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section className="content-visibility-auto rounded-2xl border border-hairline bg-slate-50/60 p-6 shadow-card dark:bg-white/5 sm:p-8">
            <div className="stack-gap-xs">
              <h2 className="text-2xl font-semibold text-text-primary sm:text-3xl">
                {scope === 'all'
                  ? listingCopy.chooseOutcome?.title ?? scopeDefaults.chooseOutcomeTitle
                  : scopeDefaults.chooseOutcomeTitle}
              </h2>
              <p className="text-sm text-text-secondary">
                {scope === 'all'
                  ? listingCopy.chooseOutcome?.subtitle ?? scopeDefaults.chooseOutcomeSubtitle
                  : scopeDefaults.chooseOutcomeSubtitle}
              </p>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {outcomeTiles.map((tile) => (
                <div
                  key={tile.title}
                  className="rounded-2xl border border-hairline bg-bg/70 p-4 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-text-primary">
                      <UIIcon icon={tile.icon} size={16} />
                    </span>
                    <h3 className="text-sm font-semibold text-text-primary">{tile.title}</h3>
                  </div>
                  <p className="mt-2 text-sm text-text-secondary">{tile.description}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {tile.engines.map((slug) => {
                      const card = cardBySlug.get(slug);
                      if (!card) return null;
                      const color = card.backgroundColor ?? 'var(--text-muted)';
                      return (
                        <Link
                          key={slug}
                          href={{ pathname: '/models/[slug]', params: { slug } }}
                          prefetch={false}
                          className="inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-micro text-text-primary shadow-sm transition hover:-translate-y-0.5 dark:text-white/90"
                          style={{
                            borderColor: color,
                            backgroundColor: `color-mix(in srgb, ${color} 18%, transparent)`,
                          }}
                        >
                          {card.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="content-visibility-auto rounded-2xl border border-hairline bg-slate-50/60 p-6 shadow-card dark:bg-white/5 sm:p-8">
            <div className="stack-gap-xs">
              <h2 className="text-2xl font-semibold text-text-primary sm:text-3xl">
                {scope === 'all'
                  ? listingCopy.reliability?.title ?? scopeDefaults.reliabilityTitle
                  : scopeDefaults.reliabilityTitle}
              </h2>
              <p className="text-sm text-text-secondary">
                {scope === 'all'
                  ? listingCopy.reliability?.subtitle ?? scopeDefaults.reliabilitySubtitle
                  : scopeDefaults.reliabilitySubtitle}
              </p>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {[
                { ...reliabilityItems[0], icon: Wallet },
                { ...reliabilityItems[1], icon: Clapperboard },
                { ...reliabilityItems[2], icon: Copy },
              ].map((item) => (
                <div key={item.title} className="rounded-2xl border border-hairline bg-bg/70 p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-text-primary">
                      <UIIcon icon={item.icon} size={16} />
                    </span>
                    <h3 className="text-sm font-semibold text-text-primary">{item.title}</h3>
                  </div>
                  <p className="mt-2 text-sm text-text-secondary">{item.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 grid gap-3">
              {faqItems.map((item) => (
                <details key={item.question} className="rounded-xl border border-hairline bg-bg/70 p-3">
                  <summary className="cursor-pointer">
                    <h3 className="inline text-sm font-semibold text-text-primary">{item.question}</h3>
                  </summary>
                  <p className="mt-2 text-sm text-text-secondary">{item.answer}</p>
                </details>
              ))}
            </div>
          </section>

          <section className="content-visibility-auto relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white/60 p-6 shadow-card dark:border-white/10 dark:bg-white/5 sm:p-8">
            <span className="pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full bg-purple-400/20 blur-3xl" />
            <span className="pointer-events-none absolute -bottom-16 -right-16 h-64 w-64 rounded-full bg-sky-400/20 blur-3xl" />
            <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="max-w-xl">
                <h2 className="text-2xl font-semibold text-text-primary sm:text-3xl">
                  {scope === 'all' ? listingCopy.cta?.title ?? scopeDefaults.ctaTitle : scopeDefaults.ctaTitle}
                </h2>
                <p className="mt-2 text-sm text-text-secondary">
                  {scope === 'all'
                    ? listingCopy.cta?.subtitle ?? scopeDefaults.ctaSubtitle
                    : scopeDefaults.ctaSubtitle}
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-micro text-text-secondary">
                  {ctaPills.map((pill) => (
                    <span
                      key={pill}
                      className="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface/80 px-3 py-1"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-text-muted" aria-hidden="true" />
                      {pill}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-xs text-text-muted">
                  {scope === 'all'
                    ? listingCopy.cta?.microcopy ?? scopeDefaults.ctaMicrocopy
                    : scopeDefaults.ctaMicrocopy}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href={scope === 'all' ? scopeDefaults.ctaPrimaryHref : scopeDefaults.ctaPrimaryHref}
                  prefetch={false}
                  className="inline-flex items-center rounded-full bg-text-primary px-5 py-3 text-xs font-semibold uppercase tracking-micro text-bg transition hover:opacity-90"
                  aria-label={scope === 'all'
                    ? listingCopy.cta?.primaryLabel ?? scopeDefaults.ctaPrimaryLabel
                    : scopeDefaults.ctaPrimaryLabel}
                >
                  {scope === 'all'
                    ? listingCopy.cta?.primaryLabel ?? scopeDefaults.ctaPrimaryLabel
                    : scopeDefaults.ctaPrimaryLabel}
                </Link>
                <Link
                  href={scope === 'all' ? scopeDefaults.ctaSecondaryHref : scopeDefaults.ctaSecondaryHref}
                  className="inline-flex items-center rounded-full border border-text-primary/40 bg-transparent px-5 py-3 text-xs font-semibold uppercase tracking-micro text-text-primary transition hover:border-text-primary/60"
                  aria-label={scope === 'all'
                    ? listingCopy.cta?.secondaryLabel ?? scopeDefaults.ctaSecondaryLabel
                    : scopeDefaults.ctaSecondaryLabel}
                >
                  {scope === 'all'
                    ? listingCopy.cta?.secondaryLabel ?? scopeDefaults.ctaSecondaryLabel
                    : scopeDefaults.ctaSecondaryLabel}
                </Link>
              </div>
            </div>
          </section>
          <section className="rounded-[16px] border border-hairline bg-surface/80 px-5 py-5 shadow-card">
            <h2 className="text-lg font-semibold text-text-primary">
              {scopeDefaults.nextStepsTitle}
            </h2>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              {scopeDefaults.nextStepLinks.map((item) => (
                <Link key={item.label} href={item.href} className="font-semibold text-brand hover:text-brandHover">
                  {item.label}
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
      <Script id="models-breadcrumb-jsonld" type="application/ld+json">
        {JSON.stringify(breadcrumbJsonLd)}
      </Script>
      <Script id="models-itemlist-jsonld" type="application/ld+json">
        {JSON.stringify(itemListJsonLd)}
      </Script>
      <Script id="models-faq-jsonld" type="application/ld+json">
        {JSON.stringify(faqJsonLd)}
      </Script>
    </main>
  );
}
