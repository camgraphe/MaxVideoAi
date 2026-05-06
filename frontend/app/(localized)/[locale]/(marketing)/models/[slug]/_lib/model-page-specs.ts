import {
  Box,
  ArrowLeftRight,
  Camera,
  Clapperboard,
  Clock,
  Crop,
  Film,
  Gamepad2,
  Image as ImageIcon,
  Layers,
  LayoutTemplate,
  Megaphone,
  Monitor,
  Mic,
  Music,
  PenTool,
  Repeat,
  Repeat2,
  Scissors,
  Smartphone,
  Sparkles,
  Type,
  User,
  Users,
  Wind,
  Coins,
  Volume2,
  Wand2,
  Zap,
} from 'lucide-react';
import type { SpecDetailsSection } from '@/components/marketing/SpecDetailsGrid.client';
import type { FalEngineEntry } from '@/config/falEngines';
import type { AppLocale } from '@/i18n/locales';
import { getLocalizedHeroChipLabels } from '@/lib/ltx-localization';
import { applyDisplayedPriceMarginCents } from '@/lib/pricing-display';
import type { EngineCaps, Mode } from '@/types/engines';

export type SpecSection = SpecDetailsSection;
export type LocalizedFaqEntry = { question: string; answer: string };
export type QuickStartBlock = { title: string; subtitle?: string | null; steps: string[] };
export type HeroSpecIconKey = 'resolution' | 'duration' | 'textToVideo' | 'imageToVideo' | 'aspectRatio' | 'audio';
export type HeroSpecChip = { label: string; icon?: HeroSpecIconKey | null };
export type BestUseCaseIconKey =
  | 'ads'
  | 'ugc'
  | 'product'
  | 'storyboard'
  | 'type'
  | 'cinematic'
  | 'camera'
  | 'layers'
  | 'zap'
  | 'audio'
  | 'sparkles'
  | 'smartphone'
  | 'wand2'
  | 'arrowLeftRight'
  | 'layout'
  | 'pen'
  | 'repeat'
  | 'gamepad2'
  | 'image'
  | 'users'
  | 'repeat2'
  | 'volume2'
  | 'music'
  | 'mic'
  | 'scissors'
  | 'wind'
  | 'coins';
export type BestUseCaseItem = { title: string; icon: BestUseCaseIconKey; chips?: string[]; href?: string | null };
export type RelatedItem = {
  brand: string;
  title: string;
  description: string;
  modelSlug?: string | null;
  ctaLabel?: string | null;
  href?: string | null;
};
export type KeySpecKey =
  | 'pricePerImage'
  | 'pricePerSecond'
  | 'releaseDate'
  | 'textToImage'
  | 'imageToImage'
  | 'textToVideo'
  | 'imageToVideo'
  | 'videoToVideo'
  | 'firstLastFrame'
  | 'referenceImageStyle'
  | 'referenceVideo'
  | 'maxResolution'
  | 'maxDuration'
  | 'aspectRatios'
  | 'fpsOptions'
  | 'outputFormats'
  | 'audioOutput'
  | 'nativeAudioGeneration'
  | 'lipSync'
  | 'cameraMotionControls'
  | 'watermark';
export type KeySpecRow = { id: string; key: KeySpecKey; label: string; value: string; valueLines?: string[] };
export type KeySpecValues = Record<KeySpecKey, string>;

export type PromptingTabId = 'quick' | 'structured' | 'pro' | 'storyboard';

export type PromptingTab = {
  id: PromptingTabId;
  label: string;
  title: string;
  description?: string;
  copy: string;
};

export type SoraCopy = {
  heroEyebrow: string | null;
  heroTitle: string | null;
  heroSubtitle: string | null;
  heroSupportLine: string | null;
  heroBadge: string | null;
  heroSpecChips: HeroSpecChip[];
  heroTrustLine: string | null;
  heroDesc1: string | null;
  heroDesc2: string | null;
  primaryCta: string | null;
  primaryCtaHref: string | null;
  secondaryCta: string | null;
  secondaryCtaHref: string | null;
  whyTitle: string | null;
  heroHighlights: string[];
  bestUseCasesTitle: string | null;
  bestUseCaseItems: BestUseCaseItem[];
  bestUseCases: string[];
  whatTitle: string | null;
  whatIntro1: string | null;
  whatIntro2: string | null;
  whatFlowTitle: string | null;
  whatFlowSteps: string[];
  quickStartTitle: string | null;
  quickStartBlocks: QuickStartBlock[];
  howToLatamTitle: string | null;
  howToLatamSteps: string[];
  specTitle: string | null;
  specNote: string | null;
  specSections: SpecSection[];
  specValueProp: string | null;
  quickPricingTitle: string | null;
  quickPricingItems: string[];
  hideQuickPricing: boolean;
  showPricePerSecondInSpecs: boolean;
  hidePricingSection: boolean;
  microCta: string | null;
  galleryTitle: string | null;
  galleryIntro: string | null;
  gallerySceneCta: string | null;
  galleryAllCta: string | null;
  recreateLabel: string | null;
  promptingTitle?: string | null;
  promptingIntro?: string | null;
  promptingTip?: string | null;
  promptingGuideLabel?: string | null;
  promptingGuideUrl?: string | null;
  promptingTabs: PromptingTab[];
  imageTitle: string | null;
  imageIntro: string | null;
  imageFlow: string[];
  imageWhy: string[];
  multishotTitle: string | null;
  multishotIntro1: string | null;
  multishotIntro2: string | null;
  multishotTips: string[];
  demoTitle: string | null;
  demoPromptLabel: string | null;
  demoPrompt: string[];
  demoNotes: string[];
  tipsTitle: string | null;
  tipsIntro: string | null;
  strengths: string[];
  boundaries: string[];
  troubleshootingTitle: string | null;
  troubleshootingItems: string[];
  tipsFooter: string | null;
  safetyTitle: string | null;
  safetyRules: string[];
  safetyInterpretation: string[];
  safetyNote: string | null;
  comparisonTitle: string | null;
  comparisonPoints: string[];
  comparisonCta: string | null;
  relatedCtaSora2: string | null;
  relatedCtaSora2Pro: string | null;
  relatedTitle: string | null;
  relatedSubtitle: string | null;
  relatedItems: RelatedItem[];
  finalPara1: string | null;
  finalPara2: string | null;
  finalButton: string | null;
  faqTitle: string | null;
  faqs: LocalizedFaqEntry[];
  promptingGlobalPrinciples: string[];
  promptingEngineWhy: string[];
  promptingTabNotes: {
    quick?: string;
    structured?: string;
    pro?: string;
    storyboard?: string;
  };
};

