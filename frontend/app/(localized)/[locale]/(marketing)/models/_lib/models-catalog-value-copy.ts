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

