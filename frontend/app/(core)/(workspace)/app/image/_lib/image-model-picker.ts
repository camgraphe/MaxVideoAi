import type { EngineCaps } from '@/types/engines';
import type { ImageGenerationMode } from '@/types/image-generation';
import { clampRequestedImageCount, getAspectRatioOptions, getDefaultAspectRatio, getDefaultResolution, getImageFieldDefaultString, getImageFieldValues, getImageInputField, getReferenceConstraints, getResolutionOptions } from '@/lib/image/inputSchema';
import type { PickerChange } from '@/components/ui/engine-select/model-picker-types';
import { buildCustomImageSize, resolveSeedreamMaxOutputImages } from './image-workspace-utils';

export type ImagePickerSettings = {
  mode: ImageGenerationMode; numImages: number; resolution: string | null; aspectRatio: string | null; quality: string | null;
  maskUrl?: string; enableWebSearch: boolean; customImageWidth: string; customImageHeight: string;
  referenceImageCount: number; selectedReferenceCount: number; readyReferenceSizes: Array<{ width?: number | null; height?: number | null }>;
};
export function prepareImagePickerOption(engine: EngineCaps, current: ImagePickerSettings, locale: string) {
  const fr = locale.startsWith('fr'), es = locale.startsWith('es');
  const { mode } = current;
  const choose = (field: string, value: string | null, choices: string[], fallback: string | null) =>
    !getImageInputField(engine, field, mode) || !choices.length ? null : value && choices.includes(value) ? value : fallback;
  const qualityOptions = getImageFieldValues(engine, 'quality', mode);
  const settings = {
    resolution: choose('resolution', current.resolution, getResolutionOptions(engine, mode), getDefaultResolution(engine, mode)),
    aspectRatio: choose('aspect_ratio', current.aspectRatio, getAspectRatioOptions(engine, mode), getDefaultAspectRatio(engine, mode)),
    quality: choose('quality', current.quality, qualityOptions, getImageFieldDefaultString(engine, 'quality', mode) ?? qualityOptions[0] ?? null),
    enableWebSearch: Boolean(getImageInputField(engine, 'enable_web_search', mode)) && current.enableWebSearch,
    numImages: Math.min(clampRequestedImageCount(engine, mode, current.numImages), engine.id === 'seedream' ? resolveSeedreamMaxOutputImages(current.referenceImageCount) : Infinity),
  };
  const references = getReferenceConstraints(engine, mode);
  const missingSource = current.referenceImageCount < references.min;
  const disabledReason = !engine.modes.includes(mode) || engine.availability === 'paused'
    ? (fr ? 'Indisponible pour cette opération' : es ? 'No disponible para esta operación' : 'Unavailable for this operation')
    : current.maskUrl && !getImageInputField(engine, 'mask_url', mode) ? (fr ? 'Incompatible avec votre masque' : es ? 'Incompatible con tu máscara' : 'Incompatible with your mask')
    : current.selectedReferenceCount > current.referenceImageCount ? (fr ? 'Attendez la préparation des références' : es ? 'Espera a que se preparen las referencias' : 'Wait for references to finish preparing')
    : current.referenceImageCount > references.max || (current.referenceImageCount > 0 && !getImageInputField(engine, 'image_urls', mode))
      ? (fr ? 'Incompatible avec vos références' : es ? 'Incompatible con tus referencias' : 'Incompatible with your references') : undefined;
  const names = fr ? { resolution: 'Résolution', aspectRatio: 'Format', quality: 'Qualité', enableWebSearch: 'Recherche web', numImages: 'Images' }
    : es ? { resolution: 'Resolución', aspectRatio: 'Formato', quality: 'Calidad', enableWebSearch: 'Búsqueda web', numImages: 'Imágenes' }
    : { resolution: 'Resolution', aspectRatio: 'Aspect ratio', quality: 'Quality', enableWebSearch: 'Web search', numImages: 'Images' };
  const display = (value: unknown) => value == null ? '—' : typeof value === 'boolean' ? (value ? (fr ? 'Activée' : es ? 'Activada' : 'On') : (fr ? 'Désactivée' : es ? 'Desactivada' : 'Off')) : String(value);
  const changes: PickerChange[] = (Object.keys(settings) as Array<keyof typeof settings>).flatMap(key => settings[key] === current[key] ? [] : [{ label: names[key], before: display(current[key]), after: display(settings[key]) }]);
  return {
    settings, changes, disabledReason,
    priceUnavailableReason: missingSource ? (fr ? 'Ajoutez une image source pour estimer' : es ? 'Añade una imagen para estimar' : 'Add a source image to estimate') : undefined,
    summary: [settings.resolution, settings.aspectRatio, `${settings.numImages} image${settings.numImages > 1 ? 's' : ''}`].filter(Boolean).join(' · '),
    request: { engineId: engine.id, mode, numImages: settings.numImages, resolution: settings.resolution ?? undefined, aspectRatio: settings.aspectRatio ?? undefined,
      quality: settings.quality ?? undefined, enableWebSearch: settings.enableWebSearch || undefined, referenceImageCount: current.referenceImageCount,
      referenceImageSizes: current.readyReferenceSizes.length ? current.readyReferenceSizes : undefined,
      customImageSize: settings.resolution === 'custom' ? buildCustomImageSize(current.customImageWidth, current.customImageHeight) : null },
  };
}
