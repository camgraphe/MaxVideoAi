import type { AppLocale } from '@/i18n/locales';
import { buildSlugMap } from '@/lib/i18nSlugs';
import type { ModelCatalogScope } from '@/lib/models/catalog';

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
      heroSubhead: "Parcourez les modèles vidéo et image dans un même catalogue, puis basculez vers l’espace dédié selon votre besoin.",
      heroBullets: [
        'Ouvrez chaque modèle pour ses specs, prix et conseils de workflow.',
        'Parcourez les espaces vidéo et image pour trouver rapidement les modèles les plus pertinents.',
      ],
      gridSrTitle: 'Modèles IA vidéo et image avec specs, limites et prix sur MaxVideoAI',
      bridgeText: "Consultez les fiches modèles pour valider les capacités, puis ouvrez les espaces vidéo ou image pour affiner votre sélection.",
      chooseOutcomeTitle: 'Choisir d’abord une famille de modèles',
      chooseOutcomeSubtitle: "Commencez par le média à générer, puis affinez par limites et prix.",
      reliabilityTitle: 'Contrôles utiles avant lancement',
      reliabilitySubtitle: "Validez le type de média, les contraintes de sortie et la facturation avant de choisir un workflow.",
      ctaTitle: 'Commencez par le bon espace média',
      ctaSubtitle: "Ouvrez l’espace vidéo ou image pour accéder à des filtres, des contenus et des étapes adaptés à votre workflow.",
      ctaPills: ['Modèles vidéo', "Modèles d'image", 'Tarifs live'],
      ctaMicrocopy: 'Navigation par catégorie • Tarifs live • Contraintes par modèle',
      ctaPrimaryLabel: 'Voir les modèles vidéo',
      ctaPrimaryHref: '/models/video',
      ctaSecondaryLabel: "Voir les modèles d'image",
      ctaSecondaryHref: '/models/image',
      nextStepsTitle: 'Étapes suivantes',
      nextStepLinks: [
        { label: 'Parcourir les modèles vidéo', href: '/models/video' },
        { label: 'Parcourir les modèles image', href: '/models/image' },
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
      metaTitle: 'Modelos IA: especificaciones, límites y precios | MaxVideoAI',
      metaDescription:
        'Catálogo de modelos IA de video e imagen con especificaciones, límites y señales de precio. Revisa capacidades antes de generar.',
      heroTitle: 'Modelos IA (especificaciones, límites y precios)',
      heroSubhead: 'Explora modelos de video e imagen en un solo catálogo y luego entra en el espacio específico que necesites.',
      heroBullets: [
        'Abre cualquier modelo para ver especificaciones, precios y guía de flujo de trabajo.',
        'Usa los espacios de video e imagen para identificar la mejor selección más rápido.',
      ],
      gridSrTitle: 'Modelos IA de video e imagen con especificaciones, límites y precios en MaxVideoAI',
      bridgeText: 'Usa las fichas de modelo para validar capacidades y luego entra en el espacio de video o imagen para afinar la selección.',
      chooseOutcomeTitle: 'Elige primero una familia de modelos',
      chooseOutcomeSubtitle: 'Empieza por el medio que quieres generar y luego filtra por límites y precio.',
      reliabilityTitle: 'Comprobaciones útiles antes de lanzar',
      reliabilitySubtitle: 'Valida encaje de capacidades, restricciones de salida y exposición de precio antes de fijar el flujo de trabajo.',
      ctaTitle: 'Empieza por el espacio de media correcto',
      ctaSubtitle: 'Abre el espacio de video o imagen cuando quieras filtros, textos y siguientes pasos alineados al flujo de trabajo.',
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
        { label: 'Comparar modelos de video', href: '/ai-video-engines' },
      ],
    },
    video: {
      metaTitle: 'Modelos de video IA: especificaciones, límites y precios | MaxVideoAI',
      metaDescription:
        'Compara modelos de video IA por entradas soportadas, duración máxima, resolución y precio antes de renderizar.',
      heroTitle: 'Modelos de video IA (especificaciones, límites y precios)',
      heroSubhead: 'Revisa restricciones de video, compara flujos de trabajo y elige el modelo correcto antes de renderizar.',
      heroBullets: [
        'Comprueba soporte texto→video, imagen→video, extensión y edición por modelo.',
        'Usa el comparativo de video solo cuando la selección ya esté clara.',
      ],
      gridSrTitle: 'Modelos de video IA con especificaciones, límites y precios en MaxVideoAI',
      bridgeText: 'Usa las fichas de modelo para revisar capacidades de video, límites y precios antes de elegir modelo.',
      chooseOutcomeTitle: 'Elige por flujo de trabajo de video y restricciones',
      chooseOutcomeSubtitle: 'Empieza por entradas de video soportadas, duración máxima y precio.',
      reliabilityTitle: 'Comprobaciones que importan en video',
      reliabilitySubtitle: 'Valida encaje del flujo de trabajo, restricciones de salida y señales de precio antes de renderizar.',
      ctaTitle: 'Empieza a generar video en segundos',
      ctaSubtitle: 'Elige un modelo de video arriba y luego genera o compara modelos preseleccionados.',
      ctaPills: ['Precios de video', 'Límites runtime', 'Referencias de prompt'],
      ctaMicrocopy: 'Especificaciones de video • Precios en vivo • Referencias de salidas reales',
      ctaPrimaryLabel: 'Abrir espacio de trabajo de video',
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
      metaTitle: 'Modelos de imagen IA: especificaciones, límites y precios | MaxVideoAI',
      metaDescription:
        'Revisa modelos de imagen IA por modo de generación, referencias, resolución y precio por imagen antes de crear imágenes fijas.',
      heroTitle: 'Modelos de imagen IA (especificaciones, límites y precios)',
      heroSubhead: 'Revisa capacidades de imagen fija, restricciones de edición y precio por imagen antes de generar.',
      heroBullets: [
        'Comprueba create/edit, límites de referencias y opciones de resolución.',
        'Usa Image Lab cuando estés listo para generar imágenes fijas o hacer ediciones guiadas.',
      ],
      gridSrTitle: 'Modelos de imagen IA con especificaciones, límites y precios en MaxVideoAI',
      bridgeText: 'Usa las tarjetas de modelo para revisar flujos de imagen, límites de edición y precio antes de elegir.',
      chooseOutcomeTitle: 'Elige por flujo de trabajo de imagen fija',
      chooseOutcomeSubtitle: 'Empieza por create vs edit, necesidades de referencia, tamaño de salida y precio por imagen.',
      reliabilityTitle: 'Comprobaciones que importan en imagen',
      reliabilitySubtitle: 'Valida límites de referencias, controles de salida y precios antes de lanzar runs de imagen.',
      ctaTitle: 'Empieza a generar imágenes en segundos',
      ctaSubtitle: 'Elige un modelo de imagen arriba y luego abre Image Lab para crear borradores, versiones finales o ediciones.',
      ctaPills: ['Precio por imagen', 'Límites de referencias', 'Opciones de resolución'],
      ctaMicrocopy: 'Especificaciones de imagen • Precios en vivo • Flujos guiados por referencias',
      ctaPrimaryLabel: 'Abrir Image Lab',
      ctaPrimaryHref: '/app/image',
      ctaSecondaryLabel: 'Ver todos los modelos',
      ctaSecondaryHref: '/models',
      nextStepsTitle: 'Siguientes pasos',
      nextStepLinks: [
        { label: 'Abrir el espacio de imagen', href: '/app/image' },
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
