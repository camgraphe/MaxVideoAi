import type { AppLocale } from '@/i18n/locales';

export const DEFAULT_VIDEO_TROUBLESHOOTING = [
  'Feels random / inconsistent → simplify to: subject + action + camera + lighting. Re-run 2–3 takes.',
  'Motion looks weird → reduce movement: one camera move, slower action, fewer props.',
  'Subject drifts off-brand → start from a reference image and lock palette + lighting.',
  'Text looks wrong → avoid readable signage, tiny UI, micro labels. Keep text off-screen.',
  'Dialogue drifts → keep lines short and punchy; avoid long monologues.',
];

export const DEFAULT_VIDEO_TROUBLESHOOTING_BY_LOCALE: Record<AppLocale, string[]> = {
  en: DEFAULT_VIDEO_TROUBLESHOOTING,
  fr: [
    'Résultat aléatoire / incohérent → simplifiez : sujet + action + caméra + lumière. Relancez 2–3 variantes.',
    'Mouvement étrange → réduisez le mouvement : un seul move caméra, action plus lente, moins d’accessoires.',
    'Le sujet dérive de la marque → partez d’une image de référence et verrouillez palette + lumière.',
    'Texte incorrect → évitez la signalétique lisible, les micro‑labels, les petits UI. Gardez le texte hors champ.',
    'Dialogue instable → gardez les répliques courtes et percutantes; évitez les longs monologues.',
  ],
  es: [
    'Se siente aleatorio / inconsistente → simplifica: sujeto + acción + cámara + iluminación. Repite 2–3 tomas.',
    'El movimiento se ve raro → reduce el movimiento: un solo movimiento de cámara, acción más lenta, menos props.',
    'El sujeto se sale de la marca → empieza con una imagen de referencia y fija paleta + iluminación.',
    'El texto sale mal → evita señalética legible, UI pequeño, micro‑labels. Mantén el texto fuera de plano.',
    'El diálogo deriva → mantén líneas cortas y directas; evita monólogos largos.',
  ],
};

export const DEFAULT_VIDEO_TROUBLESHOOTING_NO_AUDIO_BY_LOCALE: Record<AppLocale, string[]> = {
  en: DEFAULT_VIDEO_TROUBLESHOOTING.filter((item) => !item.toLowerCase().includes('dialogue')),
  fr: DEFAULT_VIDEO_TROUBLESHOOTING_BY_LOCALE.fr.filter((item) => !item.toLowerCase().includes('dialogue')),
  es: DEFAULT_VIDEO_TROUBLESHOOTING_BY_LOCALE.es.filter((item) => !item.toLowerCase().includes('diálogo')),
};

export function getDefaultVideoTroubleshooting(locale: AppLocale, supportsAudio: boolean): string[] {
  if (supportsAudio) {
    return DEFAULT_VIDEO_TROUBLESHOOTING_BY_LOCALE[locale] ?? DEFAULT_VIDEO_TROUBLESHOOTING;
  }
  return DEFAULT_VIDEO_TROUBLESHOOTING_NO_AUDIO_BY_LOCALE[locale] ?? DEFAULT_VIDEO_TROUBLESHOOTING_NO_AUDIO_BY_LOCALE.en;
}

export const DEFAULT_VIDEO_SAFETY = [
  'Don’t generate real people or public figures (celebrities, politicians, etc.).',
  'No minors, sexual content, hateful content, or graphic violence.',
  'Don’t use someone’s likeness without consent.',
  'Some prompts and reference images may be blocked — generic characters and scenes are fine.',
];

export const DEFAULT_GENERIC_SAFETY = DEFAULT_VIDEO_SAFETY;

const DEFAULT_VIDEO_SAFETY_BY_LOCALE: Record<AppLocale, string[]> = {
  en: DEFAULT_VIDEO_SAFETY,
  fr: [
    'Ne générez pas de personnes réelles ni de personnalités publiques (célébrités, responsables politiques, etc.).',
    'Pas de mineurs, contenu sexuel, contenu haineux ou violence graphique.',
    "N'utilisez pas l'image ou la ressemblance d'une personne sans son consentement.",
    'Certains prompts et images de référence peuvent être bloqués ; les personnages et scènes génériques sont acceptés.',
  ],
  es: [
    'No generes personas reales ni figuras públicas (celebridades, políticos, etc.).',
    'Sin menores, contenido sexual, contenido de odio ni violencia gráfica.',
    'No uses la imagen o el parecido de una persona sin su consentimiento.',
    'Algunos prompts e imágenes de referencia pueden bloquearse; los personajes y escenas genéricos son aceptables.',
  ],
};

export function getDefaultGenericSafety(locale: AppLocale): string[] {
  return DEFAULT_VIDEO_SAFETY_BY_LOCALE[locale] ?? DEFAULT_VIDEO_SAFETY_BY_LOCALE.en;
}

export type DetailCopy = {
  backLabel: string;
  renderLinkLabel: string;
  relatedModelCta: string;
  examplesLinkLabel: string;
  pricingLinkLabel: string;
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

export const DEFAULT_DETAIL_COPY: DetailCopy = {
  backLabel: '← Back to models',
  renderLinkLabel: 'View render →',
  relatedModelCta: 'View model →',
  examplesLinkLabel: 'See examples',
  pricingLinkLabel: 'Compare pricing',
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

export const MODEL_OG_IMAGE_MAP: Record<string, string> = {
  'sora-2':
    'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/a5cbd8d3-33c7-47b5-8480-7f23aab89891-job_684c1b3d-2679-40d1-adb7-06151b3e8739.jpg',
  'sora-2-pro':
    'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/a5cbd8d3-33c7-47b5-8480-7f23aab89891-job_684c1b3d-2679-40d1-adb7-06151b3e8739.jpg',
  'veo-3-1': '/hero/veo-3-1-hero.jpg',
  'veo-3-1-fast': '/hero/veo-3-1-hero.jpg',
  'veo-3-1-lite': '/hero/veo-3-1-hero.jpg',
  'pika-text-to-video': '/hero/pika-22.jpg',
  'minimax-hailuo-02-text': '/hero/minimax-video01.jpg',
};
