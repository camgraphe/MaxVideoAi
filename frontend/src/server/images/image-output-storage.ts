import { normalizeMediaUrl } from '@/lib/media';
import {
  extractStorageKeyFromUrl,
  isStorageConfigured,
  uploadImageToStorage,
  type UploadResult,
} from '@/server/storage';
import type { GeneratedImage } from '@/types/image-generation';

type ImageOutputStorageDeps = {
  extractStorageKeyFromUrl?: (url: string) => string | null;
  fetch?: (input: string, init?: RequestInit) => Promise<Response>;
  isStorageConfigured?: () => boolean;
  uploadImageToStorage?: typeof uploadImageToStorage;
};

const DEFAULT_FETCH_TIMEOUT_MS = 30_000;

function inferImageExtension(mime: string | null, url: string): string {
  const normalizedMime = mime?.split(';')[0]?.trim().toLowerCase();
  if (normalizedMime === 'image/jpeg' || normalizedMime === 'image/jpg') return 'jpg';
  if (normalizedMime === 'image/png') return 'png';
  if (normalizedMime === 'image/webp') return 'webp';
  const cleanPath = url.split('?')[0]?.toLowerCase() ?? '';
  const match = cleanPath.match(/\.([a-z0-9]{2,5})$/);
  return match?.[1] ?? 'jpg';
}

async function fetchImageBuffer(
  url: string,
  fetchImpl: NonNullable<ImageOutputStorageDeps['fetch']>
): Promise<{ data: Buffer; mime: string | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_FETCH_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`FETCH_FAILED:${response.status}`);
    }
    const data = Buffer.from(await response.arrayBuffer());
    if (!data.length) {
      throw new Error('EMPTY_IMAGE');
    }
    const mime = response.headers.get('content-type')?.split(';')[0]?.trim() ?? null;
    return { data, mime };
  } finally {
    clearTimeout(timer);
  }
}

async function copyImageToStorage(params: {
  image: GeneratedImage;
  index: number;
  jobId: string;
  userId: string;
  requireOwnedOutput: boolean;
  deps: Required<ImageOutputStorageDeps>;
}): Promise<GeneratedImage> {
  const sourceUrl = normalizeMediaUrl(params.image.url) ?? params.image.url;
  if (!/^https?:\/\//i.test(sourceUrl)) return params.image;
  if (params.deps.extractStorageKeyFromUrl(sourceUrl)) return params.image;

  try {
    const source = await fetchImageBuffer(sourceUrl, params.deps.fetch);
    const mime = source.mime ?? params.image.mimeType ?? 'image/jpeg';
    const upload: UploadResult = await params.deps.uploadImageToStorage({
      data: source.data,
      mime,
      userId: params.userId,
      prefix: 'renders/images',
      fileName: `${params.jobId}-${params.index + 1}.${inferImageExtension(mime, sourceUrl)}`,
    });
    const storedUrl = normalizeMediaUrl(upload.url) ?? upload.url;
    if (params.requireOwnedOutput && !params.deps.extractStorageKeyFromUrl(storedUrl)) {
      throw new Error('Uploaded image URL is not owned by MaxVideoAI storage');
    }
    return {
      ...params.image,
      url: storedUrl,
      width: upload.width ?? params.image.width ?? null,
      height: upload.height ?? params.image.height ?? null,
      mimeType: upload.mime ?? params.image.mimeType ?? mime,
    };
  } catch (error) {
    console.warn('[images] failed to copy generated image to storage', {
      jobId: params.jobId,
      index: params.index,
      sourceUrl,
      error,
    });
    if (params.requireOwnedOutput) {
      throw new Error('Could not persist generated image to MaxVideoAI storage', { cause: error });
    }
    return params.image;
  }
}

export async function copyGeneratedImagesToStorage(params: {
  images: GeneratedImage[];
  jobId: string;
  userId: string;
  requireOwnedOutput?: boolean;
  deps?: ImageOutputStorageDeps;
}): Promise<GeneratedImage[]> {
  const deps: Required<ImageOutputStorageDeps> = {
    extractStorageKeyFromUrl: params.deps?.extractStorageKeyFromUrl ?? extractStorageKeyFromUrl,
    fetch: params.deps?.fetch ?? fetch,
    isStorageConfigured: params.deps?.isStorageConfigured ?? isStorageConfigured,
    uploadImageToStorage: params.deps?.uploadImageToStorage ?? uploadImageToStorage,
  };

  if (!params.images.length) {
    return params.images;
  }

  const hasExternalOutput = params.images.some((image) => {
    const sourceUrl = normalizeMediaUrl(image.url) ?? image.url;
    return /^https?:\/\//i.test(sourceUrl) && !deps.extractStorageKeyFromUrl(sourceUrl);
  });
  if (!deps.isStorageConfigured()) {
    if (params.requireOwnedOutput && hasExternalOutput) {
      throw new Error('MaxVideoAI storage is required for generated image outputs');
    }
    return params.images;
  }

  return Promise.all(
    params.images.map((image, index) =>
      copyImageToStorage({
        image,
        index,
        jobId: params.jobId,
        userId: params.userId,
        requireOwnedOutput: params.requireOwnedOutput === true,
        deps,
      })
    )
  );
}