export const HERO_SPEC_ICON_MAP = {
  resolution: Monitor,
  duration: Clock,
  textToVideo: Type,
  imageToVideo: ImageIcon,
  aspectRatio: Crop,
  audio: Volume2,
} as const;
export const BEST_USE_CASE_ICON_MAP = {
  ads: Megaphone,
  ugc: User,
  product: Box,
  storyboard: Clapperboard,
  type: Type,
  cinematic: Film,
  camera: Camera,
  layers: Layers,
  zap: Zap,
  audio: Volume2,
  sparkles: Sparkles,
  smartphone: Smartphone,
  wand2: Wand2,
  arrowLeftRight: ArrowLeftRight,
  layout: LayoutTemplate,
  pen: PenTool,
  repeat: Repeat,
  gamepad2: Gamepad2,
  image: ImageIcon,
  users: Users,
  repeat2: Repeat2,
  volume2: Volume2,
  music: Music,
  mic: Mic,
  scissors: Scissors,
  wind: Wind,
  coins: Coins,
} as const;
// Keep full-bleed sections out of content-visibility containers, otherwise
// paint containment clips 100vw/negative-margin visuals on the sides.
export const FULL_BLEED_SECTION =
  "relative isolate before:absolute before:inset-y-0 before:left-1/2 before:right-1/2 before:-ml-[50vw] before:-mr-[50vw] before:content-[''] before:-z-[2] after:absolute after:inset-y-0 after:left-1/2 after:right-1/2 after:-ml-[50vw] after:-mr-[50vw] after:content-[''] after:-z-[1]";
export const SECTION_BG_A =
  'before:bg-surface-2/70 dark:before:bg-surface-2/30 before:border-t before:border-hairline/80 dark:before:border-transparent before:shadow-[inset_0_16px_24px_-18px_rgba(15,23,42,0.12)] dark:before:shadow-[inset_0_16px_24px_-18px_rgba(0,0,0,0.30)] after:opacity-0 dark:after:opacity-100 dark:after:bg-[radial-gradient(900px_680px_at_5%_-10%,_rgba(91,124,250,0.06),_transparent_70%),_radial-gradient(720px_520px_at_95%_0%,_rgba(34,197,94,0.05),_transparent_70%),_radial-gradient(900px_700px_at_55%_85%,_rgba(236,72,153,0.05),_transparent_75%),_radial-gradient(720px_520px_at_40%_35%,_rgba(250,204,21,0.045),_transparent_75%),_radial-gradient(800px_600px_at_85%_60%,_rgba(59,130,246,0.045),_transparent_75%)] dark:after:mix-blend-screen';
export const SECTION_BG_B =
  'before:bg-surface-3/70 dark:before:bg-surface-3/30 before:border-t before:border-hairline/80 dark:before:border-transparent before:shadow-[inset_0_16px_24px_-18px_rgba(15,23,42,0.12)] dark:before:shadow-[inset_0_16px_24px_-18px_rgba(0,0,0,0.30)] after:opacity-0 dark:after:opacity-100 dark:after:bg-[radial-gradient(900px_680px_at_5%_-10%,_rgba(91,124,250,0.06),_transparent_70%),_radial-gradient(720px_520px_at_95%_0%,_rgba(34,197,94,0.05),_transparent_70%),_radial-gradient(900px_700px_at_55%_85%,_rgba(236,72,153,0.05),_transparent_75%),_radial-gradient(720px_520px_at_40%_35%,_rgba(250,204,21,0.045),_transparent_75%),_radial-gradient(800px_600px_at_85%_60%,_rgba(59,130,246,0.045),_transparent_75%)] dark:after:mix-blend-screen';
export const HERO_BG =
  'before:bg-surface-2/70 dark:before:bg-surface-2/30 after:opacity-0 dark:after:opacity-100 dark:after:bg-[radial-gradient(900px_680px_at_5%_-10%,_rgba(91,124,250,0.06),_transparent_70%),_radial-gradient(720px_520px_at_95%_0%,_rgba(34,197,94,0.05),_transparent_70%),_radial-gradient(900px_700px_at_55%_85%,_rgba(236,72,153,0.05),_transparent_75%),_radial-gradient(720px_520px_at_40%_35%,_rgba(250,204,21,0.045),_transparent_75%),_radial-gradient(800px_600px_at_85%_60%,_rgba(59,130,246,0.045),_transparent_75%)] dark:after:mix-blend-screen';
