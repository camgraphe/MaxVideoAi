import { NextRequest, NextResponse } from 'next/server';
import type { ImageGenerationMode, ImageGenerationRequest } from '@/types/image-generation';
import type { GptImage2ImageSize } from '@/lib/image/gptImage2';
import {
  estimateWebImageGeneration,
  ImageEstimateError,
} from '@/server/images/estimate-image-generation';

export const runtime = 'nodejs';

type ImageEstimateBody = {
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
  source?: ImageGenerationRequest['source'];
};

function countReferenceUrls(imageUrls: ImageEstimateBody['imageUrls']): number {
  return Array.isArray(imageUrls)
    ? imageUrls.filter((entry) => typeof entry === 'string' && entry.trim().length).length
    : 0;
}

function countReferenceSizes(referenceImageSizes: ImageEstimateBody['referenceImageSizes']): number {
  return Array.isArray(referenceImageSizes)
    ? referenceImageSizes.filter((entry) => entry && typeof entry === 'object').length
    : 0;
}

export async function POST(req: NextRequest) {
  let body: ImageEstimateBody | null = null;
  try {
    body = (await req.json()) as ImageEstimateBody | null;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 });
  }

  const referenceImageSizes = Array.isArray(body?.referenceImageSizes)
    ? body.referenceImageSizes
    : [];
  const referenceImageCount =
    countReferenceUrls(body?.imageUrls) || countReferenceSizes(referenceImageSizes);

  try {
    const { pricing } = await estimateWebImageGeneration({
      engineId: body?.engineId,
      mode: body?.mode === 'i2i' || body?.mode === 't2i' ? body.mode : 't2i',
      numImages: body?.numImages,
      resolution: body?.resolution,
      customImageSize: body?.customImageSize,
      referenceImageCount,
      referenceImageSizes: referenceImageSizes as GptImage2ImageSize[],
      quality: body?.quality as ImageGenerationRequest['quality'],
      enableWebSearch: body?.enableWebSearch,
      aspectRatio: body?.aspectRatio,
      metadata: body?.metadata,
      source: body?.source,
    });
    return NextResponse.json({ ok: true, pricing });
  } catch (error) {
    if (error instanceof ImageEstimateError) {
      if (error.code === 'resolution_invalid') {
        return NextResponse.json(
          { ok: false, error: error.code, allowed: error.allowed },
          { status: error.status }
        );
      }
      if (error.code === 'image_size_invalid') {
        return NextResponse.json(
          {
            ok: false,
            error: error.code,
            message: error.detail?.message,
            detail: error.detail?.detail,
          },
          { status: error.status }
        );
      }
      return NextResponse.json({ ok: false, error: error.code }, { status: error.status });
    }
    console.error('[images] price estimation failed', error);
    return NextResponse.json({ ok: false, error: 'pricing_error' }, { status: 500 });
  }
}
