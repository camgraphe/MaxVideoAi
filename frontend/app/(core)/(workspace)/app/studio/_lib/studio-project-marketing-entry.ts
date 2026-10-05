const STARTERS = ['product-ad','storyboard-to-video','cinematic-scene'] as const;
export type StudioMarketingStarter = typeof STARTERS[number];
export function resolveStudioMarketingStarter(value: unknown): StudioMarketingStarter | null {
  return typeof value === 'string' && STARTERS.some(starter => starter === value) ? value as StudioMarketingStarter : null;
}

/** A draft brief: the user reviews it and chooses when to send. */
export function studioMarketingStarterMessage(starter: unknown,locale: string): string {
  const key = resolveStudioMarketingStarter(starter);
  if (!key) return '';
  const messages = locale === 'fr' ? {
    'product-ad': 'Une scène produit calme au bord de l’eau. Aide-moi à affiner la lumière et à préparer un clip court. Présente le modèle, les réglages et le devis exact ; ne génère rien sans mon accord.',
    'storyboard-to-video': 'Aide-moi à transformer mon storyboard en vidéo.',
    'cinematic-scene': 'Aide-moi à créer une scène cinématographique.',
  } : locale === 'es' ? {
    'product-ad': 'Una escena de producto tranquila junto al agua. Ayúdame a definir la luz y preparar un clip corto. Muéstrame el modelo, los ajustes y el precio exacto; no generes hasta que lo apruebe.',
    'storyboard-to-video': 'Ayúdame a convertir mi storyboard en un video.',
    'cinematic-scene': 'Ayúdame a crear una escena cinematográfica.',
  } : {
    'product-ad': 'A quiet product scene by the water. Help me refine the light and prepare one short clip. Show me the model, settings and exact quote; do not generate until I approve.',
    'storyboard-to-video': 'Help me turn my storyboard into a video.',
    'cinematic-scene': 'Help me create a cinematic scene.',
  };
  return messages[key];
}
