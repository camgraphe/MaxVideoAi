import type { AssetBrowserAsset } from '../../../frontend/components/library/AssetLibraryBrowser';
export type DemoAsset = AssetBrowserAsset & { name: string; userLabel?: string; prompt?: string; model?: string; favorite: boolean; trashed: boolean; collections: string[]; saved: boolean };
export type Collection = { id: string; name: string };
export const sources = { all: 'Toutes les provenances', upload: 'Imports', generated: 'Générations', storyboard: 'Storyboard', character: 'Character', angle: 'Angle', upscale: 'Upscale' };
export const initialCollections: Collection[] = [{id:'film',name:'Film · Lumière d’été'}, {id:'brand',name:'Campagne Atelier'}, {id:'casting',name:'Casting & personnages'}, {id:'ideas',name:'À explorer'}];
const samples = [
  ['Plan 01 · Le départ', 'video', 'generated', 'app-starters/night-shift-9f91929fe7da.webp', 1024, 1024],
  ['Portrait · Éléonore', 'image', 'character', 'tools/character-studio/marketing/dixie-recast.webp', 720, 1280],
  ['Studio · Lumière bleue', 'image', 'upload', 'app-starters/acid-portrait-f5440c7f5eb0.webp', 1024, 1024],
  ['Storyboard · Rencontre', 'image', 'storyboard', 'tools/angle-example-storyboard-output.webp', 640, 357],
  ['Angle · Contrechamp', 'image', 'angle', 'tools/angle-orbit-hero-dialogue-reverse.webp', 1600, 1200],
  ['Échantillon · Ambiance', 'audio', 'upload', null, 0, 0],
  ['Plan 02 · Disco motel', 'video', 'generated', 'app-starters/disco-motel-0b809fbcec19.webp', 1024, 1024],
  ['Produit · Collection été', 'image', 'upscale', 'model-examples/luma-uni-1-max/hero-product.webp', 2464, 1696],
  ['Composition · Une pause', 'image', 'angle', 'tools/angle-orbit-story-elevated.webp', 1600, 1200],
  ['Personnage · Silhouette', 'image', 'character', 'tools/character-studio/marketing/vesper-recast.webp', 720, 1280],
  ['Voix · Séquence 01', 'audio', 'generated', null, 0, 0],
  ['Plan 03 · Conversation', 'video', 'storyboard', 'tools/angle-orbit-hero-dialogue-source.webp', 1600, 1200],
  ['Portrait généré', 'image', 'generated', 'app-starters/acid-portrait-f5440c7f5eb0.webp', 1024, 1024],
] as const;
const prompts = [
  'Un raton laveur dans une ruelle de nuit, lumières colorées et vapeur.',
  'Une danseuse en studio, tenue rose, cadrage en pied et lumière douce.',
  'Portrait rapproché d’une femme avec une bulle de chewing-gum verte.',
  'Deux personnages échangent au bord d’une voie ferrée, plan en hauteur.',
  'Conversation au café, un homme et une femme en champ contrechamp.',
  'Ambiance électro funk, basse ronde, batterie précise et rythme souple.',
  'Un motel désertique, piscine et lumière de fin de journée.',
  'Photographie de produit : flacon blanc sur fond clair, ombre douce.',
  'Un homme attend sur le quai d’une gare, cadrage frontal.',
  'Une femme en manteau rose dans une rue, plan entier en lumière naturelle.',
  'Voix parlée claire, ton chaleureux, phrase courte pour une introduction.',
  'Dialogue au café, continuité des regards et caméra stable.',
  'Portrait d’une femme avec un chewing-gum vert, fond rouge et cadrage serré.',
];
const dayFormatter = new Intl.DateTimeFormat('fr',{day:'numeric',month:'short',timeZone:'Europe/Madrid'});
const hourFormatter = new Intl.DateTimeFormat('fr',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Madrid'});
const shortSources:Record<string,string> = {upload:'Import',generated:'Génération',storyboard:'Storyboard',character:'Character',angle:'Angle',upscale:'Upscale'};
/** Facts from the media record, never a guessed image description or an invented generation title. */
export function displayMediaLabel(asset: Pick<DemoAsset,'userLabel'|'model'|'source'|'kind'|'createdAt'>) {
  if(asset.userLabel?.trim())return asset.userLabel.trim();
  const context = asset.model || shortSources[asset.source??''] || {image:'Image',video:'Vidéo',audio:'Audio'}[asset.kind];
  const date=asset.createdAt?new Date(asset.createdAt):null;
  return date?`${context} · ${dayFormatter.format(date)} ${hourFormatter.format(date)}`:context;
}
export function makeAssets(count: number): DemoAsset[] {
  return Array.from({ length: count }, (_, index) => {
    const [name, kind, source, path, w, h] = samples[index % samples.length];
    const id = `demo-${index + 1}`;
    return {id, name: source==='generated'?'Média':kind==='video'?'video-excerpt.mp4':kind==='audio'?`audio-${index+1}.wav`:`${source}-output-${String(index+1).padStart(8,'0')}.png`, kind, source,
      userLabel:index===7?'Campagne Atelier · Produit':undefined,
      prompt:source==='upload'?undefined:prompts[index%samples.length],
      model:source==='generated'?(kind==='video'?'Kling 4':kind==='audio'?'Audio · Démo':'GPT Image 2.6'):undefined,
      url: `/originals/${id}.${kind === 'image' ? 'png' : kind === 'video' ? 'mp4' : 'wav'}`,
      thumbUrl: path ? `/assets/${path}` : null, width: w, height: h,
      durationSec: kind === 'image' ? undefined : kind === 'audio' ? 24 : 8,
      favorite: index % 5 === 0, trashed: index >= count - 3,
      collections: index % 3 === 0 ? ['film'] : index % 3 === 1 ? ['casting'] : ['brand'],
      saved: index % 4 !== 0, createdAt: new Date(Date.UTC(2026, 10, 9,15,23) - index * 45*60_000).toISOString(),
    };
  });
}
export type Scope = { kind: 'all' | 'image' | 'video' | 'audio'; source: string; view: string; sort: string; folder: string; query: string; compatibility: string; model:string; period:string };
export const defaultScope: Scope = { kind: 'all', source: 'all', view: 'all', sort: 'recent', folder: 'all', query: '', compatibility: 'compatible',model:'all',period:'all' };
export function filterAssets(assets: DemoAsset[], scope: Scope, picker = false) {
  const q = scope.query.toLocaleLowerCase('fr').trim();
  return assets.filter(a => (scope.folder === 'trash' ? a.trashed : !a.trashed)
    && (scope.folder === 'all' || scope.folder === 'trash' || (scope.folder === 'favorites' ? a.favorite : a.collections.includes(scope.folder)))
    && (scope.kind === 'all' || a.kind === scope.kind)
    && (scope.source === 'all' || a.source === scope.source)
    && (scope.view === 'all' || (scope.view === 'saved' ? a.saved : !a.saved))
    && (scope.model==='all'||(scope.model==='unknown'?!a.model:a.model===scope.model))
    && (scope.period==='all'||!a.createdAt||(Date.parse(a.createdAt)>=(scope.period==='today'?Date.UTC(2026,10,8,23):Date.UTC(2026,10,9,22)-Number(scope.period)*86400_000)))
    && (!q || `${a.name} ${a.userLabel??''} ${a.prompt??''} ${a.model??''} ${a.source} ${displayMediaLabel(a)} ${a.width}x${a.height}`.toLocaleLowerCase('fr').includes(q))
    && (!picker || scope.compatibility === 'all' || isEligible(a)))
    .sort((a, b) => scope.sort === 'name' ? (a.userLabel||a.name).localeCompare(b.userLabel||b.name, 'fr') : scope.sort === 'oldest' ? a.createdAt!.localeCompare(b.createdAt!) : b.createdAt!.localeCompare(a.createdAt!));
}
export const isEligible = (asset: DemoAsset) => asset.kind === 'image';
export const kindLabels = { all: 'Tout', image: 'Images', video: 'Vidéos', audio: 'Audio' };
