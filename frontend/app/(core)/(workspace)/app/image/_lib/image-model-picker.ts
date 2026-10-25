import type { EngineCaps } from '@/types/engines';
import type { ImageGenerationMode } from '@/types/image-generation';
import { clampRequestedImageCount, getAspectRatioOptions, getDefaultAspectRatio, getDefaultResolution, getImageFieldDefaultNumber, getImageFieldDefaultString, getImageFieldValues, getImageInputField, getReferenceConstraints, getResolutionOptions } from '@/lib/image/inputSchema';
import { GPT_IMAGE_2_SIZE_CONSTRAINTS } from '@/lib/image/gptImage2';
import type { PickerChange } from '@/components/ui/engine-select/model-picker-types';
import { buildCustomImageSize, formatImageSizeLabel, formatQualityLabel, resolveSeedreamMaxOutputImages } from './image-workspace-utils';

export type ImagePickerSettings = {
  mode: ImageGenerationMode; numImages: number; resolution: string | null; aspectRatio: string | null; quality: string | null;
  maxOutputTokens?: number | null;
  referenceIndices?: number[]; outputFormat?: string | null; background?: string | null; style?: string | null; thinkingLevel?: string | null;
  seed?: string; limitGenerations?: boolean; watermark?: boolean; maskUrl?: string; enableWebSearch: boolean; customImageWidth: string; customImageHeight: string;
  referenceImageCount: number; selectedReferenceCount: number; readyReferenceSizes: Array<{ width?: number | null; height?: number | null }>;
};
export function prepareImagePickerOption(engine: EngineCaps, current: ImagePickerSettings, locale: string) {
  const fr = locale.startsWith('fr'), es = locale.startsWith('es');
  const { mode } = current;
  const choose = (field: string, value: string | null, choices: string[], fallback: string | null) =>
    !getImageInputField(engine, field, mode) || !choices.length ? null : value && choices.includes(value) ? value : fallback;
  const optional = (field: string, value: string | null | undefined) => { const choices = getImageFieldValues(engine, field, mode);
    return choose(field, value ?? null, choices, getImageFieldDefaultString(engine, field, mode) ?? choices[0] ?? null); };
  const hasCustomSize = getImageInputField(engine, 'image_width', mode) && getImageInputField(engine, 'image_height', mode);
  const qualityOptions = getImageFieldValues(engine, 'quality', mode);
  const settings = {
    outputFormat: optional('output_format', current.outputFormat), background: optional('background', current.background),
    maxOutputTokens: engine.id === 'nano-banana-2-1'
      ? Number.isSafeInteger(current.maxOutputTokens) && current.maxOutputTokens! >= 1 && current.maxOutputTokens! <= 32768
        ? current.maxOutputTokens! : getImageFieldDefaultNumber(engine, 'max_output_tokens', mode) ?? 32768
      : null,
    style: optional('style', current.style), thinkingLevel: optional('thinking_level', current.thinkingLevel),
    seed: !getImageInputField(engine, 'seed', mode) ? '' : current.seed?.trim() && Number.isFinite(Number(current.seed)) ? String(Math.round(Number(current.seed))) : String(getImageFieldDefaultNumber(engine, 'seed', mode) ?? ''),
    limitGenerations: Boolean(getImageInputField(engine, 'limit_generations', mode)) && Boolean(current.limitGenerations),
    watermark: Boolean(getImageInputField(engine, 'watermark', mode)) && Boolean(current.watermark),
    customImageWidth: hasCustomSize ? current.customImageWidth.trim() ? current.customImageWidth : String(getImageFieldDefaultNumber(engine, 'image_width', mode) ?? GPT_IMAGE_2_SIZE_CONSTRAINTS.defaultWidth) : '',
    customImageHeight: hasCustomSize ? current.customImageHeight.trim() ? current.customImageHeight : String(getImageFieldDefaultNumber(engine, 'image_height', mode) ?? GPT_IMAGE_2_SIZE_CONSTRAINTS.defaultHeight) : '',
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
    : (current.referenceIndices?.some(index => index >= references.max) ?? false) || current.referenceImageCount > references.max || (current.referenceImageCount > 0 && !getImageInputField(engine, 'image_urls', mode))
      ? (fr ? 'Incompatible avec vos références' : es ? 'Incompatible con tus referencias' : 'Incompatible with your references') : undefined;
  const names = fr ? { outputFormat: 'Format du fichier', background: 'Arrière-plan', style: 'Style', thinkingLevel: 'Réflexion', maxOutputTokens: 'Limite de tokens de sortie', seed: 'Graine', limitGenerations: 'Limiter les générations', watermark: 'Filigrane', customImageWidth: 'Largeur', customImageHeight: 'Hauteur', resolution: 'Résolution', aspectRatio: 'Format', quality: 'Qualité', enableWebSearch: 'Recherche web', numImages: 'Images' }
    : es ? { outputFormat: 'Formato del archivo', background: 'Fondo', style: 'Estilo', thinkingLevel: 'Razonamiento', maxOutputTokens: 'Límite de tokens de salida', seed: 'Semilla', limitGenerations: 'Limitar generaciones', watermark: 'Marca de agua', customImageWidth: 'Anchura', customImageHeight: 'Altura', resolution: 'Resolución', aspectRatio: 'Formato', quality: 'Calidad', enableWebSearch: 'Búsqueda web', numImages: 'Imágenes' }
    : { outputFormat: 'File format', background: 'Background', style: 'Style', thinkingLevel: 'Thinking', maxOutputTokens: 'Output token limit', seed: 'Seed', limitGenerations: 'Limit generations', watermark: 'Watermark', customImageWidth: 'Width', customImageHeight: 'Height', resolution: 'Resolution', aspectRatio: 'Aspect ratio', quality: 'Quality', enableWebSearch: 'Web search', numImages: 'Images' };
  const display = (value: unknown, key: keyof typeof settings) => value == null ? '—' : typeof value === 'boolean' ? (value ? (fr ? 'Activée' : es ? 'Activada' : 'On') : (fr ? 'Désactivée' : es ? 'Desactivada' : 'Off'))
    : key === 'resolution' ? formatImageSizeLabel(String(value)) : key === 'quality' ? formatQualityLabel(String(value)) : value === 'auto' ? 'Auto' : String(value);
  const changes: PickerChange[] = (Object.keys(settings) as Array<keyof typeof settings>).flatMap(key => !Object.hasOwn(current, key) || settings[key] === current[key] || (['customImageWidth', 'customImageHeight'].includes(key) && current.resolution !== 'custom' && settings.resolution !== 'custom') ? [] : [{ label: names[key], before: display(current[key], key), after: display(settings[key], key) }]);
  return {
    settings, changes, disabledReason,
    priceUnavailableReason: missingSource ? (fr ? 'Ajoutez une image source pour estimer' : es ? 'Añade una imagen para estimar' : 'Add a source image to estimate') : undefined,
    summary: [settings.resolution && formatImageSizeLabel(settings.resolution), settings.aspectRatio === 'auto' ? 'Auto' : settings.aspectRatio, `${settings.numImages} image${settings.numImages > 1 ? 's' : ''}`].filter(Boolean).join(' · '),
    request: { engineId: engine.id, mode, numImages: settings.numImages, resolution: settings.resolution ?? undefined, aspectRatio: settings.aspectRatio ?? undefined,
      thinkingLevel: settings.thinkingLevel ?? undefined,
      ...(settings.maxOutputTokens !== null ? { maxOutputTokens: settings.maxOutputTokens } : {}),
      quality: settings.quality ?? undefined, enableWebSearch: settings.enableWebSearch || undefined, referenceImageCount: current.referenceImageCount,
      referenceImageSizes: current.readyReferenceSizes.length ? current.readyReferenceSizes : undefined,
      customImageSize: settings.resolution === 'custom' ? buildCustomImageSize(settings.customImageWidth, settings.customImageHeight) : null },
  };
}
