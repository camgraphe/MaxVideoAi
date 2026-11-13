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
  engineId = 'kling-v4',
): Record<string, (ReferenceAsset | null)[]> {
  const active = engineId === 'kling-v4-flash'
    ? mode === 'i2v' ? ['image_url'] : mode === 'v2v' ? ['video_url', 'image_urls', 'video_urls'] : ACTIVE_FIELDS[mode] ?? []
    : ACTIVE_FIELDS[mode] ?? [];
  return Object.fromEntries(Object.entries(assets).filter(([field]) => active.includes(field)));
}

/** Auto is an editor choice: fal inherits source timing when duration is omitted. */
export function usesWorkspaceKlingFlashSourceDuration(engineId: string, mode: Mode | string, durationOption: unknown): boolean {
  return engineId === 'kling-v4-flash' && mode === 'v2v' && durationOption === 'auto';
}

/** Early editor feedback only. The server must resolve ownership and measured facts again. */
export function getWorkspaceKlingV4MediaError({ mode, inputAssets, klingElements, locale = 'en', engineId = 'kling-v4' }: {
  mode: Mode;
  engineId?: string;
  inputAssets: Record<string, (ReferenceAsset | null)[]>;
  klingElements: KlingElementState[];
  locale?: string;
}): string | null {
  const flash = engineId === 'kling-v4-flash';
  if (flash && !['t2v', 'i2v', 'ref2v', 'v2v'].includes(mode)) return 'Flash supports Create and Modify; Extend is unavailable.';
  if (flash && inputAssets.end_image_url?.some(Boolean)) return 'Flash does not support an ending frame. Remove it before generating.';
  if (mode !== 'ref2v' && !(flash && mode === 'v2v')) return null;
  const language = locale.toLowerCase().split('-')[0];
  const localized = (en: string, fr: string, es: string) => language === 'fr' ? fr : language === 'es' ? es : en;
  const flashModify = flash && mode === 'v2v';
  if (flashModify) {
    const sources = inputAssets.video_url?.filter(Boolean) ?? [];
    if (sources.length !== 1 || sources[0]?.kind !== 'video' || !sources[0].assetId?.trim()) return localized(
      'Flash Modify requires one source video saved in your media library.',
      'Flash Modify nécessite une vidéo source enregistrée dans votre bibliothèque.',
      'Flash Modify requiere un vídeo original guardado en tu biblioteca.',
    );
    const duration = sources[0].durationSec;
    if (typeof duration === 'number' && (!Number.isFinite(duration) || duration < 3 || duration > 20.05)) return localized(
      'Flash Modify source videos must be 3–20 seconds.',
      'Les vidéos sources Flash Modify doivent durer 3 à 20 secondes.',
      'Los vídeos originales de Flash Modify deben durar entre 3 y 20 segundos.',
    );
  }
  const referenceAssets = Object.values(getWorkspaceKlingV4ActiveAssets(mode, inputAssets, engineId)).flat().filter(Boolean);
  const subjectAssets = klingElements.flatMap((element) =>
    [element.frontal, ...element.references, element.video].filter(Boolean));
  if (flash && referenceAssets.length + subjectAssets.length > 15) return localized('Flash accepts at most 15 originals, including the source and subject views.', 'Flash accepte au plus 15 originaux, source et vues des sujets comprises.', 'Flash admite hasta 15 originales, incluidos el vídeo original y las vistas de sujetos.');
  if (flash && klingElements.some(element => typeof element.video?.durationSec === 'number'
    && (!Number.isFinite(element.video.durationSec) || element.video.durationSec < 3 || element.video.durationSec > 8.05))) return localized('Flash video subjects must be 3–8 seconds.', 'Les sujets vidéo Flash doivent durer 3 à 8 secondes.', 'Los sujetos de vídeo Flash deben durar entre 3 y 8 segundos.');
  const flatImageCount = referenceAssets.filter(asset => asset?.kind === 'image').length;
  const flatVideoCount = referenceAssets.filter(asset => asset?.kind === 'video').length;
  if (flatImageCount > 10) return localized(
    'Kling 4.0 allows up to ten flat images, including the opening image. Subject views have separate limits.',
    'Kling 4.0 accepte dix images de référence, image initiale comprise. Les vues des sujets ont leurs propres limites.',
    'Kling 4.0 admite diez imágenes de referencia, incluida la inicial. Las vistas de sujetos tienen límites propios.',
  );
  if (flatVideoCount > 5) return localized(
    flashModify ? 'Flash Modify allows up to four reference videos in addition to its source.' : 'Kling 4.0 allows up to five flat reference videos.',
    flashModify ? 'Flash Modify accepte quatre vidéos de référence en plus de la source.' : 'Kling 4.0 accepte cinq vidéos de référence.',
    flashModify ? 'Flash Modify admite cuatro vídeos de referencia además del original.' : 'Kling 4.0 admite cinco vídeos de referencia.',
  );
  const knownVideoSeconds = [...referenceAssets, ...subjectAssets].reduce((sum, asset) =>
    sum + (asset?.kind === 'video' && typeof asset.durationSec === 'number' && Number.isFinite(asset.durationSec) ? asset.durationSec : 0), 0);
  if (knownVideoSeconds > (flash ? 20 : 30)) {
    return localized(
      `${flashModify ? 'The source, reference videos' : 'Kling reference videos'} and video subjects share a ${flash ? 20 : 30}-second total limit.`,
      `${flashModify ? 'La source, les vidéos de référence' : 'Les vidéos de référence'} et les sujets vidéo partagent une limite totale de ${flash ? 20 : 30} secondes.`,
      `${flashModify ? 'El original, los vídeos de referencia' : 'Los vídeos de referencia'} y los sujetos de vídeo comparten un límite total de ${flash ? 20 : 30} segundos.`,
    );
  }
  return null;
}
