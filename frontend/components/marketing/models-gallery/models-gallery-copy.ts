import type { SelectOption } from '@/components/ui/SelectMenu';
import type {
  GalleryFilterKey,
  ModelsGalleryEngineType,
  ModelsGalleryCompareBarCopy,
  ModelsGalleryCardActionsCopy,
  ModelsGalleryCopy,
  ModelsGalleryStatsLabels,
} from './models-gallery-types';

type FilterCopy = NonNullable<ModelsGalleryCopy['filters']>;

const DEFAULT_STATS_LABELS: ModelsGalleryStatsLabels = {
  from: 'From',
  maxDurShort: 'Max dur.',
  maxDurLong: 'Max duration',
  maxResShort: 'Max res.',
  maxResLong: 'Max resolution',
  typeShort: 'Type',
  typeLong: 'Type',
};

const DEFAULT_COMPARE_BAR: ModelsGalleryCompareBarCopy = {
  selectedTemplate: 'Selected: {left} + {right}',
  selectTwo: 'Select two engines to compare',
  clear: 'Clear',
  compare: 'Compare',
};

const DEFAULT_CARD_ACTIONS: ModelsGalleryCardActionsCopy = {
  viewSpecs: 'View specs',
  viewSpecsAria: 'View specs for {engine}',
  compare: 'Compare',
  compareAria: 'Compare {engine}',
  examples: 'Examples',
  examplesAria: 'View examples for {engine}',
};

export const DEFAULT_MODELS_GALLERY_COPY: Required<ModelsGalleryCopy> = {
  compareLabel: 'Compare',
  compareTooltip: 'Select to compare',
  compareAria: 'Select {engine} to compare',
  strengthsLabel: 'Strengths',
  stats: DEFAULT_STATS_LABELS,
  audioAvailableLabel: 'Audio available',
  engineTabs: {
    options: {
      all: 'All models',
      video: 'Video generation',
      image: 'Image generation',
      audio: 'Audio',
      preparation: 'Preparation tools',
    },
  },
  filters: {
    sort: {
      label: 'Sort by',
      options: {
        featured: 'Featured',
        score: 'Score',
        price: 'Price',
        duration: 'Duration',
        resolution: 'Resolution',
        name: 'Name',
      },
    },
    mode: {
      label: 'Mode',
      options: {
        all: 'All',
        t2v: 'T2V',
        i2v: 'I2V',
        v2v: 'V2V',
        firstLast: 'First/Last',
        extend: 'Extend',
        lipSync: 'Lip sync',
        audio: 'Audio',
      },
    },
    format: {
      label: 'Format',
      options: {
        all: 'All',
        720: '720p+',
        1080: '1080p+',
        2160: '4K',
      },
    },
    duration: {
      label: 'Duration',
      options: {
        all: 'All',
        8: '≤8s',
        '10-15': '10–15s',
        20: '20s+',
      },
    },
    price: {
      label: 'Price',
      options: {
        all: 'All',
        cheap: '$',
        mid: '$$',
        premium: '$$$',
      },
    },
    age: {
      label: 'Models',
      options: {
        latest: 'Latest',
        legacy: 'Legacy',
        all: 'All',
      },
    },
    searchPlaceholder: 'Search models...',
    clear: 'Clear filters',
  },
  compareBar: DEFAULT_COMPARE_BAR,
  cardActions: DEFAULT_CARD_ACTIONS,
  capabilityTooltips: {
    T2V: 'Text-to-video',
    I2V: 'Image-to-video',
    V2V: 'Video-to-video',
    'First/Last': 'First frame / last frame',
    Extend: 'Extend / continue',
  },
};

export type ResolvedModelsGalleryCopy = {
  audioAvailableLabel: string;
  capabilityTooltips: Record<string, string>;
  compareAria: string;
  compareBar: ModelsGalleryCompareBarCopy;
  cardActions: ModelsGalleryCardActionsCopy;
  compareLabel: string;
  compareTooltip: string;
  filterClearLabel: string;
  filterLabels: Record<GalleryFilterKey, string>;
  filterOptions: Record<GalleryFilterKey, SelectOption[]>;
  engineTypeTabs: Array<{ label: string; value: ModelsGalleryEngineType }>;
  searchPlaceholder: string;
  statsLabels: ModelsGalleryStatsLabels;
  strengthsLabel: string;
};

function mergeFilterCopy<K extends keyof FilterCopy>(key: K, filtersCopy: FilterCopy) {
  const base = DEFAULT_MODELS_GALLERY_COPY.filters[key] as { label?: string; options?: Record<string, string> } | undefined;
  const override = filtersCopy[key] as { label?: string; options?: Record<string, string> } | undefined;
  return {
    ...base,
    ...override,
    options: { ...(base?.options ?? {}), ...(override?.options ?? {}) },
  };
}

function buildSelectOptions(entries: Array<[string, string | undefined]>): SelectOption[] {
  return entries.map(([value, label]) => ({ value, label: label ?? value }));
}

