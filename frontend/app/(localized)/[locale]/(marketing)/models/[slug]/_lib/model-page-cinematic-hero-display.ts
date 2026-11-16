import manifest from '@/config/model-cinematic-hero-displays.json';
import type { CinematicAsset } from './model-page-cinematic-data';

/** Prepared display bytes only. Downloads, editing references and schema keep the exact original. */
export function resolveCinematicHeroDisplay(hero: CinematicAsset) {
  const record = manifest.assets.find(asset => asset.id === hero.id);
  if (!record || record.originalSha256 !== hero.original.sha256) throw new Error('Cinematic hero needs its reviewed display profile');
  const srcSet = (files: typeof record.desktop) => files.map(file => `${file.url} ${file.width}w`).join(', ');
  return { desktop: srcSet(record.desktop), mobile: srcSet(record.mobile) };
}
