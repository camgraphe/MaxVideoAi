import type { AppLocale } from '@/i18n/locales';

const LOCALIZED_BEST_FOR: Partial<Record<AppLocale, Record<string, string>>> = {
  fr: {
    'Ads and B-roll': 'Publicités et plans B-roll',
    'Budget Veo drafts': 'Tests Veo à petit budget',
    'Cinematic dialogue': 'Dialogue cinématographique',
    'Cinematic motion with camera lock': 'Mouvement cinématographique avec caméra verrouillée',
    'Cinematic shots': 'Plans cinématographiques',
    'Fast Seedance tests, reference tests, and shot planning':
      'Tests Seedance rapides, tests de références et préparation des plans',
    'Fast cinematic drafts with modify and reframe': 'Tests cinématographiques rapides avec modify et reframe',
    'Fast iterations': 'Itérations rapides',
    'Flagship multi-shot video with native audio and references':
      'Vidéo multi-plans premium avec audio natif et références',
    'General purpose video': 'Vidéo polyvalente',
    'Grounded stills and wide-format image edits': 'Stills réalistes et retouches d’images grand format',
    'Multi-shot cinematic control': 'Contrôle cinématographique multi-plans',
    'Multi-shot testing at lower cost': 'Tests multi-plans à moindre coût',
    'Premium cinematic generation with modify and reframe': 'Génération cinématographique premium avec modify et reframe',
    'Premium product stories': 'Histoires produit premium',
    'Prompts or image loops': 'Prompts ou boucles à partir d’images',
    'Rapid social clips': 'Clips sociaux rapides',
    'Studio-grade Sora renders': 'Rendus Sora de niveau studio',
    'Stylised text or image motion': 'Animation stylisée de texte ou d’image',
  },
  es: {
    'Ads and B-roll': 'Anuncios y tomas de apoyo (B-roll)',
    'Budget Veo drafts': 'Borradores Veo de bajo coste',
    'Cinematic dialogue': 'Diálogo cinematográfico',
    'Cinematic motion with camera lock': 'Movimiento cinematográfico con cámara bloqueada',
    'Cinematic shots': 'Planos cinematográficos',
    'Fast Seedance tests, reference tests, and shot planning':
      'Borradores rápidos de Seedance, pruebas de referencias y planificación de planos',
    'Fast cinematic drafts with modify and reframe': 'Borradores cinematográficos rápidos con modify y reframe',
    'Fast iterations': 'Iteraciones rápidas',
    'Flagship multi-shot video with native audio and references':
      'Video multi-planos con audio nativo y referencias',
    'General purpose video': 'Video de uso general',
    'Grounded stills and wide-format image edits': 'Imágenes fijas realistas y ediciones panorámicas',
    'Multi-shot cinematic control': 'Control cinematográfico multi-shot',
    'Multi-shot testing at lower cost': 'Pruebas multi-shot con menor coste',
    'Premium cinematic generation with modify and reframe': 'Generación cinematográfica premium con modify y reframe',
    'Premium product stories': 'Historias de producto premium',
    'Prompts or image loops': 'Prompts o bucles desde imágenes',
    'Rapid social clips': 'Clips sociales rápidos',
    'Studio-grade Sora renders': 'Renders de Sora con nivel de estudio',
    'Stylised text or image motion': 'Movimiento estilizado de texto o imagen',
  },
};

export const LOCALIZED_SHOWDOWN_TITLES: Partial<Record<AppLocale, Record<string, string>>> = {
  fr: {
    'Fast Motion + Physics (16:9)': 'Mouvement rapide + physique (16:9)',
    'UGC Talking Head + Lip Sync (9:16)': 'Face caméra UGC + synchronisation labiale (9:16)',
    'UGC Talking Head (9:16)': 'Face caméra UGC (9:16)',
    'Hands + Product Demo + On-screen Text': 'Mains + démo produit + texte à l’écran',
  },
  es: {
    'Fast Motion + Physics (16:9)': 'Movimiento rápido + física (16:9)',
    'UGC Talking Head + Lip Sync (9:16)': 'UGC talking head + sincronización labial (9:16)',
    'UGC Talking Head (9:16)': 'UGC talking head (9:16)',
    'Hands + Product Demo + On-screen Text': 'Manos + demo de producto + texto en pantalla',
  },
};

export const LOCALIZED_SHOWDOWN_TESTS: Partial<Record<AppLocale, Record<string, string>>> = {
  fr: {
    'Human Fidelity + Audio/Lip Sync + Prompt Adherence':
      'Fidélité humaine + audio/synchronisation labiale + adhérence au prompt',
    'Human Fidelity + Prompt Adherence + Vertical Framing':
      'Fidélité humaine + adhérence au prompt + cadrage vertical',
    'Motion Realism + Temporal Consistency + Visual Quality':
      'Réalisme du mouvement + cohérence temporelle + qualité visuelle',
    'Hands/Fingers + Text & UI Legibility + Prompt Adherence':
      'Mains/doigts + lisibilité du texte et de l’interface + adhérence au prompt',
  },
  es: {
    'Human Fidelity + Audio/Lip Sync + Prompt Adherence':
      'Fidelidad humana + audio/sincronización labial + adherencia al prompt',
    'Human Fidelity + Prompt Adherence + Vertical Framing':
      'Fidelidad humana + adherencia al prompt + encuadre vertical',
    'Motion Realism + Temporal Consistency + Visual Quality':
      'Realismo del movimiento + consistencia temporal + calidad visual',
    'Hands/Fingers + Text & UI Legibility + Prompt Adherence':
      'Manos/dedos + legibilidad de texto e interfaz + adherencia al prompt',
  },
};

export function localizeMappedValue(
  value: string,
  locale: AppLocale,
  translations: Partial<Record<AppLocale, Record<string, string>>>
): string {
  if (locale === 'en') return value;
  return translations[locale]?.[value] ?? value;
}

export function localizeBestFor(value: string | null | undefined, locale: AppLocale): string | null {
  const normalized = value?.trim();
  if (!normalized) return null;
  if (locale === 'en') return normalized;
  return LOCALIZED_BEST_FOR[locale]?.[normalized] ?? null;
}
