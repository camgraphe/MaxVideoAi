import { getCurationAliases } from './curation-store';
import { expandCatalogAliases } from './curation-eligibility';
import { getExamplesHubPlaylistSlug } from './slugs';

export const usesCatalogCurationAliases = (slug: string) =>
  slug === getExamplesHubPlaylistSlug() || slug.startsWith('family-');

/** Admin selection must cover the destination reader, while direct model semantics stay intact. */
export function getCurationCandidateAliases(slug: string): string[] | null {
  const aliases = getCurationAliases(slug);
  if (!aliases) return null;
  return usesCatalogCurationAliases(slug) ? expandCatalogAliases(aliases) : aliases.map(alias => alias.toLowerCase());
}