export const SECTION_PAD = 'px-6 py-9 sm:px-8 sm:py-12';
export const SECTION_SCROLL_MARGIN = 'scroll-mt-[calc(var(--header-height)+64px)]';
export const FULL_BLEED_CONTENT = 'relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-[100vw]';
export const HERO_AUTOPLAY_DELAY_MS = 1800;
export const GENERIC_TRUST_LINE = 'Pay-as-you-go · Price shown before you generate';
export const HERO_LIMITS_LINES: Record<AppLocale, string> = {
  en: 'Model limits: duration, resolution, aspect ratio, audio, and input modes vary by engine.',
  fr: 'Limites du modèle : durée, résolution, ratio, audio et modes d’entrée varient selon le modèle.',
  es: 'Límites del modelo: duración, resolución, relación de aspecto, audio y modos de entrada varían según el motor.',
};
export const BEST_USE_CASE_ICON_KEYS: BestUseCaseIconKey[] = [
  'ads',
  'ugc',
  'product',
  'storyboard',
  'type',
  'cinematic',
  'camera',
  'layers',
  'zap',
  'audio',
  'sparkles',
  'smartphone',
  'wand2',
  'arrowLeftRight',
  'layout',
  'pen',
  'repeat',
  'gamepad2',
  'image',
  'users',
  'repeat2',
  'volume2',
  'music',
  'mic',
  'scissors',
  'wind',
  'coins',
];
export const BEST_USE_CASE_ICON_RULES: Array<{ icon: BestUseCaseIconKey; test: RegExp }> = [
  { icon: 'ads', test: /\b(ad|ads|advert|advertising|marketing|campaign|promo|commercial)s?\b/i },
  { icon: 'ugc', test: /\bugc\b|user[-\s]?generated|creator|influencer|lifestyle|social\b/i },
  { icon: 'product', test: /\bproduct|e-?commerce|shop|retail|catalog|packaging|brand\b/i },
  { icon: 'storyboard', test: /\bstoryboard|concept|previs|animatic|pitch|shot list|story\b/i },
  { icon: 'type', test: /\btypography|type|poster|copy|text\b/i },
  { icon: 'layers', test: /\bcontinuity|multi[-\s]?beat|multi[-\s]?scene|sequenc|chain\b/i },
  { icon: 'cinematic', test: /\bcinematic|film|director|lens|camera\b/i },
  { icon: 'camera', test: /\bimage-to-video|image to video|remaster|reference still|lighting\b/i },
  { icon: 'zap', test: /\bfast|rapid|quick|draft|iterate|iteration\b/i },
  { icon: 'audio', test: /\baudio|sound|music|voice|sfx\b/i },
  { icon: 'sparkles', test: /\bhero|premium|polished|showcase|sparkle|sparkles\b/i },
  { icon: 'smartphone', test: /\bsocial|mobile|phone|vertical|reel|tiktok|shorts\b/i },
  { icon: 'wand2', test: /\bstyle|stylize|variation|variants|explore|exploration|look\b/i },
  { icon: 'arrowLeftRight', test: /\bbefore\/after|before and after|transform|transition\b/i },
  { icon: 'layout', test: /\bui|layout|interface|screen|wireframe\b/i },
  { icon: 'pen', test: /\bsketch|draw|draft|illustration\b/i },
  { icon: 'repeat', test: /\bloop|repeat|seamless\b/i },
  { icon: 'gamepad2', test: /\bgaming|game|fandom|pop\b/i },
  { icon: 'image', test: /\bkeyframe|still|image\b/i },
  { icon: 'users', test: /\bsubject consistency|reference video|characters|people\b/i },
  { icon: 'repeat2', test: /\bmatch cut|transition|bridge\b/i },
  { icon: 'volume2', test: /\bsound bed|audio url|soundtrack\b/i },
  { icon: 'music', test: /\bmusic|track|beat|score\b/i },
  { icon: 'mic', test: /\bvoiceover|voice over|dialogue|vo\b/i },
  { icon: 'scissors', test: /\bcutdown|edit|trim|cut\b/i },
  { icon: 'wind', test: /\bwind|cloth|particles|physics|inertia\b/i },
  { icon: 'coins', test: /\bbudget|cheap|low cost|volume\b/i },
];
export const DEFAULT_CHIPS_BY_ICON: Record<BestUseCaseIconKey, string[]> = {
  ads: ['Fast iteration', 'Audio'],
  ugc: ['Vertical', 'Natural motion'],
  product: ['Clean detail', 'Lighting'],
  storyboard: ['Shot list', '4–12s'],
  type: ['Typography', 'Readable'],
  cinematic: ['Camera control', 'Motion'],
  camera: ['Lighting continuity', 'High-res'],
  layers: ['Continuity', 'Multi-beat'],
  zap: ['Fast iteration', 'Low latency'],
  audio: ['Sound cues', 'Rhythm'],
  sparkles: ['Hero shot', 'Polished'],
  smartphone: ['Vertical', 'Variants'],
  wand2: ['Style', 'Variants'],
  arrowLeftRight: ['Before/after', 'Transitions'],
  layout: ['UI', 'Layout'],
  pen: ['Sketch', 'Reveal'],
  repeat: ['Loops', 'Motion'],
  gamepad2: ['Gaming', 'Pop'],
  image: ['Keyframe', 'Transition'],
  users: ['Consistency', 'Reference'],
  repeat2: ['Transitions', 'Match cuts'],
  volume2: ['Sound bed', 'Audio'],
  music: ['Timing', 'Beats'],
  mic: ['Voice', 'Dialogue'],
  scissors: ['Cutdowns', 'Edits'],
  wind: ['Physics', 'Motion'],
  coins: ['Budget', 'Variants'],
};

export const SECTION_LABELS: Record<
  AppLocale,
  {
    specs: string;
    examples: string;
    prompting: string;
    tips: string;
    compare: string;
    safety: string;
    faq: string;
  }
> = {
  en: {
    specs: 'Specs',
    examples: 'Examples',
    prompting: 'Prompting',
    tips: 'Tips',
    compare: 'Compare',
    safety: 'Safety',
    faq: 'FAQ',
  },
  fr: {
    specs: 'Spécifications',
    examples: 'Exemples',
    prompting: 'Prompts',
    tips: 'Conseils',
    compare: 'Comparer',
    safety: 'Sécurité',
    faq: 'FAQ',
  },
  es: {
    specs: 'Especificaciones',
    examples: 'Ejemplos',
    prompting: 'Prompts',
    tips: 'Consejos',
    compare: 'Comparar',
    safety: 'Seguridad',
    faq: 'FAQ',
  },
};

export const SPEC_TITLE_BASE: Record<AppLocale, string> = {
  en: 'Specs',
  fr: 'Spécifications',
  es: 'Especificaciones',
};

export const SPECS_DECISION_NOTES: Record<AppLocale, string> = {
  en: 'The limits that shape your renders.',
  fr: 'Les limites qui structurent vos rendus.',
  es: 'Los límites que definen tus renders.',
};

export const SPEC_STATUS_LABELS: Record<AppLocale, { supported: string; notSupported: string; pending: string }> = {
  en: { supported: 'Supported', notSupported: 'Not supported', pending: 'Data pending' },
  fr: { supported: 'Pris en charge', notSupported: 'Non pris en charge', pending: 'Données en attente' },
  es: { supported: 'Soportado', notSupported: 'No soportado', pending: 'Datos pendientes' },
};

export const AUTO_SPEC_LABELS: Record<
  AppLocale,
  {
    inputsTitle: string;
    audioTitle: string;
    textToVideo: string;
    imageToVideo: string;
    videoToVideo: string;
    referenceImageStyle: string;
    referenceVideo: string;
    audioOutput: string;
    nativeAudio: string;
    lipSync: string;
  }
> = {
  en: {
    inputsTitle: 'Inputs & file types',
    audioTitle: 'Audio',
    textToVideo: 'Text → Video',
    imageToVideo: 'Image → Video',
    videoToVideo: 'Video → Video',
    referenceImageStyle: 'Reference image / style',
    referenceVideo: 'Reference video',
    audioOutput: 'Audio output',
    nativeAudio: 'Native audio',
    lipSync: 'Lip sync',
  },
  fr: {
    inputsTitle: 'Entrées & types de fichiers',
    audioTitle: 'Audio',
    textToVideo: 'Texte → Vidéo',
    imageToVideo: 'Image → Vidéo',
    videoToVideo: 'Vidéo → Vidéo',
    referenceImageStyle: 'Image de référence / style',
    referenceVideo: 'Vidéo de référence',
    audioOutput: 'Sortie audio',
    nativeAudio: 'Audio natif',
    lipSync: 'Synchronisation labiale',
  },
  es: {
    inputsTitle: 'Entradas y tipos de archivo',
    audioTitle: 'Audio',
    textToVideo: 'Texto → Video',
    imageToVideo: 'Imagen → Video',
    videoToVideo: 'Video → Video',
    referenceImageStyle: 'Imagen de referencia / estilo',
    referenceVideo: 'Video de referencia',
    audioOutput: 'Salida de audio',
    nativeAudio: 'Audio nativo',
    lipSync: 'Sincronización labial',
  },
};

