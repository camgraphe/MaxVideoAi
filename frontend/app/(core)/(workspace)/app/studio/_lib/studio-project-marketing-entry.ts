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
    'product-ad': 'Aide-moi à créer une publicité pour mon produit.',
    'storyboard-to-video': 'Aide-moi à transformer mon storyboard en vidéo.',
    'cinematic-scene': 'Aide-moi à créer une scène cinématographique.',
  } : {
    'product-ad': 'Help me create an ad for my product.',
    'storyboard-to-video': 'Help me turn my storyboard into a video.',
    'cinematic-scene': 'Help me create a cinematic scene.',
  };
  return messages[key];
}
