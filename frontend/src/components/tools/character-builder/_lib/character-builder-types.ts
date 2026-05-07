import type {
  CharacterBuilderAction,
  CharacterBuilderFormatMode,
  CharacterBuilderRun,
  CharacterBuilderState,
} from '@/types/character-builder';

export type UploadedAsset = {
  url: string;
  width?: number | null;
  height?: number | null;
  name?: string | null;
};

export type CharacterLibraryAsset = {
  id: string;
  url: string;
  mime?: string | null;
  width?: number | null;
  height?: number | null;
  size?: number | null;
  source?: string | null;
  createdAt?: string;
};

export type CharacterLibraryAssetsResponse = {
  ok?: boolean;
  assets?: CharacterLibraryAsset[];
  error?: string;
};

export type PersistedCharacterBuilderState = {
  version: number;
  state: CharacterBuilderState;
};

export type ChoiceOption = {
  id: string;
  label: string;
  description?: string;
  swatch?: string;
};

export type ToggleItem = {
  id: string;
  label: string;
};

export type BillingProductResponse = {
  ok: boolean;
  product?: {
    productKey: string;
    currency: string;
    unitPriceCents: number;
  };
  error?: string;
};

export type LoadingRequestKey = 'generate-1' | 'generate-4' | 'full-body-fix' | 'lighting-variant';
export type LoadingRequestCounts = Record<LoadingRequestKey, number>;

export type PendingCharacterRun = {
  id: string;
  jobId: string;
  createdAt: string;
  action: CharacterBuilderAction;
  outputMode: CharacterBuilderRun['outputMode'];
  qualityMode: CharacterBuilderRun['qualityMode'];
  formatMode: CharacterBuilderFormatMode;
  generateCount: 1 | 4;
};

export type PersistedPendingCharacterRuns = {
  version: 1;
  runs: PendingCharacterRun[];
};

export type CharacterJobPayload = {
  ok?: boolean;
  jobId?: string;
  createdAt?: string;
  status?: string | null;
  renderIds?: string[] | null;
  renderThumbUrls?: string[] | null;
  settingsSnapshot?: unknown;
  pricing?: CharacterBuilderRun['pricing'];
};

export type HistoricalCharacterGalleryItem = {
  id: string;
  jobId: string;
  imageUrl: string;
  thumbUrl: string;
  engineLabel: string;
  createdAt: string;
  prompt: string | null;
};