export const COMPARE_COPY_BY_LOCALE: Record<
  AppLocale,
  {
    title: (model: string) => string;
    introPrefix: (model: string) => string;
    introStrong: (supportsAudio: boolean) => string;
    introSuffix: string;
    subline: string;
    ctaCompare: (model: string, other: string) => string;
    ctaExplore: (other: string) => string;
    cardDescription: (model: string, other: string, supportsAudio: boolean) => string;
  }
> = {
  en: {
    title: (model) => `Compare ${model} vs other AI video models`,
    introPrefix: (model) =>
      `Not sure if ${model} is the best fit for your shot? These side-by-side comparisons break down the tradeoffs — `,
    introStrong: (supportsAudio) =>
      supportsAudio
        ? 'price per second, resolution, audio, speed, and motion style'
        : 'price per second, resolution, speed, and motion style',
    introSuffix: ' — so you can pick the right engine fast.',
    subline: 'Each page includes real outputs and practical best-use cases.',
    ctaCompare: (model, other) => `Compare ${model} vs ${other} →`,
    ctaExplore: (other) => `Explore ${other} →`,
    cardDescription: (model, other, supportsAudio) =>
      supportsAudio
        ? `Compare ${model} vs ${other} on price, resolution, audio, speed, and motion style.`
        : `Compare ${model} vs ${other} on price, resolution, speed, and motion style.`,
  },
  fr: {
    title: (model) => `Comparer ${model} aux autres modèles vidéo IA`,
    introPrefix: (model) =>
      `Vous ne savez pas si ${model} est le meilleur choix pour votre plan ? Ces comparatifs côte à côte détaillent les compromis — `,
    introStrong: (supportsAudio) =>
      supportsAudio
        ? 'prix par seconde, résolution, audio, vitesse et style de mouvement'
        : 'prix par seconde, résolution, vitesse et style de mouvement',
    introSuffix: ' — pour choisir rapidement le bon modèle.',
    subline: 'Chaque page inclut des rendus réels et des cas d’usage concrets.',
    ctaCompare: (model, other) => `Comparer ${model} vs ${other} →`,
    ctaExplore: (other) => `Voir ${other} →`,
    cardDescription: (model, other, supportsAudio) =>
      supportsAudio
        ? `Comparez ${model} vs ${other} sur le prix, la résolution, l’audio, la vitesse et le style de mouvement.`
        : `Comparez ${model} vs ${other} sur le prix, la résolution, la vitesse et le style de mouvement.`,
  },
  es: {
    title: (model) => `Comparar ${model} con otros modelos de video IA`,
    introPrefix: (model) =>
      `¿No estás seguro de si ${model} es la mejor opción para tu toma? Estas comparativas lado a lado muestran los compromisos — `,
    introStrong: (supportsAudio) =>
      supportsAudio
        ? 'precio por segundo, resolución, audio, velocidad y estilo de movimiento'
        : 'precio por segundo, resolución, velocidad y estilo de movimiento',
    introSuffix: ' — para elegir el motor adecuado rápidamente.',
    subline: 'Cada página incluye renders reales y objetivos prácticos.',
    ctaCompare: (model, other) => `Comparar ${model} vs ${other} →`,
    ctaExplore: (other) => `Ver ${other} →`,
    cardDescription: (model, other, supportsAudio) =>
      supportsAudio
        ? `Compara ${model} vs ${other} en precio, resolución, audio, velocidad y estilo de movimiento.`
        : `Compara ${model} vs ${other} en precio, resolución, velocidad y estilo de movimiento.`,
  },
};

export const SPEC_ROW_LABEL_OVERRIDES: Record<
  AppLocale,
  { video: Partial<Record<KeySpecKey, string>>; image: Partial<Record<KeySpecKey, string>> }
> = {
  en: { video: {}, image: {} },
  fr: {
    video: {
      pricePerSecond: 'Prix / seconde',
      textToVideo: 'Texte→Vidéo',
      imageToVideo: 'Image→Vidéo',
      videoToVideo: 'Vidéo→Vidéo',
      firstLastFrame: 'Première / dernière image',
      referenceImageStyle: 'Image de référence / style',
      referenceVideo: 'Vidéo de référence',
      maxResolution: 'Résolution max',
      maxDuration: 'Durée max',
      aspectRatios: 'Formats',
      fpsOptions: 'Options FPS',
      outputFormats: 'Format de sortie',
      audioOutput: 'Sortie audio',
      nativeAudioGeneration: 'Audio natif',
      lipSync: 'Synchronisation labiale',
      cameraMotionControls: 'Contrôle caméra / mouvement',
      watermark: 'Filigrane',
      releaseDate: 'Date de sortie',
    },
    image: {
      pricePerImage: 'Prix / image',
      textToImage: 'Texte→Image',
      imageToImage: 'Image→Image',
      maxResolution: 'Options de résolution',
      aspectRatios: 'Formats',
      outputFormats: 'Format de sortie',
      releaseDate: 'Date de sortie',
    },
  },
  es: {
    video: {
      pricePerSecond: 'Precio / segundo',
      textToVideo: 'Texto→Video',
      imageToVideo: 'Imagen→Video',
      videoToVideo: 'Video→Video',
      firstLastFrame: 'Primer/último fotograma',
      referenceImageStyle: 'Imagen de referencia / estilo',
      referenceVideo: 'Video de referencia',
      maxResolution: 'Resolución máx.',
      maxDuration: 'Duración máx.',
      aspectRatios: 'Formatos',
      fpsOptions: 'Opciones de FPS',
      outputFormats: 'Formato de salida',
      audioOutput: 'Salida de audio',
      nativeAudioGeneration: 'Audio nativo',
      lipSync: 'Sincronización labial',
      cameraMotionControls: 'Control de cámara / movimiento',
      watermark: 'Marca de agua',
      releaseDate: 'Fecha de lanzamiento',
    },
    image: {
      pricePerImage: 'Precio / imagen',
      textToImage: 'Texto→Imagen',
      imageToImage: 'Imagen→Imagen',
      maxResolution: 'Opciones de resolución',
      aspectRatios: 'Formatos',
      outputFormats: 'Formato de salida',
      releaseDate: 'Fecha de lanzamiento',
    },
  },
};

export const PRICE_AUDIO_LABELS: Record<AppLocale, { on: string; off: string }> = {
  en: { on: 'Audio on', off: 'Audio off' },
  fr: { on: 'Audio activé', off: 'Audio coupé' },
  es: { on: 'Audio activado', off: 'Audio desactivado' },
};

export const TIPS_CARD_LABELS: Record<
  AppLocale,
  { strengths: string; boundaries: string }
