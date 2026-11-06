import { getCharacterStudioMarketingVideos } from '@/server/character-studio/marketing-demos';
import { CharacterStudioRecastExamples } from './CharacterStudioRecastExamples.client';

/** Optional streamed proof; gallery identities and pricing remain with their existing owners. */
export async function CharacterStudioPublicFilms({ locale, excludedVideoUrls = [], showLink = false, showStills = false, ctaLocation }: {
  locale?: string;
  excludedVideoUrls?: readonly string[];
  showLink?: boolean;
  showStills?: boolean;
  ctaLocation?: string;
}) {
  const excluded = new Set(excludedVideoUrls);
  const films = (await getCharacterStudioMarketingVideos()).filter(film => !excluded.has(film.video));
  return films.length || showStills ? <CharacterStudioRecastExamples films={films} locale={locale} showLink={showLink} showStills={showStills} ctaLocation={ctaLocation} /> : null;
}
