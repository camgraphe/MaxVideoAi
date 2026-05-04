import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import sharp from 'sharp';
import { uploadImageToStorage, recordUserAsset } from '@/server/storage';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { ensureAssetSchema } from '@/lib/schema';
import { query } from '@/lib/db';
import { ensureReusableAsset } from '@/server/media-library';
import { createUploadImageThumbnail } from '@/server/upload-thumbnails';

export const runtime = 'nodejs';

const MAX_IMAGE_MB = Number(process.env.ASSET_MAX_IMAGE_MB ?? '25');
const IMAGE_MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  heic: 'image/heic',
  heif: 'image/heif',
  avif: 'image/avif',
};
const WEB_SAFE_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);

function inferImageMimeFromFileName(fileName: string): string | null {
  const extension = fileName.split('.').pop()?.trim().toLowerCase() ?? '';
  return IMAGE_MIME_BY_EXTENSION[extension] ?? null;
}

function normalizeUploadFileName(fileName: string, mime: string): string {
  const extension = mime === 'image/webp' ? 'webp' : mime === 'image/png' ? 'png' : 'jpg';
  const baseName = fileName.replace(/\.[a-zA-Z0-9]{1,10}$/, '') || 'upload';
  return `${baseName}.${extension}`;
}

function mimeFromSharpFormat(format: string | undefined): string | null {
  if (!format) return null;
  if (format === 'jpeg') return 'image/jpeg';
  if (format === 'png') return 'image/png';
  if (format === 'webp') return 'image/webp';
  if (format === 'gif') return 'image/gif';
  if (format === 'heif') return 'image/heif';
  if (format === 'avif') return 'image/avif';
  if (format === 'tiff') return 'image/tiff';
  return null;
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const blob = form.get('file');

  if (!(blob instanceof File)) {
    return NextResponse.json({ ok: false, error: 'FILE_REQUIRED' }, { status: 400 });
  }

  const declaredMime = blob.type?.trim().toLowerCase() || null;
  const inferredMime = inferImageMimeFromFileName(blob.name);

  const size = blob.size ?? 0;
  if (Number.isFinite(MAX_IMAGE_MB) && MAX_IMAGE_MB > 0 && size > MAX_IMAGE_MB * 1024 * 1024) {
    return NextResponse.json(
      { ok: false, error: 'FILE_TOO_LARGE', maxMB: MAX_IMAGE_MB },
      { status: 413 }
    );
  }

  const arrayBuffer = await blob.arrayBuffer();
  const originalBuffer: Buffer = Buffer.from(arrayBuffer);

  if (!originalBuffer.length) {
    return NextResponse.json({ ok: false, error: 'EMPTY_FILE' }, { status: 400 });
  }

  let uploadBuffer: Buffer = originalBuffer;
  let uploadMime = declaredMime && declaredMime.startsWith('image/') ? declaredMime : inferredMime;
  let uploadFileName = blob.name;
  let normalizedFromMime: string | null = null;

  let metadata: sharp.Metadata | null = null;
  try {
    metadata = await sharp(originalBuffer, { failOn: 'none' }).metadata();
  } catch {
    metadata = null;
  }

  if (!uploadMime || !uploadMime.startsWith('image/')) {
    uploadMime = mimeFromSharpFormat(metadata?.format) ?? null;
  }

  if (!uploadMime || !uploadMime.startsWith('image/')) {
    console.warn('[upload] rejecting unsupported image upload', {
      fileName: blob.name,
      declaredMime,
      inferredMime,
      detectedFormat: metadata?.format ?? null,
      size,
    });
    return NextResponse.json({ ok: false, error: 'UNSUPPORTED_TYPE' }, { status: 415 });
  }

  if (!WEB_SAFE_IMAGE_MIMES.has(uploadMime)) {
    try {
      if (!metadata) {
        metadata = await sharp(originalBuffer, { failOn: 'none' }).metadata();
      }
      const targetMime = metadata?.hasAlpha ? 'image/webp' : 'image/jpeg';
      let pipeline = sharp(originalBuffer, { failOn: 'none' }).rotate();
      if (targetMime === 'image/webp') {
        pipeline = pipeline.webp({ quality: 90 });
      } else {
        pipeline = pipeline.jpeg({ quality: 90, mozjpeg: true });
      }
      uploadBuffer = Buffer.from(await pipeline.toBuffer());
      normalizedFromMime = uploadMime;
      uploadMime = targetMime;
      uploadFileName = normalizeUploadFileName(blob.name, targetMime);
    } catch (error) {
      console.error('[upload] failed to normalize image upload', {
        fileName: blob.name,
        declaredMime,
        inferredMime,
        detectedFormat: metadata?.format ?? null,
        size,
        error,
      });
      return NextResponse.json({ ok: false, error: 'UNSUPPORTED_TYPE' }, { status: 415 });
    }
  }

  const { userId } = await getRouteAuthContext(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const contentSha256 = createHash('sha256').update(uploadBuffer).digest('hex');
  await ensureAssetSchema();

  const existingAssets = await query<{
    asset_id: string;
    url: string;
    mime_type: string | null;
    width: number | null;
    height: number | null;
    size_bytes: string | number | null;
    thumb_url: string | null;
  }>(
    `SELECT ua.asset_id,
            ua.url,
            ua.mime_type,
            ua.width,
            ua.height,
            ua.size_bytes,
            COALESCE(ma.thumb_url, ua.metadata->>'thumbUrl') AS thumb_url
     FROM user_assets ua
     LEFT JOIN media_assets ma
       ON ma.user_id = ua.user_id
      AND ma.url = ua.url
      AND ma.deleted_at IS NULL
     WHERE ua.user_id = $1
       AND ua.source = 'upload'
       AND ua.metadata->>'contentSha256' = $2
     ORDER BY ua.created_at DESC
     LIMIT 1`,
    [userId, contentSha256]
  );

  if (existingAssets.length > 0) {
    const [asset] = existingAssets;
    return NextResponse.json({
      ok: true,
      asset: {
        id: asset.asset_id,
        url: asset.url,
        width: asset.width,
        height: asset.height,
        size: typeof asset.size_bytes === 'string' ? Number(asset.size_bytes) : asset.size_bytes,
        mime: asset.mime_type,
        name: blob.name,
        thumbUrl: asset.thumb_url,
      },
    });
  }

  let uploadResult;
  try {
    uploadResult = await uploadImageToStorage({
      data: uploadBuffer,
      mime: uploadMime,
      fileName: uploadFileName,
      userId: userId ?? undefined,
      prefix: 'user-assets',
    });
  } catch (error) {
    console.error('[upload] failed to store image', error);
    return NextResponse.json({ ok: false, error: 'UPLOAD_FAILED' }, { status: 500 });
  }

  try {
    const imageThumbUrl = await createUploadImageThumbnail({
      data: uploadBuffer,
      userId,
      fileName: uploadFileName,
    });

    const assetId = await recordUserAsset({
      userId: userId ?? null,
      url: uploadResult.url,
      mime: uploadResult.mime,
      width: uploadResult.width,
      height: uploadResult.height,
      size: uploadResult.size,
      source: 'upload',
      metadata: {
        originalName: blob.name,
        originalMime: declaredMime,
        normalizedFromMime,
        contentSha256,
        thumbUrl: imageThumbUrl,
      },
    });

    await ensureReusableAsset({
      userId,
      url: uploadResult.url,
      kind: 'image',
      source: 'upload',
      mimeType: uploadResult.mime,
      width: uploadResult.width,
      height: uploadResult.height,
      sizeBytes: uploadResult.size,
      thumbUrl: imageThumbUrl,
    }).catch((error) => {
      console.warn('[upload] failed to mirror image into media_assets', error);
    });

    return NextResponse.json({
      ok: true,
      asset: {
        id: assetId,
        url: uploadResult.url,
        width: uploadResult.width,
        height: uploadResult.height,
        size: uploadResult.size,
        mime: uploadResult.mime,
        name: blob.name,
        thumbUrl: imageThumbUrl,
      },
    });
  } catch (error) {
    console.error('[upload] failed to record asset', error);
    return NextResponse.json({ ok: false, error: 'STORE_FAILED' }, { status: 500 });
  }
}