> = {
  en: { strengths: 'What works best', boundaries: 'Hard limits to keep in mind' },
  fr: { strengths: 'Ce qui marche le mieux', boundaries: 'Limites à garder en tête' },
  es: { strengths: 'Lo que funciona mejor', boundaries: 'Límites a tener en cuenta' },
};
export const VIDEO_SPEC_ROW_DEFS: Array<{ key: KeySpecKey; label: string }> = [
  { key: 'pricePerSecond', label: 'Price / second' },
  { key: 'textToVideo', label: 'Text-to-Video' },
  { key: 'imageToVideo', label: 'Image-to-Video' },
  { key: 'videoToVideo', label: 'Video-to-Video' },
  { key: 'firstLastFrame', label: 'First/Last frame' },
  { key: 'referenceImageStyle', label: 'Reference image / style reference' },
  { key: 'referenceVideo', label: 'Reference video' },
  { key: 'maxResolution', label: 'Max resolution' },
  { key: 'maxDuration', label: 'Max duration' },
  { key: 'aspectRatios', label: 'Aspect ratios' },
  { key: 'fpsOptions', label: 'FPS options' },
  { key: 'outputFormats', label: 'Output format' },
  { key: 'audioOutput', label: 'Audio output' },
  { key: 'nativeAudioGeneration', label: 'Native audio generation' },
  { key: 'lipSync', label: 'Lip sync' },
  { key: 'cameraMotionControls', label: 'Camera / motion controls' },
  { key: 'watermark', label: 'Watermark' },
  { key: 'releaseDate', label: 'Release date' },
];

export const IMAGE_SPEC_ROW_DEFS: Array<{ key: KeySpecKey; label: string }> = [
  { key: 'pricePerImage', label: 'Price / image' },
  { key: 'textToImage', label: 'Text-to-Image' },
  { key: 'imageToImage', label: 'Image-to-Image' },
  { key: 'maxResolution', label: 'Resolution options' },
  { key: 'aspectRatios', label: 'Aspect ratios' },
  { key: 'outputFormats', label: 'Output format' },
  { key: 'releaseDate', label: 'Release date' },
];

export function resolveKeySpecValue(
  specs: Record<string, unknown> | undefined,
  key: string,
  fallback: string
): string {
  if (!specs || !(key in specs)) return fallback;
  const value = (specs as Record<string, unknown>)[key];
  if (Array.isArray(value)) {
    return value.length ? value.join(' / ') : fallback;
  }
  if (value == null) return fallback;
  const normalized = String(value).trim();
  if (/^(yes|true)$/i.test(normalized)) return 'Supported';
  if (/^(no|false)$/i.test(normalized)) return 'Not supported';
  return normalized;
}

export function resolveStatus(value?: boolean | null) {
  if (value === true) return 'Supported';
  if (value === false) return 'Not supported';
  return 'Data pending';
}

export function resolveModeSupported(engineCaps: EngineCaps | undefined, mode: Mode | 'v2v') {
  const modes = engineCaps?.modes ?? [];
  if (!modes.length) return 'Data pending';
  return modes.includes(mode as Mode) ? 'Supported' : 'Not supported';
}

export function resolveVideoToVideoSupport(engineCaps: EngineCaps | undefined) {
  const modes = engineCaps?.modes ?? [];
  if (!modes.length) return 'Data pending';
  if (modes.includes('v2v') && modes.includes('reframe')) return 'Supported (modify / reframe workflows)';
  if (modes.some((mode) => String(mode) === 'v2v')) return 'Supported';
  if (modes.includes('reframe')) return 'Supported (reframe workflow)';
  if (modes.includes('extend') || modes.includes('retake')) {
    return 'Supported (extend / retake workflows)';
  }
  return 'Not supported';
}

export function resolveFirstLastSupport(engineCaps: EngineCaps | undefined) {
  const modes = engineCaps?.modes ?? [];
  if (modes.includes('fl2v')) return 'Supported';
  if (engineCaps?.keyframes != null) return resolveStatus(engineCaps.keyframes);
  return modes.length ? 'Not supported' : 'Data pending';
}

export function resolveReferenceImageSupport(engineCaps: EngineCaps | undefined) {
  const modes = engineCaps?.modes ?? [];
  if (!modes.length) return 'Data pending';
  if (modes.includes('ref2v') || modes.includes('r2v')) return 'Supported (multi reference stills)';
  if (modes.includes('i2v')) return 'Supported (single start image)';
  return 'Not supported';
}

export function resolveReferenceVideoSupport(engineCaps: EngineCaps | undefined) {
  const modes = engineCaps?.modes ?? [];
  if (!modes.length) return 'Data pending';
  if (modes.includes('v2v') || modes.includes('reframe')) {
    return 'Supported (source clip for modify / reframe)';
  }
  if (modes.includes('r2v')) return 'Supported';
  if (modes.includes('extend') || modes.includes('retake')) {
    return 'Supported (source clip for extend / retake)';
  }
  return 'Not supported';
}

export function formatMaxResolution(engineCaps: EngineCaps | undefined) {
  const resolutions = engineCaps?.resolutions ?? [];
  if (!resolutions.length) return 'Data pending';
  if (resolutions.some((value) => /4k/i.test(String(value)))) return '4K';
  if (resolutions.some((value) => /2k/i.test(String(value)))) return '2K';
  const numeric = resolutions
    .map((value) => {
      const raw = String(value).toLowerCase();
      if (raw.includes('square_hd') || raw.includes('portrait_hd') || raw.includes('landscape_hd')) {
        return 720;
      }
      const matchK = raw.match(/(\d+)\s*k/);
      if (matchK) return Number(matchK[1]) * 1000;
      const matchP = raw.match(/(\d+)\s*p/);
      return matchP ? Number(matchP[1]) : null;
    })
    .filter((value): value is number => value != null);
  if (!numeric.length) return resolutions.join(' / ');
  const max = Math.max(...numeric);
  return `${max}p`;
}

export function formatDuration(engineCaps: EngineCaps | undefined) {
  const max = engineCaps?.maxDurationSec;
  return typeof max === 'number' ? `${max}s max` : 'Data pending';
}

export function formatAspectRatios(engineCaps: EngineCaps | undefined) {
  const ratios = engineCaps?.aspectRatios ?? [];
  return ratios.length ? ratios.join(' / ') : 'Data pending';
}

export function formatFps(engineCaps: EngineCaps | undefined) {
  const fps = engineCaps?.fps ?? [];
  return fps.length ? fps.join(' / ') : 'Data pending';
}

export function formatImageResolutions(engineCaps: EngineCaps | undefined) {
  const resolutions = engineCaps?.resolutions ?? [];
  return resolutions.length ? resolutions.join(' / ') : 'Data pending';
}

