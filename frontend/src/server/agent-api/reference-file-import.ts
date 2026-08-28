import type { CanonicalReferenceMediaKind } from './generation-types';
import { AgentApiError } from './errors';
import type { AgentPrincipal } from './principal';
import type { AgentOpenUrlDestination } from './types';
import { buildAgentAccountDestinations } from './account-destinations';
import { getReferenceUploadPolicy } from './create-reference-upload-link';
import { downloadReferenceFile } from './reference-file-download';
import { ensureReusableAsset } from '@/server/media-library';
import {
  loadStoredImageUploadRouteAsset,
  storeImageUpload,
} from '@/server/uploads/store-image-upload';
import {
  storeAudioUpload,
  storeVideoUpload,
} from '@/server/uploads/store-media-upload';

export const MAX_REFERENCE_FILES_PER_IMPORT = 8;

export type HostReferenceFile = {
  download_url: string;
  file_id: string;
  mime_type?: string;
  file_name?: string;
};

export type ImportReferenceFilesInput = {
  files: HostReferenceFile[];
};

export type ImportedReferenceAsset = {
  index: number;
  assetId: string;
  kind: CanonicalReferenceMediaKind;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

export type ReferenceFileImportFailure = {
  index: number;
  fileName: string | null;
  code: string;
};

export type ImportReferenceFilesResult = {
  assets: ImportedReferenceAsset[];
  failures: ReferenceFileImportFailure[];
  library: AgentOpenUrlDestination;
};

export type DownloadedReferenceFile = {
  bytes: Buffer;
  fileName: string;
  mimeType: string;
};

export type StoreReferenceFileInput = DownloadedReferenceFile & {
  userId: string;
  kind: CanonicalReferenceMediaKind;
};

export type StoredReferenceFile = Omit<ImportedReferenceAsset, 'index'>;

export type ReferenceFileImportDependencies = {
  baseUrl: string;
  downloadReferenceFile(file: HostReferenceFile): Promise<DownloadedReferenceFile>;
  storeReferenceFile(input: StoreReferenceFileInput): Promise<StoredReferenceFile>;
};

function requirePrincipal(principal: AgentPrincipal): void {
  if (
    principal?.authMethod !== 'oauth'
    || typeof principal.userId !== 'string'
    || principal.userId.length < 1
    || principal.userId.length > 128
    || principal.userId !== principal.userId.trim()
  ) {
    throw new AgentApiError('AUTH_REQUIRED', 'Connect MaxVideoAI before importing reference media.');
  }
}

function resolveMediaKind(mimeType: string): CanonicalReferenceMediaKind | null {
  const normalized = mimeType.trim().toLowerCase();
  for (const kind of ['image', 'video', 'audio'] as const) {
    if (getReferenceUploadPolicy(kind).accepted.includes(normalized as never)) return kind;
  }
  return null;
}

function requireDownloadedFile(file: DownloadedReferenceFile): CanonicalReferenceMediaKind {
  const kind = resolveMediaKind(file.mimeType);
  const policy = kind ? getReferenceUploadPolicy(kind) : null;
  if (
    !kind
    || !policy
    || !Buffer.isBuffer(file.bytes)
    || file.bytes.length < 1
    || file.bytes.length > policy.maxBytes
    || typeof file.fileName !== 'string'
    || file.fileName.length < 1
    || file.fileName.length > 255
    || file.fileName !== file.fileName.trim()
    || /[\u0000-\u001f\u007f]/u.test(file.fileName)
  ) {
    throw new AgentApiError('REFERENCE_INVALID', 'The host file is not a supported reference.');
  }
  return kind;
}

export function createReferenceFileImportService(
  dependencies: ReferenceFileImportDependencies,
): (input: ImportReferenceFilesInput, principal: AgentPrincipal) => Promise<ImportReferenceFilesResult> {
  const destinations = buildAgentAccountDestinations(dependencies.baseUrl);
  return async (input, principal) => {
    requirePrincipal(principal);
    if (!Array.isArray(input?.files)
      || input.files.length < 1
      || input.files.length > MAX_REFERENCE_FILES_PER_IMPORT) {
      throw new AgentApiError(
        'REFERENCE_INVALID',
        `Choose between 1 and ${MAX_REFERENCE_FILES_PER_IMPORT} reference files.`,
      );
    }

    const assets: ImportedReferenceAsset[] = [];
    const failures: ReferenceFileImportFailure[] = [];
    for (const [index, hostFile] of input.files.entries()) {
      try {
        const downloaded = await dependencies.downloadReferenceFile(hostFile);
        const kind = requireDownloadedFile(downloaded);
        const stored = await dependencies.storeReferenceFile({
          userId: principal.userId,
          bytes: downloaded.bytes,
          fileName: downloaded.fileName,
          mimeType: downloaded.mimeType,
          kind,
        });
        if (stored.kind !== kind
          || !/^ma_[a-f0-9]{32}$/u.test(stored.assetId)
          || stored.fileName !== downloaded.fileName
          || stored.mimeType !== downloaded.mimeType
          || stored.sizeBytes !== downloaded.bytes.length) {
          throw new Error('Reference file storage returned an invalid canonical asset.');
        }
        assets.push({ index, ...stored });
      } catch (error) {
        const fileName = typeof hostFile?.file_name === 'string'
          && hostFile.file_name.length >= 1
          && hostFile.file_name.length <= 255
          && !/[\u0000-\u001f\u007f]/u.test(hostFile.file_name)
          ? hostFile.file_name
          : null;
        failures.push({
          index,
          fileName,
          code: error instanceof AgentApiError ? error.code : 'INTERNAL_ERROR',
        });
      }
    }

    return { assets, failures, library: destinations.library };
  };
}

type DefaultReferenceFileImportDependencies = {
  downloadReferenceFile: typeof downloadReferenceFile;
  storeImageUpload: typeof storeImageUpload;
  loadStoredImageUploadRouteAsset: typeof loadStoredImageUploadRouteAsset;
  ensureReusableAsset: typeof ensureReusableAsset;
  storeVideoUpload: typeof storeVideoUpload;
  storeAudioUpload: typeof storeAudioUpload;
};

const defaultReferenceFileImportDependencies: DefaultReferenceFileImportDependencies = {
  downloadReferenceFile,
  storeImageUpload,
  loadStoredImageUploadRouteAsset,
  ensureReusableAsset,
  storeVideoUpload,
  storeAudioUpload,
};

export function createDefaultReferenceFileImportService(
  baseUrl: string,
  overrides: Partial<DefaultReferenceFileImportDependencies> = {},
): (input: ImportReferenceFilesInput, principal: AgentPrincipal) => Promise<ImportReferenceFilesResult> {
  const dependencies = { ...defaultReferenceFileImportDependencies, ...overrides };
  return createReferenceFileImportService({
    baseUrl,
    downloadReferenceFile: dependencies.downloadReferenceFile,
    async storeReferenceFile(input) {
      if (input.kind === 'image') {
        const stored = await dependencies.storeImageUpload({
          userId: input.userId,
          fileName: input.fileName,
          declaredMime: input.mimeType,
          bytes: input.bytes,
          storageAcl: null,
          storageCacheControl: 'private, no-store',
        });
        const image = await dependencies.loadStoredImageUploadRouteAsset({
          userId: input.userId,
          assetId: stored.assetId,
        });
        const canonical = await dependencies.ensureReusableAsset({
          userId: input.userId,
          url: image.url,
          kind: 'image',
          source: 'upload',
          mimeType: image.mimeType,
          width: image.width,
          height: image.height,
          sizeBytes: image.sizeBytes,
          thumbUrl: image.thumbUrl,
        });
        if (!canonical.publicId || !/^ma_[a-f0-9]{32}$/u.test(canonical.publicId)) {
          throw new Error('Canonical image has no public alias.');
        }
        return {
          assetId: canonical.publicId,
          kind: input.kind,
          fileName: input.fileName,
          mimeType: input.mimeType,
          sizeBytes: input.bytes.length,
        };
      }

      const stored = input.kind === 'video'
        ? await dependencies.storeVideoUpload({
            userId: input.userId,
            fileName: input.fileName,
            declaredMime: input.mimeType,
            bytes: input.bytes,
            referenceEligibility: 'mcp',
            storageAcl: null,
            storageCacheControl: 'private, no-store',
          })
        : await dependencies.storeAudioUpload({
            userId: input.userId,
            fileName: input.fileName,
            declaredMime: input.mimeType,
            bytes: input.bytes,
            referenceEligibility: 'mcp',
            storageAcl: null,
            storageCacheControl: 'private, no-store',
          });
      return {
        assetId: stored.assetId,
        kind: input.kind,
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: input.bytes.length,
      };
    },
  });
}
