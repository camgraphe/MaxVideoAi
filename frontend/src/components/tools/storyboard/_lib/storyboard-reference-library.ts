import type {
  ImageLibraryModalState,
  LibraryAsset,
} from '@/app/(core)/(workspace)/app/image/_lib/image-workspace-types';
import type { StoryboardReferenceImage } from './storyboard-reference-image';

export type StoryboardLibraryModalState = ImageLibraryModalState;
export type StoryboardLibraryAsset = LibraryAsset;

export const STORYBOARD_REFERENCE_SUPPORTED_FORMATS = ['png', 'jpg', 'jpeg', 'webp'];
export const STORYBOARD_REFERENCE_SUPPORTED_FORMATS_LABEL = STORYBOARD_REFERENCE_SUPPORTED_FORMATS
  .map((format) => format.toUpperCase())
  .join(', ');

export const CLOSED_STORYBOARD_LIBRARY_MODAL: StoryboardLibraryModalState = {
  open: false,
  slotIndex: null,
  selectionMode: 'reference',
  initialSource: 'all',
};

export function resolveStoryboardReferenceLibrarySlotIndex(
  referenceImages: (StoryboardReferenceImage | null)[],
  preferredIndex: number | null,
  slotCount: number
) {
  if (preferredIndex != null && preferredIndex >= 0 && preferredIndex < slotCount) {
    return preferredIndex;
  }
  const emptyIndex = referenceImages.findIndex((image) => image === null);
  return emptyIndex >= 0 ? emptyIndex : slotCount - 1;
}

export function createStoryboardReferenceImageFromLibraryAsset(
  asset: StoryboardLibraryAsset,
  fallbackName: string
): StoryboardReferenceImage {
  return {
    url: asset.url,
    previewUrl: asset.url,
    width: asset.width ?? null,
    height: asset.height ?? null,
    name: fallbackName,
    size: asset.size ?? undefined,
    type: asset.mime ?? 'image/*',
    status: 'ready',
  };
}