export function formatOutputFormats(entry: FalEngineEntry) {
  const engineCaps = entry.engine;
  const fields = [...(engineCaps?.inputSchema?.required ?? []), ...(engineCaps?.inputSchema?.optional ?? [])];
  const outputFormatField = fields.find((field) => field.id === 'output_format');
  const outputFormatValues =
    outputFormatField && 'values' in outputFormatField && Array.isArray(outputFormatField.values)
      ? outputFormatField.values
      : [];
  if (outputFormatValues.length) {
    return outputFormatValues.join(' / ');
  }
  const rendersVideo =
    entry.type === 'video' ||
    (engineCaps?.modes ?? []).some((mode) =>
      ['t2v', 'i2v', 'v2v', 'ref2v', 'r2v', 'fl2v', 'extend', 'reframe', 'retake'].includes(mode)
    );
  return rendersVideo ? 'MP4' : 'Data pending';
}

export function getPricePerSecondCents(engineCaps: EngineCaps | undefined): number | null {
  const perSecond = engineCaps?.pricingDetails?.perSecondCents;
  const byResolution = perSecond?.byResolution ? Object.values(perSecond.byResolution) : [];
  const cents = perSecond?.default ?? (byResolution.length ? Math.min(...byResolution) : null);
  if (typeof cents === 'number') {
    return applyDisplayedPriceMarginCents(cents);
  }
  const base = engineCaps?.pricing?.base;
  if (typeof base === 'number') {
    return applyDisplayedPriceMarginCents(Math.round(base * 100));
  }
  return null;
}

export function getPricePerImageCents(engineCaps: EngineCaps | undefined): number | null {
  const flat = engineCaps?.pricingDetails?.flatCents;
  const byResolution = flat?.byResolution ? Object.values(flat.byResolution) : [];
  const cents = flat?.default ?? (byResolution.length ? Math.min(...byResolution) : null);
  if (typeof cents === 'number') {
    return applyDisplayedPriceMarginCents(cents);
  }
  const base = engineCaps?.pricing?.base;
  if (typeof base === 'number') {
    return applyDisplayedPriceMarginCents(Math.round(base * 100));
  }
  return null;
}

export function formatPricePerSecond(engineCaps: EngineCaps | undefined): string {
  const cents = getPricePerSecondCents(engineCaps);
  if (typeof cents === 'number') {
    return `$${(cents / 100).toFixed(2)}/s`;
  }
  return 'Data pending';
}

export function formatPricePerImage(engineCaps: EngineCaps | undefined): string {
  const cents = getPricePerImageCents(engineCaps);
  if (typeof cents === 'number') {
    return `$${(cents / 100).toFixed(2)}/image`;
  }
  return 'Data pending';
}

export function buildSpecValues(
  entry: FalEngineEntry,
  specs: Record<string, unknown> | undefined,
  pricingOverrides?: { pricePerSecond?: string | null; pricePerImage?: string | null }
): KeySpecValues {
  const engineCaps = entry.engine;
  const isImage = entry.type === 'image' || engineCaps.modes?.some((mode) => mode.endsWith('i'));
  return {
    pricePerImage: resolveKeySpecValue(
      specs,
      'pricePerImage',
      pricingOverrides?.pricePerImage ?? formatPricePerImage(engineCaps)
    ),
    pricePerSecond: resolveKeySpecValue(
      specs,
      'pricePerSecond',
      pricingOverrides?.pricePerSecond ?? formatPricePerSecond(engineCaps)
    ),
    releaseDate: resolveKeySpecValue(specs, 'releaseDate', 'Data pending'),
    textToImage: resolveKeySpecValue(specs, 'textToImage', resolveModeSupported(engineCaps, 't2i')),
    imageToImage: resolveKeySpecValue(specs, 'imageToImage', resolveModeSupported(engineCaps, 'i2i')),
    textToVideo: resolveKeySpecValue(specs, 'textToVideo', resolveModeSupported(engineCaps, 't2v')),
    imageToVideo: resolveKeySpecValue(specs, 'imageToVideo', resolveModeSupported(engineCaps, 'i2v')),
    videoToVideo: resolveKeySpecValue(specs, 'videoToVideo', resolveVideoToVideoSupport(engineCaps)),
    firstLastFrame: resolveKeySpecValue(specs, 'firstLastFrame', resolveFirstLastSupport(engineCaps)),
    referenceImageStyle: resolveKeySpecValue(specs, 'referenceImageStyle', resolveReferenceImageSupport(engineCaps)),
    referenceVideo: resolveKeySpecValue(specs, 'referenceVideo', resolveReferenceVideoSupport(engineCaps)),
    maxResolution: resolveKeySpecValue(
      specs,
      'maxResolution',
      isImage ? formatImageResolutions(engineCaps) : formatMaxResolution(engineCaps)
    ),
    maxDuration: resolveKeySpecValue(specs, 'maxDuration', formatDuration(engineCaps)),
    aspectRatios: resolveKeySpecValue(specs, 'aspectRatios', formatAspectRatios(engineCaps)),
    fpsOptions: resolveKeySpecValue(specs, 'fpsOptions', formatFps(engineCaps)),
    outputFormats: resolveKeySpecValue(specs, 'outputFormats', formatOutputFormats(entry)),
    audioOutput: resolveKeySpecValue(specs, 'audioOutput', resolveStatus(engineCaps?.audio)),
    nativeAudioGeneration: resolveKeySpecValue(specs, 'nativeAudioGeneration', resolveStatus(engineCaps?.audio)),
    lipSync: resolveKeySpecValue(specs, 'lipSync', 'Data pending'),
    cameraMotionControls: resolveKeySpecValue(
      specs,
      'cameraMotionControls',
      resolveStatus(engineCaps?.motionControls)
    ),
    watermark: resolveKeySpecValue(specs, 'watermark', 'No (MaxVideoAI)'),
  };
}

export function isPending(value: string) {
  return value.trim().toLowerCase() === 'data pending';
}

export function isUnsupported(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized === 'not supported' || normalized === 'unsupported';
}

export function isSupported(value: string) {
  return value.trim().toLowerCase() === 'supported';
}

export function resolveSpecStatusLabels(locale: AppLocale) {
  return SPEC_STATUS_LABELS[locale] ?? SPEC_STATUS_LABELS.en;
}

