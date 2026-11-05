import { getCharacterStudioMarketingVideos } from '@/server/character-studio/marketing-demos';
import { CharacterStudioRecastExamples } from './CharacterStudioRecastExamples.client';

/** Optional streamed proof; gallery identities and pricing remain with their existing owners. */
export async function CharacterStudioPublicFilms({ locale, excludedVideoUrls = [], showLink = false }: {
  locale?: string;
  excludedVideoUrls?: readonly string[];
  showLink?: boolean;
}) {
  const excluded = new Set(excludedVideoUrls);
  const films = (await getCharacterStudioMarketingVideos()).filter(film => !excluded.has(film.video));
  return films.length ? <CharacterStudioRecastExamples films={films} locale={locale} showLink={showLink} /> : null;
}
