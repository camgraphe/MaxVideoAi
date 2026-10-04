/** An adopted gallery owns its entire order; static marketing preferences are legacy-only. */
export async function finalizeModelGallery<
  T extends { id: string; aspectRatio?: string | null; videoUrl?: string | null },
>(options: {
  managed: boolean;
  cards: T[];
  featuredIds: string[];
  preferredIds: string[];
  preferLandscape: boolean;
  fetchCards: (ids: string[]) => Promise<T[]>;
}): Promise<T[]> {
  if (options.managed) return options.cards;
  let cards = options.cards;
  const existing = new Map(cards.map((card) => [card.id, card]));
  const featuredMissing = options.featuredIds.filter((id) => !existing.has(id));
  const fetched = new Map(
    (featuredMissing.length ? await options.fetchCards(featuredMissing) : []).map((card) => [card.id, card]),
  );
  const featured = options.featuredIds.flatMap((id) => existing.get(id) ?? fetched.get(id) ?? []);
  if (featured.length) cards = [...featured, ...cards.filter((card) => !options.featuredIds.includes(card.id))];
  const preferredMissing = options.preferredIds.filter((id) => !cards.some((card) => card.id === id));
  if (preferredMissing.length) {
    const preferred = new Map((await options.fetchCards(preferredMissing)).map((card) => [card.id, card]));
    cards = [
      ...cards,
      ...options.preferredIds.flatMap((id) => (cards.some((card) => card.id === id) ? [] : (preferred.get(id) ?? []))),
    ];
  }
  if (options.preferLandscape) {
    const score = (card: T) => ((card.aspectRatio ?? '').trim().startsWith('16:9') ? 0 : 2) + (card.videoUrl ? 0 : 1);
    cards = [...cards].sort((a, b) => score(a) - score(b));
  }
  return cards;
}
