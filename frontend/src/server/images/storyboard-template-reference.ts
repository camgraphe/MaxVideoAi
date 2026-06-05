import { basename, join, normalize, sep } from 'node:path';
import { readFile } from 'node:fs/promises';
import {
  isStorageConfigured,
  recordUserAsset,
  uploadImageToStorage,
  type UploadResult,
} from '@/server/storage';
import type { StoredAssetInfo } from './image-reference-normalization';

const STORYBOARD_TEMPLATE_PATH_PATTERN = /^\/storyboard\/templates\/storyboard-template(?:-portrait)?-(4|6|8)\.png$/;

export type StoryboardTemplateReferenceResolution = {
  urls: string[];
  storedAssetInfoByUrl: Map<string, StoredAssetInfo>;
};

type ResolveDeps = {
  isStorageConfiguredFn?: typeof isStorageConfigured;
  readFileFn?: typeof readFile;
  recordUserAssetFn?: typeof recordUserAsset;
  uploadImageToStorageFn?: typeof uploadImageToStorage;
  cwd?: string;
};

function getStoryboardTemplatePathname(url: string): string | null {
  try {
    const parsed = new URL(url);
    return STORYBOARD_TEMPLATE_PATH_PATTERN.test(parsed.pathname) ? parsed.pathname : null;
  } catch {
    return null;
  }
}

function getStoryboardTemplatePublicRoots(cwd: string): string[] {
  return Array.from(new Set([join(cwd, 'public'), join(cwd, 'frontend', 'public')]));
}

function getStoryboardTemplateFilePath(pathname: string, publicRoot: string): string {
  const relativePath = normalize(pathname.replace(/^\/+/, ''));
  const filePath = join(publicRoot, relativePath);
  const normalizedRoot = normalize(publicRoot + sep);
  if (!normalize(filePath).startsWith(normalizedRoot)) {
    throw new Error('Invalid storyboard template path.');
  }
  return filePath;
}

function isMissingFileError(error: unknown): boolean {
  return (
    Boolean(error && typeof error === 'object') &&
    ((error as NodeJS.ErrnoException).code === 'ENOENT' || (error as NodeJS.ErrnoException).code === 'ENOTDIR')
  );
}

async function readStoryboardTemplateFile(params: {
  pathname: string;
  cwd: string;
  readFileFn: typeof readFile;
}): Promise<Buffer> {
  let missingFileError: unknown = null;
  for (const publicRoot of getStoryboardTemplatePublicRoots(params.cwd)) {
    try {
      return (await params.readFileFn(getStoryboardTemplateFilePath(params.pathname, publicRoot))) as Buffer;
    } catch (error) {
      if (!isMissingFileError(error)) {
        throw error;
      }
      missingFileError = error;
    }
  }
  throw missingFileError ?? new Error('Storyboard template file was not found.');
}

async function uploadStoryboardTemplateReference(params: {
  pathname: string;
  userId: string;
  deps?: ResolveDeps;
}): Promise<UploadResult> {
  const deps = params.deps ?? {};
  const isStorageConfiguredFn = deps.isStorageConfiguredFn ?? isStorageConfigured;
  if (!isStorageConfiguredFn()) {
    throw new Error('Storage is required to publish storyboard template references.');
  }

  const readFileFn = deps.readFileFn ?? readFile;
  const uploadImageToStorageFn = deps.uploadImageToStorageFn ?? uploadImageToStorage;
  const cwd = deps.cwd ?? process.cwd();
  const data = await readStoryboardTemplateFile({ pathname: params.pathname, cwd, readFileFn });

  return uploadImageToStorageFn({
    data,
    mime: 'image/png',
    userId: params.userId,
    fileName: basename(params.pathname),
    prefix: 'storyboard-template-references',
  });
}

export async function resolveStoryboardTemplateReferenceUrls(params: {
  urls: string[];
  userId: string;
  deps?: ResolveDeps;
}): Promise<StoryboardTemplateReferenceResolution> {
  const storedAssetInfoByUrl = new Map<string, StoredAssetInfo>();
  const recordUserAssetFn = params.deps?.recordUserAssetFn ?? recordUserAsset;
  const urls = await Promise.all(
    params.urls.map(async (url) => {
      const pathname = getStoryboardTemplatePathname(url);
      if (!pathname) return url;

      const upload = await uploadStoryboardTemplateReference({
        pathname,
        userId: params.userId,
        deps: params.deps,
      });

      storedAssetInfoByUrl.set(upload.url, {
        mime: upload.mime,
        width: upload.width,
        height: upload.height,
      });

      await recordUserAssetFn({
        userId: params.userId,
        url: upload.url,
        mime: upload.mime,
        width: upload.width,
        height: upload.height,
        size: upload.size,
        source: 'storyboard_template_reference',
        metadata: {
          originalUrl: url,
          templatePath: pathname,
        },
      }).catch((error) => {
        console.warn('[images] failed to record storyboard template reference asset', error);
      });

      return upload.url;
    })
  );

  return {
    urls,
    storedAssetInfoByUrl,
  };
}
