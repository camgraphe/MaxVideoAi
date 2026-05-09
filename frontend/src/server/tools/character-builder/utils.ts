import type {
  CharacterBuilderAction,
  CharacterBuilderOutputMode,
  CharacterBuilderQualityMode,
  CharacterBuilderReferenceImage,
} from '@/types/character-builder';

export function trimString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function collectReferenceImages(
  referenceImages: CharacterBuilderReferenceImage[],
  role: CharacterBuilderReferenceImage['role']
): CharacterBuilderReferenceImage[] {
  return referenceImages.filter((image) => image.role === role && /^https?:\/\//i.test(image.url));
}

export function getAspectRatio(
  outputMode: CharacterBuilderOutputMode,
  action: CharacterBuilderAction,
  fullBodyRequired: boolean,
  includeCloseUps: boolean
): string {
  if (action === 'full-body-fix') return '2:3';
  if (outputMode === 'portrait-reference') return '16:9';
  if (outputMode === 'character-sheet' && includeCloseUps) return '16:9';
  if (outputMode === 'character-sheet') return '3:2';
  return fullBodyRequired ? '2:3' : '4:5';
}

export function buildInputMode(input: { action: CharacterBuilderAction }, imageUrls: string[]): 't2i' | 'i2i' {
  if (input.action !== 'generate') {
    return 'i2i';
  }
  return imageUrls.length > 0 ? 'i2i' : 't2i';
}

export function buildImageUrls(input: {
  action: CharacterBuilderAction;
  selectedResultUrl?: string | null;
  pinnedReferenceResultUrl?: string | null;
  referenceImages: CharacterBuilderReferenceImage[];
}): string[] {
  const urls: string[] = [];

  if (input.action !== 'generate') {
    const selectedUrl = trimString(input.selectedResultUrl);
    const pinnedUrl = trimString(input.pinnedReferenceResultUrl);
    if (selectedUrl) urls.push(selectedUrl);
    if (pinnedUrl && pinnedUrl !== selectedUrl) urls.push(pinnedUrl);
  }

  for (const image of input.referenceImages) {
    const url = trimString(image.url);
    if (url) urls.push(url);
  }

  return uniqueStrings(urls).slice(0, 4);
}

export function getEngineLabel(engineId: string): string {
  return engineId === 'nano-banana-pro' ? 'Nano Banana Pro' : 'Nano Banana 2';
}

export function getBillingProductKey(qualityMode: CharacterBuilderQualityMode): string {
  return qualityMode === 'final' ? 'character-final' : 'character-draft';
}