export function localizeSpecStatus(value: string, locale: AppLocale): string {
  const labels = resolveSpecStatusLabels(locale);
  const normalized = value.trim();
  const lower = normalized.toLowerCase();
  if (isSupported(normalized)) return labels.supported;
  if (isUnsupported(normalized)) return labels.notSupported;
  if (isPending(normalized)) return labels.pending;
  if (lower.startsWith('supported (') && normalized.endsWith(')')) {
    const detail = normalized.slice(normalized.indexOf('(') + 1, -1);
    return `${labels.supported} (${localizeSpecStatus(detail, locale)})`;
  }
  if (lower.startsWith('not supported (') && normalized.endsWith(')')) {
    const detail = normalized.slice(normalized.indexOf('(') + 1, -1);
    return `${labels.notSupported} (${localizeSpecStatus(detail, locale)})`;
  }
  if (lower === 'prompt-based only') {
    return locale === 'fr' ? 'Via prompt uniquement' : locale === 'es' ? 'Solo mediante prompt' : normalized;
  }
  if (lower === 'single start image') {
    return locale === 'fr' ? 'une seule image de départ' : locale === 'es' ? 'una sola imagen inicial' : normalized;
  }
  if (lower === 'multi reference stills') {
    return locale === 'fr'
      ? 'plusieurs stills de référence'
      : locale === 'es'
        ? 'varios stills de referencia'
        : normalized;
  }
  if (lower === 'source clip for extend / retake') {
    return locale === 'fr'
      ? 'clip source pour extension / retake'
      : locale === 'es'
        ? 'clip fuente para extensión / retake'
        : normalized;
  }
  if (lower === 'source clip for modify / reframe') {
    return locale === 'fr'
      ? 'clip source pour modify / reframe'
      : locale === 'es'
        ? 'clip fuente para modify / reframe'
        : normalized;
  }
  if (lower === 'start + end image in i2v') {
    return locale === 'fr'
      ? 'image de départ + image de fin en image → vidéo'
      : locale === 'es'
        ? 'imagen inicial + imagen final en imagen → video'
        : normalized;
  }
  if (lower === 'reframe workflow') {
    return locale === 'fr' ? 'workflow reframe' : locale === 'es' ? 'workflow reframe' : normalized;
  }
  if (lower === 'modify / reframe workflows') {
    return locale === 'fr'
      ? 'workflows modify / reframe'
      : locale === 'es'
        ? 'workflows modify / reframe'
        : normalized;
  }
  if (lower === 'extend / retake workflows') {
    return locale === 'fr'
      ? 'workflows extension / retake'
      : locale === 'es'
        ? 'workflows de extensión / retake'
        : normalized;
  }
  if (lower === 'no (maxvideoai)') {
    return locale === 'fr' ? 'Non (MaxVideoAI)' : locale === 'es' ? 'No (MaxVideoAI)' : normalized;
  }
  return value;
}

export function normalizeMaxResolution(value: string) {
  if (value.includes('/') || value.includes(',')) return value;
  const matchP = value.match(/(\d{3,4}p)/i);
  if (matchP) return matchP[1];
  const matchK = value.match(/(\d+)\s?k/i);
  if (matchK) return `${matchK[1]}K`;
  return value;
}

export function formatHeroLimitChip(label: string | undefined, value: string) {
  return label ? `${label}: ${value}` : value;
}

export function resolveHeroLimitsLine(locale: AppLocale) {
  return HERO_LIMITS_LINES[locale] ?? HERO_LIMITS_LINES.en;
}

export function buildAutoHeroSpecChips(values: KeySpecValues | null, locale: AppLocale): HeroSpecChip[] {
  if (!values) return [];
  const chips: HeroSpecChip[] = [];
  const labels = getLocalizedHeroChipLabels(locale);
  const add = (label: string | null, icon: HeroSpecIconKey | null) => {
    if (!label) return;
    chips.push({ label, icon });
  };

  const resolution = values.maxResolution && !isPending(values.maxResolution)
    ? normalizeMaxResolution(values.maxResolution)
    : null;
  const duration = values.maxDuration && !isPending(values.maxDuration) ? values.maxDuration.replace(' max', '') : null;
  const aspect = values.aspectRatios && !isPending(values.aspectRatios) ? values.aspectRatios : null;

  if (isSupported(values.textToImage)) add(labels.textToImage, 'textToVideo');
  if (isSupported(values.imageToImage)) add(labels.imageToImage, 'imageToVideo');
  if (isSupported(values.textToVideo)) add(labels.textToVideo, 'textToVideo');
  if (isSupported(values.imageToVideo)) add(labels.imageToVideo, 'imageToVideo');
  if (resolution) add(formatHeroLimitChip(labels.maxResolution, resolution), 'resolution');
  if (duration) add(formatHeroLimitChip(labels.maxDuration, duration), 'duration');
  if (aspect) add(aspect, 'aspectRatio');
  if (isSupported(values.audioOutput) || isSupported(values.nativeAudioGeneration)) add(labels.audio, 'audio');

  return chips.slice(0, 6);
}

export function normalizeHeroTitle(rawTitle: string, providerName: string | null): string {
  const trimmed = rawTitle.trim();
  const splitMatch = trimmed.split(/\s[–—-]\s/);
  const base = splitMatch[0] ?? trimmed;
  const cleanProvider = providerName?.trim();
  if (cleanProvider && base.toLowerCase().startsWith(cleanProvider.toLowerCase() + ' ')) {
    return base.slice(cleanProvider.length + 1).trim();
  }
  if (base.toLowerCase().startsWith('openai ')) {
    return base.slice('openai '.length).trim();
  }
  return base.trim();
}

export function buildEyebrow(providerName: string | null): string | null {
  if (!providerName) return null;
  const normalized = providerName
    .replace(/by\s+.+$/i, '')
    .replace(/\s+DeepMind$/i, '')
    .trim();
  return normalized ? `${normalized} model` : null;
}

export function joinUseCaseList(items: string[], maxItems = 3): string | null {
  const cleaned = items.map((item) => item.replace(/\.$/, '').trim()).filter(Boolean);
  if (!cleaned.length) return null;
  const slice = cleaned.slice(0, maxItems);
  if (slice.length === 1) return slice[0];
  if (slice.length === 2) return `${slice[0]} and ${slice[1]}`;
  return `${slice.slice(0, -1).join(', ')}, and ${slice[slice.length - 1]}`;
}

export function buildSupportLine(items: string[]): string | null {
  const list = joinUseCaseList(items);
  if (!list) return null;
  return `Best for ${list}.`;
}

export function normalizeHeroSubtitle(text: string, locale: AppLocale): string {
  if (!text) return text;
  if (locale !== 'en') return text;
  let output = text;
  output = output.replace(/\b(in|inside|via|on)\s+MaxVideoAI\b/gi, '');
  output = output.replace(/\bMaxVideoAI\b/gi, '');
  let aiCount = 0;
  output = output.replace(/\bAI\b/gi, (match) => {
    aiCount += 1;
    return aiCount === 1 ? match : '';
  });
  output = output.replace(/([.?!])\s*,\s*/g, '$1 ');
  output = output.replace(/,\s*([.?!])/g, '$1');
  output = output.replace(/\s{2,}/g, ' ').replace(/\s+([,.;:!?])/g, '$1').trim();
  output = output.replace(/([.?!]\s+)([a-z])/g, (_, boundary: string, letter: string) => `${boundary}${letter.toUpperCase()}`);
  return output;
}

