import type { AppLocale } from '@/i18n/locales';

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
  'kling-o3-standard': 'lower-cost reference, storyboard, and source-video V2V tests',
  'kling-o3-pro': 'reference-guided Kling video, storyboard inputs, and source-video V2V',
  'kling-o3-4k': 'native 4K reference-guided delivery renders without source-video V2V',
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
  'happy-horse-1-1': 'Alibaba text, image, and reference video with native audio',
  'happy-horse-1-0': 'legacy Alibaba video edit workflows',
  'gpt-image-2': 'text-heavy stills, product photography, and controlled edits',
  seedream: 'clean reference images for Seedance animation and product visuals',
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
      'Idéal pour des séquences ciné multi-plans, avec contrôle vocal, audio natif, lip-sync précis et forte contrôlabilité, en texte-vers-vidéo comme en image-vers-vidéo.',
    'kling-3-4k':
      'Idéal pour les masters 4K natifs : sorties premium et grands écrans, après validation en Standard ou Pro.',
    'kling-o3-standard':
      'Idéal pour tester à moindre coût des références visuelles, storyboards et vidéos sources V2V avant de passer en O3 Pro.',
    'kling-o3-pro':
      'Idéal pour guider Kling avec des images de référence, des storyboards ou une vidéo source V2V sans forcer la première image en start frame.',
    'kling-o3-4k':
      'Idéal pour les rendus 4K natifs guidés par références ou storyboard, après validation en O3 Standard ou Pro.',
    'veo-3-1':
      'Idéal pour créer des plans pub maîtrisés : références, contrôle final et extension, avec un rendu fidèle et synchronisé.',
    'veo-3-1-fast':
      'Idéal pour produire vite des cuts pub : image de départ, contrôle final et extension, avec un excellent rapport vitesse/coût.',
    'ltx-2-3-fast':
      'Idéal pour des itérations rapides avec LTX 2.3, en texte-vers-vidéo et image-vers-vidéo, avec une excellente vitesse, stabilité et des tarifs compétitifs.',
    'ltx-2-3-pro':
      'Workflows LTX tout-en-un avec audio, retakes, contrôle fort et tarifs compétitifs en texte et image-vers-vidéo',
    'sora-2':
      'Idéal pour des scènes cinématiques et la continuité personnage, avec forte fidélité humaine et tarifs compétitifs, en texte-vers-vidéo comme en image-vers-vidéo.',
    'sora-2-pro':
      'Idéal pour des plans cinématiques premium et des scènes hero, avec une forte fidélité humaine et une qualité visuelle élevée, en texte-vers-vidéo et image-vers-vidéo.',
    'seedance-1-5-pro':
      'Idéal pour des mouvements cinématiques avec caméra verrouillée, audio natif, lip-sync précis et tarifs compétitifs, en texte et image-vers-vidéo.',
    'veo-3-1-lite':
      'Idéal pour des tests Veo économiques, avec image de départ et contrôle début/fin, excellente rapidité et stabilité.',
    'luma-ray-2':
      'Idéal pour des générations cinématiques à partir d’une vidéo source, avec modification, recadrage, forte contrôlabilité et haute qualité visuelle.',
    'luma-ray-2-flash':
      'Idéal pour des tests cinématiques à partir d’une vidéo source, avec modification, recadrage, stabilité et coûts maîtrisés.',
    'pika-text-to-video':
      'Idéal pour des clips social stylisés, rapides, stables et économiques, avec contrôle début/fin en texte-vers-vidéo et image-vers-vidéo.',
    'wan-2-6':
      'Idéal pour des prompts structurés et des transitions propres, rapides, stables et économiques, en texte-vers-vidéo et image-vers-vidéo.',
    'minimax-hailuo-02-text':
      'Idéal pour des tests de concepts économiques, rapides et stables, en texte-vers-vidéo et image-vers-vidéo, avec contrôle début/fin.',
    'gpt-image-2':
      'Idéal pour des images riches en texte, des packshots produit, des mockups UI et des retouches guidées par référence.',
    'happy-horse-1-1':
      'Idéal pour les générations Alibaba texte, image et référence, avec audio natif et lip-sync.',
    'happy-horse-1-0':
      'Route Alibaba legacy pour les anciens workflows d’édition vidéo et jobs Happy Horse 1.0.',
    'nano-banana-2': 'Idéal pour des images fixes guidées et des retouches grand format, avec des performances fiables.',
    'nano-banana-pro': 'Idéal pour des visuels de campagne et des retouches typographiques, avec des performances fiables.',
    seedream:
      'Idéal pour créer des références propres avant Seedance, des packshots produit et des visuels publicitaires contrôlés.',
  },
  es: {
    'seedance-2-0':
      'Ideal para videos multi-planos premium, con audio nativo y mayor realismo de movimiento, con fuerte audio y lip sync, y alta calidad visual.',
    'seedance-2-0-fast':
      'Ideal para borradores rápidos con Seedance, para planificación de planos e iteración creativa, con velocidad y estabilidad.',
    'kling-3-standard':
      'Ideal para secuencias cinematográficas multi-planos con control de voz y mayor control.',
    'kling-3-pro':
      'Ideal para secuencias cinematográficas multi-planos con control de voz y mayor control.',
    'kling-3-4k':
      'Ideal para entregas finales en 4K nativo, salidas premium y grandes pantallas.',
    'kling-o3-standard':
      'Ideal para probar referencias visuales, storyboards y video fuente V2V con menor costo antes de pasar a O3 Pro.',
    'kling-o3-pro':
      'Ideal para guiar Kling con imágenes de referencia, storyboard o video fuente V2V sin forzar la primera imagen como frame inicial.',
    'kling-o3-4k':
      'Ideal para renders 4K nativos guiados por referencias o storyboard después de validar la dirección en O3 Standard o Pro.',
    'veo-3-1':
      'Ideal para tomas publicitarias con referencias, control del último frame y extensión.',
    'happy-horse-1-1':
      'Ideal para generación Alibaba desde texto, imagen y referencias, con audio nativo y lip sync.',
    'happy-horse-1-0':
      'Ruta Alibaba legacy para flujos antiguos de edición de video y trabajos Happy Horse 1.0.',
  },
};

const DEFAULT_VALUE_SENTENCE = 'Best for {useCase} with strong {strengths} in {capabilities} workflows.';
export const DEFAULT_VALUE_SENTENCE_BY_LOCALE: Record<AppLocale, string> = {
  en: DEFAULT_VALUE_SENTENCE,
  fr: 'Idéal pour {useCase} avec de bons résultats sur {strengths} dans les workflows {capabilities}.',
  es: 'Ideal para {useCase} con buen nivel en {strengths} dentro de flujos de {capabilities}.',
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
