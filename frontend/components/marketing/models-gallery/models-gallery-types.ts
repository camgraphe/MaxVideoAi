import type { LocalizedLinkHref } from '@/i18n/navigation';

export type ModelGalleryCard = {
  id: string;
  label: string;
  provider?: string | null;
  engineId?: string | null;
  brandId?: string | null;
  description: string;
  versionLabel?: string;
  overallScore?: number | null;
  priceNote?: string | null;
  priceNoteHref?: string | null;
  href: LocalizedLinkHref;
  backgroundColor?: string | null;
  textColor?: string | null;
  strengths?: string[];
  capabilities?: string[];
  stats?: {
    priceFrom?: string | null;
    maxDuration?: string | null;
    maxResolution?: string | null;
  };
  statsLabels?: {
    duration?: string;
  };
  audioAvailable?: boolean;
  compareDisabled?: boolean;
  filterMeta?: {
    t2v?: boolean;
    i2v?: boolean;
    v2v?: boolean;
    firstLast?: boolean;
    extend?: boolean;
    lipSync?: boolean;
    audio?: boolean;
    maxResolution?: number | null;
    maxDuration?: number | null;
    priceFrom?: number | null;
    legacy?: boolean;
  };
};

export type GalleryFilterKey = 'sort' | 'mode' | 'format' | 'duration' | 'price' | 'age';

export type ModelsGalleryCopy = {
  compareLabel?: string;
  compareTooltip?: string;
  compareAria?: string;
  strengthsLabel?: string;
  stats?: {
    from?: string;
    maxDurShort?: string;
    maxDurLong?: string;
    maxResShort?: string;
    maxResLong?: string;
    typeShort?: string;
    typeLong?: string;
  };
  audioAvailableLabel?: string;
  filters?: {
    sort?: { label?: string; options?: Record<string, string> };
    mode?: { label?: string; options?: Record<string, string> };
    format?: { label?: string; options?: Record<string, string> };
    duration?: { label?: string; options?: Record<string, string> };
    price?: { label?: string; options?: Record<string, string> };
    age?: { label?: string; options?: Record<string, string> };
    searchPlaceholder?: string;
    clear?: string;
  };
  compareBar?: {
    selectedTemplate?: string;
    selectTwo?: string;
    clear?: string;
    compare?: string;
  };
  capabilityTooltips?: Record<string, string>;
};

export type ModelsGalleryStatsLabels = Required<NonNullable<ModelsGalleryCopy['stats']>>;
export type ModelsGalleryCompareBarCopy = Required<NonNullable<ModelsGalleryCopy['compareBar']>>;

export type ModelsGalleryCompareHref = {
  pathname: '/ai-video-engines/[slug]';
  params: { slug: string };
  query?: { order: string };
};