export function resolveModelsGalleryCopy(copy?: ModelsGalleryCopy): ResolvedModelsGalleryCopy {
  const filtersCopy = copy?.filters ?? {};
  const sortCopy = mergeFilterCopy('sort', filtersCopy);
  const modeCopy = mergeFilterCopy('mode', filtersCopy);
  const formatCopy = mergeFilterCopy('format', filtersCopy);
  const durationCopy = mergeFilterCopy('duration', filtersCopy);
  const priceCopy = mergeFilterCopy('price', filtersCopy);
  const ageCopy = mergeFilterCopy('age', filtersCopy);
  const statsOverride = copy?.stats ?? {};
  const compareBarOverride = copy?.compareBar ?? {};
  const cardActionsOverride = copy?.cardActions ?? {};
  const engineTabsOverride = (copy?.engineTabs?.options ?? {}) as Partial<Record<ModelsGalleryEngineType, string>>;
  const engineTabsDefault = (DEFAULT_MODELS_GALLERY_COPY.engineTabs.options ?? {}) as Partial<
    Record<ModelsGalleryEngineType, string>
  >;

  return {
    audioAvailableLabel: copy?.audioAvailableLabel ?? DEFAULT_MODELS_GALLERY_COPY.audioAvailableLabel,
    capabilityTooltips: { ...DEFAULT_MODELS_GALLERY_COPY.capabilityTooltips, ...(copy?.capabilityTooltips ?? {}) },
    compareAria: copy?.compareAria ?? DEFAULT_MODELS_GALLERY_COPY.compareAria,
    compareBar: {
      selectedTemplate: compareBarOverride.selectedTemplate ?? DEFAULT_COMPARE_BAR.selectedTemplate,
      selectTwo: compareBarOverride.selectTwo ?? DEFAULT_COMPARE_BAR.selectTwo,
      clear: compareBarOverride.clear ?? DEFAULT_COMPARE_BAR.clear,
      compare: compareBarOverride.compare ?? DEFAULT_COMPARE_BAR.compare,
    },
    cardActions: {
      viewSpecs: cardActionsOverride.viewSpecs ?? DEFAULT_CARD_ACTIONS.viewSpecs,
      viewSpecsAria: cardActionsOverride.viewSpecsAria ?? DEFAULT_CARD_ACTIONS.viewSpecsAria,
      compare: cardActionsOverride.compare ?? DEFAULT_CARD_ACTIONS.compare,
      compareAria: cardActionsOverride.compareAria ?? DEFAULT_CARD_ACTIONS.compareAria,
      examples: cardActionsOverride.examples ?? DEFAULT_CARD_ACTIONS.examples,
      examplesAria: cardActionsOverride.examplesAria ?? DEFAULT_CARD_ACTIONS.examplesAria,
    },
    compareLabel: copy?.compareLabel ?? DEFAULT_MODELS_GALLERY_COPY.compareLabel,
    compareTooltip: copy?.compareTooltip ?? DEFAULT_MODELS_GALLERY_COPY.compareTooltip,
    filterClearLabel: filtersCopy.clear ?? DEFAULT_MODELS_GALLERY_COPY.filters.clear ?? 'Clear filters',
    filterLabels: {
      sort: sortCopy.label ?? 'Sort by',
      mode: modeCopy.label ?? 'Mode',
      format: formatCopy.label ?? 'Format',
      duration: durationCopy.label ?? 'Duration',
      price: priceCopy.label ?? 'Price',
      age: ageCopy.label ?? 'Models',
    },
    filterOptions: {
      sort: buildSelectOptions([
        ['featured', sortCopy.options.featured],
        ['score', sortCopy.options.score],
        ['price', sortCopy.options.price],
        ['duration', sortCopy.options.duration],
        ['resolution', sortCopy.options.resolution],
        ['name', sortCopy.options.name],
      ]),
      mode: buildSelectOptions([
        ['all', modeCopy.options.all],
        ['t2v', modeCopy.options.t2v],
        ['i2v', modeCopy.options.i2v],
        ['v2v', modeCopy.options.v2v],
        ['firstLast', modeCopy.options.firstLast],
        ['extend', modeCopy.options.extend],
        ['lipSync', modeCopy.options.lipSync],
        ['audio', modeCopy.options.audio],
      ]),
      format: buildSelectOptions([
        ['all', formatCopy.options.all],
        ['720', formatCopy.options[720]],
        ['1080', formatCopy.options[1080]],
        ['2160', formatCopy.options[2160]],
      ]),
      duration: buildSelectOptions([
        ['all', durationCopy.options.all],
        ['8', durationCopy.options[8]],
        ['10-15', durationCopy.options['10-15']],
        ['20', durationCopy.options[20]],
      ]),
      price: buildSelectOptions([
        ['all', priceCopy.options.all],
        ['cheap', priceCopy.options.cheap],
        ['mid', priceCopy.options.mid],
        ['premium', priceCopy.options.premium],
      ]),
      age: buildSelectOptions([
        ['latest', ageCopy.options.latest],
        ['legacy', ageCopy.options.legacy],
        ['all', ageCopy.options.all],
      ]),
    },
    engineTypeTabs: (['video', 'image', 'audio'] as const).map((value) => ({
      value,
      label: engineTabsOverride[value] ?? engineTabsDefault[value] ?? value,
    })),
    searchPlaceholder: filtersCopy.searchPlaceholder ?? DEFAULT_MODELS_GALLERY_COPY.filters.searchPlaceholder ?? 'Search models...',
    statsLabels: {
      from: statsOverride.from ?? DEFAULT_STATS_LABELS.from,
      maxDurShort: statsOverride.maxDurShort ?? DEFAULT_STATS_LABELS.maxDurShort,
      maxDurLong: statsOverride.maxDurLong ?? DEFAULT_STATS_LABELS.maxDurLong,
      maxResShort: statsOverride.maxResShort ?? DEFAULT_STATS_LABELS.maxResShort,
      maxResLong: statsOverride.maxResLong ?? DEFAULT_STATS_LABELS.maxResLong,
      typeShort: statsOverride.typeShort ?? DEFAULT_STATS_LABELS.typeShort,
      typeLong: statsOverride.typeLong ?? DEFAULT_STATS_LABELS.typeLong,
    },
    strengthsLabel: copy?.strengthsLabel ?? DEFAULT_MODELS_GALLERY_COPY.strengthsLabel,
  };
}
