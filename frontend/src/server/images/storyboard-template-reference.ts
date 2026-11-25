import { basename, join, normalize, sep } from 'node:path';
import { readFile } from 'node:fs/promises';
import { CANONICAL_PRODUCTION_ORIGIN, SITE_ORIGIN } from '@/lib/siteOrigin';
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

function isLocalTemplateHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized === '127.0.0.1' ||
    normalized === '::1' ||
    normalized === '[::1]'
  );
}

function parseStoryboardTemplateUrl(url: string): URL | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    return url === `${parsed.origin}${parsed.pathname}` && STORYBOARD_TEMPLATE_PATH_PATTERN.test(parsed.pathname)
      ? parsed : null;
  } catch {
    return null;
  }
}

/** Project an exact browser template choice to the pinned public PNG. */
export function getPublicStoryboardTemplateReferenceUrl(url: string): string | null {
  const parsed = parseStoryboardTemplateUrl(url);
  if (!parsed || parsed.protocol !== 'https:') return null;
  const trustedOrigins = [CANONICAL_PRODUCTION_ORIGIN, SITE_ORIGIN];
  for (const host of [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]) {
    if (host) trustedOrigins.push(`https://${host}`);
  }
  return trustedOrigins.includes(parsed.origin) ? `${CANONICAL_PRODUCTION_ORIGIN}${parsed.pathname}` : null;
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
  firstSlotOnly?: boolean;
  deps?: ResolveDeps;
}): Promise<StoryboardTemplateReferenceResolution> {
  const storedAssetInfoByUrl = new Map<string, StoredAssetInfo>();
  const recordUserAssetFn = params.deps?.recordUserAssetFn ?? recordUserAsset;
  const urls = await Promise.all(
    params.urls.map(async (url, index) => {
      if (params.firstSlotOnly && index > 0) return url;
      const template = parseStoryboardTemplateUrl(url);
      if (!template || !isLocalTemplateHost(template.hostname)) return url;
      const { pathname } = template;

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
