import type { KlingElementState } from '@/components/KlingElementsBuilder';
import type { Mode } from '@/types/engines';
import type { ReferenceAsset } from './workspace-assets';

const ACTIVE_FIELDS: Partial<Record<Mode, readonly string[]>> = {
  t2v: [],
  i2v: ['image_url', 'end_image_url'],
  ref2v: ['image_url', 'image_urls', 'video_urls'],
  v2v: ['video_url', 'image_urls'],
};

/** Keep inactive V4 media in the draft without submitting another mode's source. */
export function getWorkspaceKlingV4ActiveAssets(
  mode: Mode,
  assets: Record<string, (ReferenceAsset | null)[]>,
): Record<string, (ReferenceAsset | null)[]> {
  const active = ACTIVE_FIELDS[mode] ?? [];
  return Object.fromEntries(Object.entries(assets).filter(([field]) => active.includes(field)));
}

/** Early editor feedback only. The server must resolve ownership and measured facts again. */
export function getWorkspaceKlingV4MediaError({ mode, inputAssets, klingElements }: {
  mode: Mode;
  inputAssets: Record<string, (ReferenceAsset | null)[]>;
  klingElements: KlingElementState[];
}): string | null {
  if (mode !== 'ref2v') return null;
  const referenceAssets = Object.values(getWorkspaceKlingV4ActiveAssets(mode, inputAssets)).flat().filter(Boolean);
  const subjectAssets = klingElements.flatMap((element) =>
    [element.frontal, ...element.references, element.video].filter(Boolean));
  // Conservative launch limit: each visual occurrence, including every subject view, counts.
  // Precise provider counting is a qualification prerequisite, not inferred from schema maxima.
  if (referenceAssets.length + subjectAssets.length > 15) {
    return 'Kling 4.0 currently allows at most 15 visual assets, counting each subject view and each reference occurrence. Remove assets before generating.';
  }
  const knownVideoSeconds = [...referenceAssets, ...subjectAssets].reduce((sum, asset) =>
    sum + (asset?.kind === 'video' && typeof asset.durationSec === 'number' && Number.isFinite(asset.durationSec) ? asset.durationSec : 0), 0);
  if (knownVideoSeconds > 30) {
    return 'Kling 4.0 reference videos and video subjects share a 30-second total limit.';
  }
  return null;
}
