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
import type { AppLocale } from '@/i18n/locales';
import type { BestUseCaseIconKey, KeySpecKey } from './model-page-specs-types';

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
