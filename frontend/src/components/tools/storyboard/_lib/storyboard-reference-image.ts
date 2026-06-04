'use client';

import { authFetch } from '@/lib/authFetch';
import { prepareImageFileForUpload } from '@/lib/client-image-upload';
import type { StoryboardCopy } from './storyboard-workspace-copy';

export type StoryboardReferenceImage = {
  url: string;
  previewUrl: string;
  width?: number | null;
  height?: number | null;
  name?: string | null;
  size?: number;
  type?: string;
  status?: 'uploading' | 'ready' | 'error';
  error?: string | null;
};

const STORYBOARD_REFERENCE_UPLOAD_LIMIT_MB = Number.isFinite(Number(process.env.NEXT_PUBLIC_ASSET_MAX_IMAGE_MB ?? '25'))
  ? Number(process.env.NEXT_PUBLIC_ASSET_MAX_IMAGE_MB ?? '25')
  : 25;

function formatTemplate(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((result, [key, value]) => result.replaceAll(`{${key}}`, String(value)), template);
}

export function cleanupStoryboardReferenceImage(image: StoryboardReferenceImage | null) {
  if (!image?.previewUrl.startsWith('blob:')) return;
  try {
    URL.revokeObjectURL(image.previewUrl);
  } catch {
    // Ignore preview cleanup failures.
  }
}

export async function uploadStoryboardReferenceImage(file: File, copy: StoryboardCopy): Promise<Omit<StoryboardReferenceImage, 'previewUrl'>> {
  const preparedFile = await prepareImageFileForUpload(file, {
    maxBytes: STORYBOARD_REFERENCE_UPLOAD_LIMIT_MB * 1024 * 1024,
  });
  const formData = new FormData();
  formData.set('file', preparedFile, preparedFile.name);

  const response = await authFetch('/api/uploads/image', {
    method: 'POST',
    body: formData,
  });
  const payload = (await response.json().catch(() => null)) as
    | {
        ok?: boolean;
        error?: string;
        maxMB?: number;
        asset?: {
          url: string;
          width?: number | null;
          height?: number | null;
          name?: string | null;
        };
      }
    | null;

  if (!response.ok || !payload?.ok || !payload.asset?.url) {
    if (payload?.error === 'FILE_TOO_LARGE' || response.status === 413) {
      throw new Error(formatTemplate(copy.uploadTooLarge, { maxMB: payload?.maxMB ?? STORYBOARD_REFERENCE_UPLOAD_LIMIT_MB }));
    }
    throw new Error(payload?.error ?? copy.uploadFailed);
  }

  return {
    url: payload.asset.url,
    width: payload.asset.width,
    height: payload.asset.height,
    name: payload.asset.name,
  };
}
