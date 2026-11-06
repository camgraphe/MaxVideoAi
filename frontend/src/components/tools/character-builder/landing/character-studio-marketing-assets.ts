/** Independent image display copies; provenance and byte sizes live in docs/redesign/2026-11-05-character-studio-marketing. */
const ROOT = '/assets/tools/character-studio/marketing';
export const CHARACTER_STUDIO_ART = {
  dixie: `${ROOT}/dixie.webp`,
  dixiePop: `${ROOT}/dixie-pop.webp`,
  vesper: `${ROOT}/vesper.webp`,
  marcel: `${ROOT}/marcel.webp`,
  dixieRecast: `${ROOT}/dixie-recast.webp`,
  vesperRecast: `${ROOT}/vesper-recast.webp`,
  portrait: '/assets/tools/redesign/character-portrait-v1.webp',
  sheet: '/assets/tools/redesign/character-sheet-v1.webp',
} as const;

export type CharacterStudioMarketingFilm = { key: 'dixie' | 'vesper'; video: string; poster: string };
