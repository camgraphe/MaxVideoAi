import type { AssetBrowserAsset } from '../../../frontend/components/library/AssetLibraryBrowser';
export type DemoAsset = AssetBrowserAsset & { name: string; favorite: boolean; trashed: boolean; collections: string[]; saved: boolean };
export type Collection = { id: string; name: string };
export const sources = { all: 'Toutes les provenances', upload: 'Imports', generated: 'Générations', storyboard: 'Storyboard', character: 'Character', angle: 'Angle', upscale: 'Upscale' };
export const initialCollections: Collection[] = [{id:'film',name:'Film · Lumière d’été'}, {id:'brand',name:'Campagne Atelier'}, {id:'casting',name:'Casting & personnages'}, {id:'ideas',name:'À explorer'}];
const samples = [
  ['Plan 01 · Le départ', 'video', 'generated', 'app-starters/night-shift-9f91929fe7da.webp', 16, 9],
  ['Portrait · Éléonore', 'image', 'character', 'tools/character-studio/marketing/dixie-recast.webp', 9, 16],
  ['Studio · Lumière bleue', 'image', 'upload', 'app-starters/acid-portrait-f5440c7f5eb0.webp', 1, 1],
  ['Storyboard · Rencontre', 'image', 'storyboard', 'tools/angle-example-storyboard-output.webp', 16, 9],
  ['Angle · Contrechamp', 'image', 'angle', 'tools/angle-orbit-hero-dialogue-reverse.webp', 16, 9],
  ['Échantillon · Ambiance', 'audio', 'upload', null, 0, 0],
  ['Plan 02 · Disco motel', 'video', 'generated', 'app-starters/disco-motel-0b809fbcec19.webp', 16, 9],
  ['Produit · Collection été', 'image', 'upscale', 'model-examples/luma-uni-1-max/hero-product.webp', 1, 1],
  ['Composition · Une pause', 'image', 'angle', 'tools/angle-orbit-story-elevated.webp', 16, 9],
  ['Personnage · Silhouette', 'image', 'character', 'tools/character-studio/marketing/vesper-recast.webp', 9, 16],
  ['Voix · Séquence 01', 'audio', 'generated', null, 0, 0],
  ['Plan 03 · Conversation', 'video', 'storyboard', 'tools/angle-orbit-hero-dialogue-source.webp', 16, 9],
] as const;
export function makeAssets(count: number): DemoAsset[] {
  return Array.from({ length: count }, (_, index) => {
    const [name, kind, source, path, w, h] = samples[index % samples.length];
    const id = `demo-${index + 1}`;
    return {id, name: index < samples.length ? name : `${name} · ${index + 1}`, kind, source,
      url: `/originals/${id}.${kind === 'image' ? 'png' : kind === 'video' ? 'mp4' : 'wav'}`,
      thumbUrl: path ? `/assets/${path}` : null, width: w * 120, height: h * 120,
      durationSec: kind === 'image' ? undefined : kind === 'audio' ? 24 : 8,
      favorite: index % 5 === 0, trashed: index >= count - 3,
      collections: index % 3 === 0 ? ['film'] : index % 3 === 1 ? ['casting'] : ['brand'],
      saved: index % 4 !== 0, createdAt: new Date(Date.UTC(2026, 10, 9) - index * 3600_000).toISOString(),
    };
  });
}
export type Scope = { kind: 'all' | 'image' | 'video' | 'audio'; source: string; view: string; sort: string; folder: string; query: string; compatibility: string };
export const defaultScope: Scope = { kind: 'all', source: 'all', view: 'all', sort: 'recent', folder: 'all', query: '', compatibility: 'compatible' };
export function filterAssets(assets: DemoAsset[], scope: Scope, picker = false) {
  const q = scope.query.toLocaleLowerCase('fr').trim();
  return assets.filter(a => (scope.folder === 'trash' ? a.trashed : !a.trashed)
    && (scope.folder === 'all' || scope.folder === 'trash' || (scope.folder === 'favorites' ? a.favorite : a.collections.includes(scope.folder)))
    && (scope.kind === 'all' || a.kind === scope.kind)
    && (scope.source === 'all' || a.source === scope.source)
    && (scope.view === 'all' || (scope.view === 'saved' ? a.saved : !a.saved))
    && (!q || `${a.name} ${a.source} ${a.width}x${a.height}`.toLocaleLowerCase('fr').includes(q))
    && (!picker || scope.compatibility === 'all' || isEligible(a)))
    .sort((a, b) => scope.sort === 'name' ? a.name.localeCompare(b.name, 'fr') : scope.sort === 'oldest' ? a.createdAt!.localeCompare(b.createdAt!) : b.createdAt!.localeCompare(a.createdAt!));
}
export const isEligible = (asset: DemoAsset) => asset.kind === 'image';
export const kindLabels = { all: 'Tout', image: 'Images', video: 'Vidéos', audio: 'Audio' };
