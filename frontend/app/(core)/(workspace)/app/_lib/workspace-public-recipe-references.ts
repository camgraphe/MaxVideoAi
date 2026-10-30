import type { saveAssetToLibrary } from '@/lib/api-assets';
import type { ResolvedVideoSettingsSnapshot } from './workspace-video-settings';

export type PublicRecipeReferences = Pick<ResolvedVideoSettingsSnapshot, 'inputAssets' | 'klingElements'>;
type SaveReference = (payload: Parameters<typeof saveAssetToLibrary>[0]) => ReturnType<typeof saveAssetToLibrary>;

export function publicReferenceImportCopy(locale: string, guest: boolean): string {
  return locale === 'fr'
    ? guest ? 'Connectez-vous pour importer les références de cet exemple et calculer son prix actuel.'
      : 'Impossible d’importer les références de cet exemple. Sélectionnez de nouveau l’exemple ou remplacez ses médias avant de générer.'
    : locale === 'es'
      ? guest ? 'Inicia sesión para importar las referencias de este ejemplo y calcular su precio actual.'
        : 'No se pudieron importar las referencias de este ejemplo. Selecciona el ejemplo de nuevo o sustituye sus medios antes de generar.'
      : guest ? 'Sign in to import this example’s references and calculate its current price.'
        : 'Unable to import this example’s references. Select the example again or replace its media before generating.';
}

/** Only the media-library server can issue the visitor's owned identities. */
export async function importPublicRecipeReferences(
  resolved: ResolvedVideoSettingsSnapshot,
  save: SaveReference | null,
  isCurrent: () => boolean,
): Promise<PublicRecipeReferences> {
  // These operations require a qualified personal generation, never a public clip import.
  if ((resolved.engine.id === 'luma-ray-3-2' && resolved.mode === 'extend')
    || resolved.formValues.operation === 'flux-draft-enhance') {
    return { inputAssets: {}, klingElements: [] };
  }
  const imports = new Map<string, ReturnType<SaveReference>>();
  async function attach<T extends { url?: string; kind: 'image' | 'video' | 'audio'; name: string; durationSec?: number | null }>(asset: T | null): Promise<T | null> {
    if (!asset?.url) return asset;
    if (!isCurrent()) throw new DOMException('Recall cancelled', 'AbortError');
    if (!save) throw new Error('PUBLIC_REFERENCE_SIGN_IN');
    const key = `${asset.kind}:${asset.url}`;
    let pending = imports.get(key);
    if (!pending) {
      pending = save({ url: asset.url, kind: asset.kind, label: asset.name, source: 'import',
        durationSec: asset.durationSec ?? null });
      imports.set(key, pending);
    }
    const owned = await pending;
    if (!isCurrent()) throw new DOMException('Recall cancelled', 'AbortError');
    if (!owned.id?.trim() || !owned.url?.trim()) throw new Error('PUBLIC_REFERENCE_UNAVAILABLE');
    return { ...asset, assetId: owned.id, url: owned.url, previewUrl: owned.url, status: 'ready',
      width: owned.width ?? (asset as { width?: number | null }).width,
      height: owned.height ?? (asset as { height?: number | null }).height,
      size: owned.size ?? (asset as { size?: number | null }).size,
      type: owned.mime ?? (asset as { type?: string | null }).type,
      durationSec: owned.durationSec ?? asset.durationSec };
  }
  const inputAssets = resolved.inputAssets ? Object.fromEntries(await Promise.all(
    Object.entries(resolved.inputAssets).map(async ([field, assets]) => [field, await Promise.all(assets.map(attach))]),
  )) : null;
  const klingElements = resolved.klingElements ? await Promise.all(resolved.klingElements.map(async element => ({
    ...element, frontal: await attach(element.frontal), video: await attach(element.video),
    references: await Promise.all(element.references.map(attach)),
  }))) : null;
  return { inputAssets, klingElements };
}
