import { NextRequest, NextResponse } from 'next/server';
import { listFalEngines } from '@/config/falEngines';
import type { ImageGenerationMode } from '@/types/image-generation';
import { computePricingSnapshot } from '@/lib/pricing';
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
        referenceImageSizes?: Array<Partial<GptImage2ImageSize> | null>;
        quality?: string;
        enableWebSearch?: boolean;
      }
    | null = null;
  try {
    body = (await req.json()) as {
      engineId?: string;
      mode?: ImageGenerationMode;
      numImages?: number;
      resolution?: string;
      customImageSize?: GptImage2ImageSize | null;
      referenceImageSizes?: Array<Partial<GptImage2ImageSize> | null>;
      quality?: string;
      enableWebSearch?: boolean;
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
    const pricing = await computePricingSnapshot({
      engine: engineCaps,
      durationSec: numImages,
      resolution: resolutionResult.resolution,
      customImageSize,
      quality: typeof body?.quality === 'string' ? body.quality : undefined,
      currency: engineCaps.pricing?.currency ?? 'USD',
      addons:
        getImageInputField(engineCaps, 'enable_web_search', mode) && body?.enableWebSearch === true
          ? { enable_web_search: true }
          : undefined,
    });

    return NextResponse.json({ ok: true, pricing });
  } catch (error) {
    console.error('[images] price estimation failed', error);
    return NextResponse.json({ ok: false, error: 'pricing_error' }, { status: 500 });
  }
}
