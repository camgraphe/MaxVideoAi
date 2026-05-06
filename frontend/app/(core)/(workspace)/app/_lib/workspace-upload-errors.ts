import { translateError } from '@/lib/error-messages';

export type UploadableAssetKind = 'image' | 'video' | 'audio';
export type UploadFailurePayload = { error?: unknown; maxMB?: unknown } | null;
export type UploadFailure = Error & {
  code?: string;
  maxMB?: number;
  status?: number;
  assetType?: UploadableAssetKind;
};

function resolveUploadErrorMessage(
  assetType: string,
  status: number,
  errorCode: unknown,
  fallback: string,
  maxMB?: number
): string {
  if (assetType === 'image') {
    return translateError({
      code: typeof errorCode === 'string' ? errorCode : null,
      status,
      message: fallback,
    }).message;
  }
  const normalizedCode = typeof errorCode === 'string' ? errorCode.trim().toUpperCase() : null;
  const sizeLimit =
    typeof maxMB === 'number' && Number.isFinite(maxMB) && maxMB > 0 ? `${Math.round(maxMB)} MB` : 'the upload limit';

  if (assetType === 'video') {
    switch (normalizedCode) {
      case 'FILE_TOO_LARGE':
        return `This video is too large to import. Keep each reference video under ${sizeLimit} and try again.`;
      case 'UNSUPPORTED_TYPE':
        return 'This video format could not be imported. Use a standard MP4 or MOV file and try again.';
      case 'EMPTY_FILE':
        return 'This video file appears to be empty. Export it again from your device and retry.';
      case 'UNAUTHORIZED':
        return 'Your session expired before the video upload could start. Sign in again and retry.';
      case 'UPLOAD_FAILED':
      case 'STORE_FAILED':
        return 'The video reached the server but could not be stored. Please retry in a moment.';
      default:
        break;
    }
  }

  if (assetType === 'audio') {
    switch (normalizedCode) {
      case 'FILE_TOO_LARGE':
        return `This audio file is too large to import. Keep each reference clip under ${sizeLimit} and try again.`;
      case 'UNSUPPORTED_TYPE':
        return 'This audio format could not be imported. Use a standard MP3 or WAV file and try again.';
      case 'EMPTY_FILE':
        return 'This audio file appears to be empty. Export it again from your device and retry.';
      case 'UNAUTHORIZED':
        return 'Your session expired before the audio upload could start. Sign in again and retry.';
      case 'UPLOAD_FAILED':
      case 'STORE_FAILED':
        return 'The audio reached the server but could not be stored. Please retry in a moment.';
      default:
        break;
    }
  }

  if (status === 401) {
    return 'Your session expired before the upload could start. Sign in again and retry.';
  }
  if (status === 413) {
    return `This file is too large to import. Keep it under ${sizeLimit} and try again.`;
  }
  if (typeof errorCode === 'string' && errorCode.trim().length > 0) {
    return errorCode;
  }
  return fallback;
}

export function createUploadFailure(
  assetType: UploadableAssetKind,
  status: number,
  payload: UploadFailurePayload,
  fallback: string
): UploadFailure {
  const code = typeof payload?.error === 'string' ? payload.error : undefined;
  const maxMB = typeof payload?.maxMB === 'number' && Number.isFinite(payload.maxMB) ? payload.maxMB : undefined;
  const error = new Error(resolveUploadErrorMessage(assetType, status, code, fallback, maxMB)) as UploadFailure;
  error.code = code;
  error.maxMB = maxMB;
  error.status = status;
  error.assetType = assetType;
  return error;
}

export function getUploadFailureMessage(
  assetType: UploadableAssetKind,
  error: unknown,
  fallback: string
): string {
  if (error instanceof Error) {
    const uploadError = error as UploadFailure;
    if (uploadError.code || uploadError.status || uploadError.maxMB) {
      return resolveUploadErrorMessage(
        assetType,
        uploadError.status ?? 0,
        uploadError.code ?? uploadError.message,
        fallback,
        uploadError.maxMB
      );
    }
    if (uploadError.name === 'AbortError') {
      return 'The upload was interrupted before it completed. Please try again.';
    }
    if (
      uploadError.message === 'Failed to fetch' ||
      uploadError.message === 'Network request failed' ||
      uploadError.message === 'NetworkError when attempting to fetch resource.'
    ) {
      return 'The upload could not reach the server. Check your connection and try again.';
    }
    return uploadError.message || fallback;
  }
  return fallback;
}
