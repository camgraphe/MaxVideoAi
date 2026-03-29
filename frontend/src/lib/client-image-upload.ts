'use client';

const DEFAULT_MAX_IMAGE_DIMENSION = Number.parseInt(
  process.env.NEXT_PUBLIC_ASSET_MAX_IMAGE_DIMENSION ?? '6144',
  10
);
const DEFAULT_SCALE_STEP = 0.85;
const DEFAULT_START_QUALITY = 0.9;
const DEFAULT_MIN_QUALITY = 0.66;
const DEFAULT_QUALITY_STEP = 0.08;

type DecodeResult = {
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
  dispose: () => void;
};

type PrepareImageFileOptions = {
  maxBytes: number;
  maxDimension?: number;
};

function clampPositiveInt(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.max(1, Math.round(value));
}

function buildOutputFileName(file: File, mime: string): string {
  const extension = mime === 'image/webp' ? 'webp' : 'jpg';
  const baseName = file.name.replace(/\.[a-zA-Z0-9]{1,10}$/, '') || 'upload';
  return `${baseName}.${extension}`;
}

async function decodeImageFile(file: File): Promise<DecodeResult> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: (ctx, width, height) => {
          ctx.drawImage(bitmap, 0, 0, width, height);
        },
        dispose: () => {
          bitmap.close();
        },
      };
    } catch {
      // Some mobile formats, especially iPhone HEIC/HEIF variants, can render
      // in <img> even when createImageBitmap rejects them.
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.decoding = 'async';
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('Unable to decode image file.'));
      element.src = objectUrl;
    });

    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      draw: (ctx, width, height) => {
        ctx.drawImage(image, 0, 0, width, height);
      },
      dispose: () => {
        URL.revokeObjectURL(objectUrl);
      },
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

async function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: string,
  quality?: number
): Promise<Blob | null> {
  return await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, mime, quality);
  });
}

function renderCanvasBlob(params: {
  decoded: DecodeResult;
  width: number;
  height: number;
  mime: string;
  quality: number;
}): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = params.width;
  canvas.height = params.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.resolve(null);
  if (params.mime === 'image/jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, params.width, params.height);
  } else {
    ctx.clearRect(0, 0, params.width, params.height);
  }
  params.decoded.draw(ctx, params.width, params.height);
  return canvasToBlob(canvas, params.mime, params.quality);
}

export async function prepareImageFileForUpload(
  file: File,
  options: PrepareImageFileOptions
): Promise<File> {
  if (!file.type.startsWith('image/')) return file;

  const maxBytes = clampPositiveInt(options.maxBytes, 25 * 1024 * 1024);
  const maxDimension = clampPositiveInt(
    options.maxDimension ?? DEFAULT_MAX_IMAGE_DIMENSION,
    DEFAULT_MAX_IMAGE_DIMENSION
  );

  let decoded: DecodeResult;
  try {
    decoded = await decodeImageFile(file);
  } catch {
    // Import should accept the widest range of images possible. If the browser
    // cannot decode the file for client-side transcoding but the original file
    // already fits the upload cap, let the server store the original asset.
    if (file.size <= maxBytes) {
      return file;
    }
    throw new Error('Unable to process this image in the browser before upload.');
  }
  try {
    let targetWidth = decoded.width;
    let targetHeight = decoded.height;
    if (maxDimension > 0) {
      const sourceMaxDimension = Math.max(targetWidth, targetHeight);
      if (sourceMaxDimension > maxDimension) {
        const scale = maxDimension / sourceMaxDimension;
        targetWidth = Math.max(1, Math.round(targetWidth * scale));
        targetHeight = Math.max(1, Math.round(targetHeight * scale));
      }
    }

    if (
      file.size <= maxBytes &&
      targetWidth === decoded.width &&
      targetHeight === decoded.height
    ) {
      return file;
    }

    const preferredMime = file.type === 'image/jpeg' || file.type === 'image/jpg'
      ? 'image/jpeg'
      : 'image/webp';
    const fallbackMime = preferredMime === 'image/webp' ? 'image/jpeg' : 'image/webp';

    let workingWidth = targetWidth;
    let workingHeight = targetHeight;
    let bestBlob: Blob | null = null;
    let bestMime = preferredMime;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      for (const mime of [preferredMime, fallbackMime]) {
        for (
          let quality = DEFAULT_START_QUALITY;
          quality >= DEFAULT_MIN_QUALITY;
          quality -= DEFAULT_QUALITY_STEP
        ) {
          const blob = await renderCanvasBlob({
            decoded,
            width: workingWidth,
            height: workingHeight,
            mime,
            quality,
          });
          if (!blob || !blob.size) continue;

          if (!bestBlob || blob.size < bestBlob.size) {
            bestBlob = blob;
            bestMime = mime;
          }

          if (blob.size <= maxBytes) {
            return new File([blob], buildOutputFileName(file, mime), {
              type: mime,
              lastModified: file.lastModified,
            });
          }
        }
      }

      workingWidth = Math.max(1, Math.round(workingWidth * DEFAULT_SCALE_STEP));
      workingHeight = Math.max(1, Math.round(workingHeight * DEFAULT_SCALE_STEP));
    }

    if (!bestBlob) return file;

    if (bestBlob.size >= file.size && file.size <= maxBytes) {
      return file;
    }

    return new File([bestBlob], buildOutputFileName(file, bestMime), {
      type: bestMime,
      lastModified: file.lastModified,
    });
  } finally {
    decoded.dispose();
  }
}
