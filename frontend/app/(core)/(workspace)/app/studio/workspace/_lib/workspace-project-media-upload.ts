import { authFetch } from '@/lib/authFetch';
import { prepareImageFileForUpload } from '@/lib/client-image-upload';
import { createUploadFailure } from '../../../_lib/workspace-upload-errors';
import {
  workspaceLibraryAssetFromUploadedAsset,
  type WorkspaceLibraryAsset,
  type WorkspaceLibraryKind,
} from './workspace-library-assets';

export const WORKSPACE_PROJECT_MEDIA_UPLOAD_ACCEPT = 'image/*,video/*,audio/*';

const WORKSPACE_PROJECT_MEDIA_UPLOAD_ENDPOINTS = {
  image: '/api/uploads/image',
  video: '/api/uploads/video',
  audio: '/api/uploads/audio',
} as const satisfies Record<WorkspaceLibraryKind, string>;

type ProjectMediaUploadPayload = {
  ok?: boolean;
  asset?: unknown;
  error?: unknown;
  maxMB?: unknown;
};

function workspaceProjectMediaKindFromFileName(fileName: string): WorkspaceLibraryKind | null {
  const normalizedName = fileName.split(/[?#]/)[0]?.toLowerCase() ?? '';
  if (/\.(png|jpe?g|webp|gif|avif|heic)$/.test(normalizedName)) return 'image';
  if (/\.(mp4|webm|mov|m4v|avi|mkv)$/.test(normalizedName)) return 'video';
  if (/\.(mp3|wav|ogg|m4a|aac|flac)$/.test(normalizedName)) return 'audio';
  return null;
}

export function workspaceProjectMediaUploadKindForFile(file: File): WorkspaceLibraryKind | null {
  const normalizedType = file.type.toLowerCase();
  if (normalizedType.startsWith('image/')) return 'image';
  if (normalizedType.startsWith('video/')) return 'video';
  if (normalizedType.startsWith('audio/')) return 'audio';
  return workspaceProjectMediaKindFromFileName(file.name);
}

export async function uploadWorkspaceProjectMediaFile(
  file: File,
  failureMessage: string
): Promise<WorkspaceLibraryAsset> {
  const uploadKind = workspaceProjectMediaUploadKindForFile(file);
  if (!uploadKind) throw new Error('Unsupported project media file');

  const preparedFile =
    uploadKind === 'image'
      ? await prepareImageFileForUpload(file, { maxBytes: 25 * 1024 * 1024 })
      : file;
  const formData = new FormData();
  formData.append('file', preparedFile, preparedFile.name);
  const response = await authFetch(WORKSPACE_PROJECT_MEDIA_UPLOAD_ENDPOINTS[uploadKind], {
    method: 'POST',
    body: formData,
  });
  const payload = (await response.json().catch(() => null)) as ProjectMediaUploadPayload | null;
  const uploadedAsset = workspaceLibraryAssetFromUploadedAsset(payload?.asset, uploadKind);
  if (!response.ok || !payload?.ok || !uploadedAsset) {
    throw createUploadFailure(uploadKind, response.status, payload, failureMessage);
  }

  return uploadedAsset;
}
