import type { KlingElementState } from '@/components/KlingElementsBuilder';
import type { Mode } from '@/types/engines';
import type { ReferenceAsset } from './workspace-assets';

const ACTIVE_FIELDS: Partial<Record<Mode, readonly string[]>> = {
  t2v: [],
  i2v: ['image_url', 'end_image_url'],
  ref2v: ['image_url', 'image_urls', 'video_urls'],
  v2v: ['video_url', 'image_urls'],
};

/** Create infers the provider mode; a Modify source is never a creation reference. */
export function resolveKlingV4CreateMode(assets: Record<string, (ReferenceAsset | null)[]>, elements: KlingElementState[]): Mode {
  if (['image_urls', 'video_urls'].some(id => assets[id]?.some(Boolean))
    || elements.some(element => element.frontal || element.video || element.references.some(Boolean))) return 'ref2v';
  if (['image_url', 'end_image_url'].some(id => assets[id]?.some(Boolean))) return 'i2v';
  return 't2v';
}

/** Keep inactive V4 media in the draft without submitting another mode's source. */
export function getWorkspaceKlingV4ActiveAssets(
  mode: Mode,
  assets: Record<string, (ReferenceAsset | null)[]>,
): Record<string, (ReferenceAsset | null)[]> {
  const active = ACTIVE_FIELDS[mode] ?? [];
  return Object.fromEntries(Object.entries(assets).filter(([field]) => active.includes(field)));
}

/** Early editor feedback only. The server must resolve ownership and measured facts again. */
export function getWorkspaceKlingV4MediaError({ mode, inputAssets, klingElements, locale = 'en' }: {
  mode: Mode;
  inputAssets: Record<string, (ReferenceAsset | null)[]>;
  klingElements: KlingElementState[];
  locale?: string;
}): string | null {
  if (mode !== 'ref2v') return null;
  const language = locale.toLowerCase().split('-')[0];
  const localized = (en: string, fr: string, es: string) => language === 'fr' ? fr : language === 'es' ? es : en;
  const referenceAssets = Object.values(getWorkspaceKlingV4ActiveAssets(mode, inputAssets)).flat().filter(Boolean);
  const subjectAssets = klingElements.flatMap((element) =>
    [element.frontal, ...element.references, element.video].filter(Boolean));
  const flatImageCount = referenceAssets.filter(asset => asset?.kind === 'image').length;
  const flatVideoCount = referenceAssets.filter(asset => asset?.kind === 'video').length;
  if (flatImageCount > 10) return localized(
    'Kling 4.0 allows up to ten flat images, including the opening image. Subject views have separate limits.',
    'Kling 4.0 accepte dix images de référence, image initiale comprise. Les vues des sujets ont leurs propres limites.',
    'Kling 4.0 admite diez imágenes de referencia, incluida la inicial. Las vistas de sujetos tienen límites propios.',
  );
  if (flatVideoCount > 5) return localized(
    'Kling 4.0 allows up to five flat reference videos.',
    'Kling 4.0 accepte cinq vidéos de référence.',
    'Kling 4.0 admite cinco vídeos de referencia.',
  );
  const knownVideoSeconds = [...referenceAssets, ...subjectAssets].reduce((sum, asset) =>
    sum + (asset?.kind === 'video' && typeof asset.durationSec === 'number' && Number.isFinite(asset.durationSec) ? asset.durationSec : 0), 0);
  if (knownVideoSeconds > 30) {
    return localized(
      'Kling 4.0 reference videos and video subjects share a 30-second total limit.',
      'Les vidéos de référence et les sujets vidéo Kling 4.0 partagent une limite totale de 30 secondes.',
      'Los vídeos de referencia y los sujetos de vídeo Kling 4.0 comparten un límite total de 30 segundos.',
    );
  }
  return null;
}
