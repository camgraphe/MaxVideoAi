import type { ModelGalleryCard, ModelsGalleryEngineType } from './models-gallery-types';

export type ModelsGalleryFilterState = {
  selectedEngineType: ModelsGalleryEngineType;
  searchQuery: string;
  selectedAge: string;
  selectedDuration: string;
  selectedFormat: string;
  selectedMode: string;
  selectedPrice: string;
};

export function hasActiveModelsGalleryFilters(state: ModelsGalleryFilterState) {
  return (
    state.selectedMode !== 'all' ||
    state.selectedFormat !== 'all' ||
    state.selectedDuration !== 'all' ||
    state.selectedPrice !== 'all' ||
    state.selectedAge !== 'latest' ||
    state.searchQuery.trim().length > 0
  );
}

export function filterModelGalleryCards(
  cards: ModelGalleryCard[],
  state: ModelsGalleryFilterState,
  hasActiveFilters: boolean
) {
  const normalizedQuery = state.searchQuery.trim().toLowerCase();
  return cards.filter((card) => {
    const meta = card.filterMeta;
    if (!meta) return !hasActiveFilters && state.selectedEngineType === 'all';
    if (state.selectedEngineType !== 'all') {
      if (state.selectedEngineType === 'audio') {
        if (!meta.audio && !meta.lipSync) return false;
      } else if (state.selectedEngineType === 'preparation') {
        if (meta.engineType !== 'preparation') return false;
      } else if (meta.engineType !== state.selectedEngineType) {
        return false;
      }
    }
    if (normalizedQuery) {
      const haystack = [
        card.label,
        card.provider,
        card.description,
        ...(card.strengths ?? []),
        ...(card.capabilities ?? []),
        card.stats?.priceFrom,
        card.stats?.maxDuration,
        card.stats?.maxResolution,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(normalizedQuery)) return false;
    }
    if (state.selectedMode !== 'all') {
      if (state.selectedMode === 'audio') {
        if (!meta.audio) return false;
      } else if (!meta[state.selectedMode as keyof typeof meta]) {
        return false;
      }
    }
    if (state.selectedFormat !== 'all') {
      if (!meta.maxResolution) return false;
      const threshold = Number(state.selectedFormat);
      if (meta.maxResolution == null || meta.maxResolution < threshold) return false;
    }
    if (state.selectedDuration !== 'all') {
      if (!meta.maxDuration) return false;
      if (state.selectedDuration === '8' && meta.maxDuration > 8) return false;
      if (state.selectedDuration === '10-15' && (meta.maxDuration < 10 || meta.maxDuration > 15)) return false;
      if (state.selectedDuration === '20' && meta.maxDuration < 20) return false;
    }
    if (state.selectedPrice !== 'all') {
      if (meta.priceFrom == null) return false;
      if (state.selectedPrice === 'cheap' && meta.priceFrom > 0.08) return false;
      if (state.selectedPrice === 'mid' && !(meta.priceFrom > 0.08 && meta.priceFrom <= 0.2)) return false;
      if (state.selectedPrice === 'premium' && meta.priceFrom <= 0.2) return false;
    }
    if (state.selectedAge !== 'all') {
      const isLegacy = Boolean(meta.legacy);
      if (state.selectedAge === 'latest' && isLegacy) return false;
      if (state.selectedAge === 'legacy' && !isLegacy) return false;
    }
    return true;
  });
}

function compareNumbers(a?: number | null, b?: number | null, direction: 'asc' | 'desc' = 'desc') {
  const aVal = typeof a === 'number' ? a : direction === 'asc' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
  const bVal = typeof b === 'number' ? b : direction === 'asc' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
  return direction === 'asc' ? aVal - bVal : bVal - aVal;
}

export function sortModelGalleryCards(cards: ModelGalleryCard[], selectedSort: string) {
  const sortable = [...cards];
  switch (selectedSort) {
    case 'score':
      sortable.sort((a, b) => compareNumbers(a.overallScore ?? null, b.overallScore ?? null, 'desc'));
      break;
    case 'price':
      sortable.sort((a, b) => compareNumbers(a.filterMeta?.priceFrom ?? null, b.filterMeta?.priceFrom ?? null, 'asc'));
      break;
    case 'duration':
      sortable.sort((a, b) => compareNumbers(a.filterMeta?.maxDuration ?? null, b.filterMeta?.maxDuration ?? null, 'desc'));
      break;
    case 'resolution':
      sortable.sort((a, b) => compareNumbers(a.filterMeta?.maxResolution ?? null, b.filterMeta?.maxResolution ?? null, 'desc'));
      break;
    case 'name':
      sortable.sort((a, b) => a.label.localeCompare(b.label));
      break;
    default:
      break;
  }
  return sortable;
}