export function buildDefaultSpecTitle(locale: AppLocale): string {
  return SPEC_TITLE_BASE[locale] ?? SPEC_TITLE_BASE.en;
}

export function normalizeSpecTitle(
  rawTitle: string | null,
  locale: AppLocale
): string {
  const cleanRaw = rawTitle?.trim();
  if (cleanRaw) return cleanRaw;
  return buildDefaultSpecTitle(locale);
}

export function normalizeSpecNote(_rawNote: string | null, locale: AppLocale): string | null {
  return SPECS_DECISION_NOTES[locale] ?? SPECS_DECISION_NOTES.en;
}

export function resolveSectionLabels(locale: AppLocale) {
  return SECTION_LABELS[locale] ?? SECTION_LABELS.en;
}

export function resolveSpecRowLabel(locale: AppLocale, key: KeySpecKey, isImageEngine: boolean): string {
  const overrides =
    (SPEC_ROW_LABEL_OVERRIDES[locale] ?? SPEC_ROW_LABEL_OVERRIDES.en)[isImageEngine ? 'image' : 'video'];
  const override = overrides[key];
  if (override) return override;
  const base = isImageEngine ? IMAGE_SPEC_ROW_DEFS : VIDEO_SPEC_ROW_DEFS;
  return base.find((row) => row.key === key)?.label ?? key;
}

export function resolveSpecRowDefs(locale: AppLocale, isImageEngine: boolean) {
  const base = isImageEngine ? IMAGE_SPEC_ROW_DEFS : VIDEO_SPEC_ROW_DEFS;
  return base.map((row) => ({
    ...row,
    label: resolveSpecRowLabel(locale, row.key, isImageEngine),
  }));
}

export function resolveAudioPricingLabels(locale: AppLocale) {
  return PRICE_AUDIO_LABELS[locale] ?? PRICE_AUDIO_LABELS.en;
}

export function resolveCompareCopy(locale: AppLocale, heroTitle: string, supportsAudio: boolean) {
  const copy = COMPARE_COPY_BY_LOCALE[locale] ?? COMPARE_COPY_BY_LOCALE.en;
  return {
    title: copy.title(heroTitle),
    introPrefix: copy.introPrefix(heroTitle),
    introStrong: copy.introStrong(supportsAudio),
    introSuffix: copy.introSuffix,
    subline: copy.subline,
    ctaCompare: (other: string) => copy.ctaCompare(heroTitle, other),
    ctaExplore: (other: string) => copy.ctaExplore(other),
    cardDescription: (other: string) => copy.cardDescription(heroTitle, other, supportsAudio),
  };
}

export function inferBestUseCaseIcon(title: string): BestUseCaseIconKey {
  const normalized = title.toLowerCase();
  for (const rule of BEST_USE_CASE_ICON_RULES) {
    if (rule.test.test(normalized)) return rule.icon;
  }
  return 'cinematic';
}

export function normalizeChips(rawChips: unknown, icon: BestUseCaseIconKey, locale?: AppLocale): string[] {
  const chips =
    Array.isArray(rawChips)
      ? rawChips.map((chip) => (typeof chip === 'string' ? chip.trim() : '')).filter(Boolean)
      : [];
  if (chips.length) return chips.slice(0, 2);
  if (locale === 'en') return DEFAULT_CHIPS_BY_ICON[icon].slice(0, 2);
  return [];
}

export function normalizeBestUseCaseItems(value: unknown, locale?: AppLocale): BestUseCaseItem[] {
  if (!Array.isArray(value)) return [];
  const items: BestUseCaseItem[] = [];
  for (const entry of value) {
    if (typeof entry === 'string') {
      const title = entry.trim();
      if (!title) continue;
      const icon = inferBestUseCaseIcon(title);
      items.push({
        title,
        icon,
        chips: normalizeChips(null, icon, locale),
      });
      continue;
    }
    if (!entry || typeof entry !== 'object') continue;
    const obj = entry as Record<string, unknown>;
    const title =
      typeof obj.title === 'string'
        ? obj.title.trim()
        : typeof obj.label === 'string'
          ? obj.label.trim()
          : '';
    if (!title) continue;
    const rawIcon = typeof obj.icon === 'string' ? obj.icon.trim() : '';
    const href = typeof obj.href === 'string' && obj.href.trim() ? obj.href.trim() : null;
    const icon =
      (rawIcon && BEST_USE_CASE_ICON_KEYS.includes(rawIcon as BestUseCaseIconKey)
        ? rawIcon
        : inferBestUseCaseIcon(title)) as BestUseCaseIconKey;
    const chips = normalizeChips(obj.chips, icon, locale);
    items.push({
      title,
      icon,
      chips,
      href,
    });
  }
  return items;
}

export function normalizeSecondaryCta(label: string | null): string | null {
  if (!label) return null;
  return label.replace(/\(1080p\)/gi, '(higher resolution)').replace(/\b1080p\b/gi, 'higher resolution').trim();
}

export function buildAutoSpecSections(values: KeySpecValues | null, locale: AppLocale): SpecSection[] {
  if (!values) return [];
  const labels = AUTO_SPEC_LABELS[locale] ?? AUTO_SPEC_LABELS.en;
  const inputs: string[] = [];
  const audio: string[] = [];

  inputs.push(`${labels.textToVideo}: ${localizeSpecStatus(values.textToVideo, locale)}`);
  inputs.push(`${labels.imageToVideo}: ${localizeSpecStatus(values.imageToVideo, locale)}`);
  inputs.push(`${labels.videoToVideo}: ${localizeSpecStatus(values.videoToVideo, locale)}`);
  inputs.push(`${labels.referenceImageStyle}: ${localizeSpecStatus(values.referenceImageStyle, locale)}`);
  inputs.push(`${labels.referenceVideo}: ${localizeSpecStatus(values.referenceVideo, locale)}`);

  audio.push(`${labels.audioOutput}: ${localizeSpecStatus(values.audioOutput, locale)}`);
  audio.push(`${labels.nativeAudio}: ${localizeSpecStatus(values.nativeAudioGeneration, locale)}`);
  audio.push(`${labels.lipSync}: ${localizeSpecStatus(values.lipSync, locale)}`);

  return [
    { title: labels.inputsTitle, items: inputs },
    { title: labels.audioTitle, items: audio },
  ];
}
