import { NextRequest, NextResponse } from 'next/server';
import { listFalEngines } from '@/config/falEngines';
import type { ImageGenerationMode, ImageGenerationRequest } from '@/types/image-generation';
import { computeCanonicalPublicSnapshot } from '@/server/pricing/quote-public';
import { isLumaAgentsImageEngineId } from '@/lib/luma-agents';
import {
  applyStoryboardEditPricing,
  applyStoryboardKlingBundlePricing,
  applyStoryboardPricing,
  getStoryboardKlingFirstFramePricingConfig,
  isKlingStoryboardBoardMetadata,
  resolveStoryboardTier,
  STORYBOARD_EDIT_SOURCE,
  STORYBOARD_SOURCE,
} from '@/lib/storyboard-pricing';
import { clampRequestedImageCount, getImageInputField, resolveRequestedResolution } from '../utils';
import {
  parseGptImage2SizeKey,
  resolveGptImage2AutoInputImageSize,
  validateGptImage2CustomImageSize,
  type GptImage2ImageSize,
} from '@/lib/image/gptImage2';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let body:
    | {
        engineId?: string;
        mode?: ImageGenerationMode;
        numImages?: number;
        resolution?: string;
        customImageSize?: GptImage2ImageSize | null;
        imageUrls?: unknown[];
        referenceImageSizes?: Array<Partial<GptImage2ImageSize> | null>;
        quality?: string;
        enableWebSearch?: boolean;
        aspectRatio?: string;
        metadata?: ImageGenerationRequest['metadata'];
        source?: string;
      }
    | null = null;
  try {
    body = (await req.json()) as {
      engineId?: string;
      mode?: ImageGenerationMode;
      numImages?: number;
      resolution?: string;
      customImageSize?: GptImage2ImageSize | null;
      imageUrls?: unknown[];
      referenceImageSizes?: Array<Partial<GptImage2ImageSize> | null>;
      quality?: string;
      enableWebSearch?: boolean;
      aspectRatio?: string;
      metadata?: ImageGenerationRequest['metadata'];
      source?: string;
    } | null;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 });
  }

  const engineId = typeof body?.engineId === 'string' ? body.engineId : null;
  const mode = body?.mode === 'i2i' || body?.mode === 't2i' ? body.mode : 't2i';
  const requestedImages =
    typeof body?.numImages === 'number' && Number.isFinite(body.numImages) ? Math.round(body.numImages) : 1;

  const engineEntry = listFalEngines().find((entry) => entry.id === engineId);
  if (!engineEntry || (engineEntry.category ?? 'video') !== 'image') {
    return NextResponse.json({ ok: false, error: 'engine_unavailable' }, { status: 404 });
  }

  const engineCaps = engineEntry.engine;
  const numImages = clampRequestedImageCount(engineCaps, mode, requestedImages);
  const modeConfig = engineEntry.modes.find((entry) => entry.mode === mode);
  if (!modeConfig) {
    return NextResponse.json({ ok: false, error: 'mode_unsupported' }, { status: 400 });
  }

  try {
    const resolutionResult = resolveRequestedResolution(
      engineCaps,
      mode,
      typeof body?.resolution === 'string' ? body.resolution : null
    );
    if (!resolutionResult.ok) {
      return NextResponse.json(
        { ok: false, error: 'resolution_invalid', allowed: resolutionResult.allowed },
        { status: 400 }
      );
    }
    const parsedResolutionSize = parseGptImage2SizeKey(resolutionResult.resolution);
    let customImageSize: GptImage2ImageSize | null = parsedResolutionSize;
    if (engineCaps.id === 'gpt-image-2' && resolutionResult.resolution === 'custom') {
      const customSizeResult = validateGptImage2CustomImageSize(body?.customImageSize);
      if (!customSizeResult.ok) {
        return NextResponse.json(
          {
            ok: false,
            error: 'image_size_invalid',
            message: customSizeResult.message,
            detail: customSizeResult.detail,
          },
          { status: 400 }
        );
      }
      customImageSize = customSizeResult.size;
    }
    if (engineCaps.id === 'gpt-image-2' && mode === 'i2i' && resolutionResult.resolution === 'auto') {
      customImageSize = resolveGptImage2AutoInputImageSize(
        Array.isArray(body?.referenceImageSizes) ? body.referenceImageSizes : []
      );
    }
    const submittedReferenceImageCount = Array.isArray(body?.imageUrls)
      ? body.imageUrls.filter((entry) => typeof entry === 'string' && entry.trim().length).length
      : 0;
    const submittedReferenceSizeCount = Array.isArray(body?.referenceImageSizes)
      ? body.referenceImageSizes.filter((entry) => entry && typeof entry === 'object').length
      : 0;
    const estimatedReferenceCount = submittedReferenceImageCount || submittedReferenceSizeCount;
    const lumaAgentsReferenceImageCount = isLumaAgentsImageEngineId(engineCaps.id)
      ? mode === 'i2i'
        ? Math.max(0, estimatedReferenceCount - 1)
        : estimatedReferenceCount
      : undefined;
    const pricing = await computeCanonicalPublicSnapshot({
      engine: engineCaps,
      durationSec: numImages,
      resolution: resolutionResult.resolution,
      mode,
      customImageSize,
      quality: typeof body?.quality === 'string' ? body.quality : undefined,
      referenceImageCount: lumaAgentsReferenceImageCount,
      currency: engineCaps.pricing?.currency ?? 'USD',
      addons:
        getImageInputField(engineCaps, 'enable_web_search', mode) && body?.enableWebSearch === true
          ? { enable_web_search: true }
          : undefined,
    });
    let finalPricing = pricing;
    if (engineCaps.id === 'gpt-image-2' && body?.source === STORYBOARD_SOURCE) {
      finalPricing = applyStoryboardPricing(
        pricing,
        resolveStoryboardTier({
          customImageSize,
          resolution: resolutionResult.resolution,
          quality: body?.quality,
        })
      );
      if (isKlingStoryboardBoardMetadata(body.metadata)) {
        const firstFrameConfig = getStoryboardKlingFirstFramePricingConfig({
          customImageSize,
          aspectRatio: typeof body.aspectRatio === 'string' ? body.aspectRatio : null,
        });
        const firstFramePricing = applyStoryboardPricing(
          await computeCanonicalPublicSnapshot({
            engine: engineCaps,
            durationSec: 1,
            resolution: firstFrameConfig.resolution,
            customImageSize: firstFrameConfig.customImageSize,
            quality: firstFrameConfig.quality,
            currency: engineCaps.pricing?.currency ?? 'USD',
          }),
          'hd'
        );
        finalPricing = applyStoryboardKlingBundlePricing(finalPricing, firstFramePricing);
      }
    } else if (engineCaps.id === 'gpt-image-2' && body?.source === STORYBOARD_EDIT_SOURCE) {
      finalPricing = applyStoryboardEditPricing(pricing);
    }

    return NextResponse.json({ ok: true, pricing: finalPricing });
  } catch (error) {
    console.error('[images] price estimation failed', error);
    return NextResponse.json({ ok: false, error: 'pricing_error' }, { status: 500 });
  }
}
