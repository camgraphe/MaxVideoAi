import type {
  CharacterReferenceSelection,
  ImageGenerationMode,
  ImageGenerationRequest,
  ImageGenerationResponse,
} from '@/types/image-generation';
import { formatSupportedImageFormatsLabel, getSupportedImageFormats } from '@/lib/image/formats';
import { getReferenceConstraints } from '@/app/api/images/utils';
import {
  getStoredAssetInfoByUrl,
  isReferenceImageSupported,
  normalizeReferenceImageForEngine,
  type StoredAssetInfo,
} from './image-reference-normalization';
import { ImageGenerationExecutionError } from './image-generation-error';
import {
  buildCharacterReferencePrompt,
  sanitizeCharacterReferences,
} from './image-provider-payload';
import type { ImageEngineEntry } from './image-generation-request-context';
import { resolveStoryboardTemplateReferenceUrls } from './storyboard-template-reference';

export type ImageGenerationReferenceContext = {
  characterReferences: CharacterReferenceSelection[];
  normalizedImageUrls: string[];
  combinedImageUrls: string[];
  effectivePrompt: string;
  storedAssetInfoByUrl: Map<string, StoredAssetInfo>;
};

export async function prepareImageGenerationReferences({
  userId,
  body,
  engineEntry,
  mode,
  prompt,
}: {
  userId: string;
  body: Partial<ImageGenerationRequest>;
  engineEntry: ImageEngineEntry;
  mode: ImageGenerationMode;
  prompt: string;
}): Promise<ImageGenerationReferenceContext> {
  const engine = engineEntry.engine;
  const rawImageUrls = Array.isArray(body.imageUrls) ? body.imageUrls : [];
  const submittedImageUrls = rawImageUrls
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length);
  const storyboardTemplateReferences =
    body.source === 'storyboard'
      ? await resolveStoryboardTemplateReferenceUrls({
          urls: submittedImageUrls,
          userId,
        })
      : { urls: submittedImageUrls, storedAssetInfoByUrl: new Map<string, StoredAssetInfo>() };
  const imageUrls = storyboardTemplateReferences.urls;
  let characterReferences = sanitizeCharacterReferences(body.characterReferences);
  const characterReferenceUrls = characterReferences.map((entry) => entry.imageUrl);
  let normalizedImageUrls = imageUrls.filter((url) => !characterReferenceUrls.includes(url));
  let combinedImageUrls = [...characterReferenceUrls, ...normalizedImageUrls];
  const effectivePrompt = buildCharacterReferencePrompt(prompt, characterReferences);

  const invalidImageUrl = combinedImageUrls.find((entry) => !/^https?:\/\//i.test(entry));
  if (invalidImageUrl) {
    fail(
      mode,
      'invalid_image_url',
      'Reference images must be absolute URLs (https://...).',
      400,
      { url: invalidImageUrl },
      {
        engineId: engineEntry.id,
        engineLabel: engineEntry.marketingName,
      }
    );
  }

  const supportedReferenceFormats = getSupportedImageFormats(engine);
  let storedAssetInfoByUrl = new Map<string, StoredAssetInfo>();
  if (supportedReferenceFormats.length && combinedImageUrls.length) {
    storedAssetInfoByUrl = await getStoredAssetInfoByUrl(userId, combinedImageUrls);
    storyboardTemplateReferences.storedAssetInfoByUrl.forEach((value, key) => {
      storedAssetInfoByUrl.set(key, value);
    });
    const normalizedReferenceByUrl = new Map<string, { url: string; mime: string }>();

    for (const referenceUrl of [...new Set(combinedImageUrls)]) {
      if (isReferenceImageSupported(supportedReferenceFormats, referenceUrl, storedAssetInfoByUrl)) {
        continue;
      }

      try {
        const normalizedReference = await normalizeReferenceImageForEngine({
          userId,
          url: referenceUrl,
          supportedFormats: supportedReferenceFormats,
          engineId: engine.id,
        });
        normalizedReferenceByUrl.set(referenceUrl, normalizedReference);
        storedAssetInfoByUrl.set(normalizedReference.url, { mime: normalizedReference.mime });
      } catch (error) {
        const reason = error instanceof Error && error.message ? error.message : 'Unable to normalize reference image.';
        console.warn('[images] failed to normalize reference image for engine', {
          engineId: engine.id,
          url: referenceUrl,
          reason,
        });
        fail(
          mode,
          'image_normalization_failed',
          'Reference image could not be converted to a format supported by this engine.',
          422,
          { allowed: supportedReferenceFormats, url: referenceUrl, reason },
          {
            engineId: engineEntry.id,
            engineLabel: engineEntry.marketingName,
          }
        );
      }
    }

    if (normalizedReferenceByUrl.size) {
      characterReferences = characterReferences.map((entry) => ({
        ...entry,
        imageUrl: normalizedReferenceByUrl.get(entry.imageUrl)?.url ?? entry.imageUrl,
      }));
      normalizedImageUrls = normalizedImageUrls.map(
        (entry) => normalizedReferenceByUrl.get(entry)?.url ?? entry
      );
      const currentCharacterReferenceUrls = new Set(characterReferences.map((entry) => entry.imageUrl));
      combinedImageUrls = [
        ...characterReferences.map((entry) => entry.imageUrl),
        ...normalizedImageUrls.filter((url) => !currentCharacterReferenceUrls.has(url)),
      ];
    }

    const invalidImageFormatUrl = combinedImageUrls.find(
      (entry) => !isReferenceImageSupported(supportedReferenceFormats, entry, storedAssetInfoByUrl)
    );
    if (invalidImageFormatUrl) {
      fail(
        mode,
        'image_format_invalid',
        `Reference images must use ${formatSupportedImageFormatsLabel(supportedReferenceFormats)}.`,
        400,
        { allowed: supportedReferenceFormats, url: invalidImageFormatUrl },
        {
          engineId: engineEntry.id,
          engineLabel: engineEntry.marketingName,
        }
      );
    }
  }

  const referenceConstraints = getReferenceConstraints(engine, mode);
  if (referenceConstraints.min > 0 && combinedImageUrls.length < referenceConstraints.min) {
    const message =
      referenceConstraints.min === 1
        ? 'At least one reference image is required for this request.'
        : `Provide at least ${referenceConstraints.min} reference images for this request.`;
    fail(mode, 'missing_image_urls', message, 400, { minRequired: referenceConstraints.min }, {
      engineId: engineEntry.id,
      engineLabel: engineEntry.marketingName,
    });
  }
  if (combinedImageUrls.length > referenceConstraints.max) {
    fail(
      mode,
      'too_many_image_urls',
      `You can attach up to ${referenceConstraints.max} reference images.`,
      400,
      { maxAllowed: referenceConstraints.max },
      {
        engineId: engineEntry.id,
        engineLabel: engineEntry.marketingName,
      }
    );
  }

  return {
    characterReferences,
    normalizedImageUrls,
    combinedImageUrls,
    effectivePrompt,
    storedAssetInfoByUrl,
  };
}

function fail(
  mode: ImageGenerationMode,
  code: string,
  message: string,
  status: number,
  detail?: unknown,
  extras?: Partial<ImageGenerationResponse>
): never {
  throw new ImageGenerationExecutionError(message, { mode, code, status, detail, extras });
}
