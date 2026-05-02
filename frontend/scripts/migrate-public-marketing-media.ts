import process from 'node:process';
import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { config as loadEnv } from 'dotenv';
import 'tsconfig-paths/register.js';

loadEnv({ path: path.resolve(process.cwd(), '.env.local'), override: true });
loadEnv({ path: path.resolve(process.cwd(), '.env'), override: false });

const RAW_S3_HOST = 'videohub-uploads-us.s3.amazonaws.com';
const MEDIA_HOST = 'media.maxvideoai.com';
const MEDIA_BASE = `https://${MEDIA_HOST}`;

const TARGET_FILES = [
  'server/engine-demos.ts',
  'src/config/falEngines.ts',
  'src/components/tools/AngleLandingPage.tsx',
  'src/components/tools/AngleWorkspace.tsx',
  'src/components/tools/CharacterBuilderLandingPage.tsx',
  'src/components/tools/CharacterBuilderWorkspace.tsx',
  'src/components/tools/ToolsMarketingHubPage.tsx',
  'src/components/tools/UpscaleLandingPage.tsx',
  'src/components/tools/UpscaleWorkspace.tsx',
  'components/marketing/home/HomeRedesignSections.tsx',
  'app/(localized)/[locale]/(marketing)/(home)/page.tsx',
  'app/(localized)/[locale]/(marketing)/models/[slug]/page.tsx',
  'app/(localized)/[locale]/(marketing)/tools/angle/page.tsx',
  'app/(localized)/[locale]/(marketing)/tools/character-builder/page.tsx',
  'messages/en.json',
  'messages/es.json',
  'messages/fr.json',
];

const TARGET_GLOBS = ['../content'];
const PROVIDER_URL_RE =
  /https:\/\/(?:v3b?\.fal\.media|storage\.googleapis\.com\/falserverless|upload\.wikimedia\.org\/wikipedia\/commons|videohub-uploads-us\.s3\.amazonaws\.com)[^\s'"`)<>,\\]+/g;

function boolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return raw.trim().toLowerCase() === 'true' || raw.trim() === '1';
}

function sanitizeFileName(url: string, fallbackExtension: string): string {
  const parsed = new URL(url);
  const last = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() ?? `asset.${fallbackExtension}`);
  const safe = last.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 120);
  return safe.includes('.') ? safe : `${safe || 'asset'}.${fallbackExtension}`;
}

function extensionForMime(mime: string | null, url: string): string {
  const pathExtension = new URL(url).pathname.match(/\.([a-zA-Z0-9]{1,10})$/)?.[1]?.toLowerCase();
  if (pathExtension) return pathExtension;
  if (mime?.includes('jpeg')) return 'jpg';
  if (mime?.includes('png')) return 'png';
  if (mime?.includes('webp')) return 'webp';
  if (mime?.includes('mp4')) return 'mp4';
  if (mime?.includes('webm')) return 'webm';
  return 'bin';
}

function normalizeAlreadyOwned(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.host !== RAW_S3_HOST) return null;
    return `${MEDIA_BASE}${parsed.pathname}`;
  } catch {
    return null;
  }
}

async function collectFiles(): Promise<string[]> {
  const { readdir, stat } = await import('node:fs/promises');
  const root = process.cwd();
  const files = TARGET_FILES.map((file) => path.resolve(root, file));

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir);
    for (const entry of entries) {
      const full = path.join(dir, entry);
      const info = await stat(full);
      if (info.isDirectory()) {
        await walk(full);
      } else if (/\.(mdx|json)$/.test(entry)) {
        files.push(full);
      }
    }
  }

  for (const globRoot of TARGET_GLOBS) {
    await walk(path.resolve(root, globRoot));
  }

  return Array.from(new Set(files));
}

async function uploadExternal(url: string): Promise<string | null> {
  const { uploadFileBuffer } = await import('../server/storage');
  const { ensureFastStartVideo } = await import('../server/video-faststart');
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    console.warn('[marketing-media] fetch_failed', { host: new URL(url).host, status: response.status });
    return null;
  }

  const mime = response.headers.get('content-type')?.split(';')[0]?.trim() || 'application/octet-stream';
  if (mime === 'video/mp4' || new URL(url).pathname.toLowerCase().endsWith('.mp4')) {
    const copied = await ensureFastStartVideo({
      jobId: `marketing-${Date.now()}`,
      userId: 'marketing',
      videoUrl: url,
    });
    if (copied) return copied;
  }

  const data = Buffer.from(await response.arrayBuffer());
  if (!data.length) return null;
  const extension = extensionForMime(mime, url);
  const upload = await uploadFileBuffer({
    data,
    mime,
    userId: 'marketing',
    prefix: 'marketing',
    fileName: sanitizeFileName(url, extension),
    cacheControl: 'public, max-age=5184000, immutable',
  });
  return upload.url;
}

async function main(): Promise<void> {
  const dryRun = boolEnv('DRY_RUN', true);
  const files = await collectFiles();
  const replacements = new Map<string, string>();
  const missed = new Set<string>();

  for (const file of files) {
    const text = await readFile(file, 'utf8');
    for (const url of text.match(PROVIDER_URL_RE) ?? []) {
      if (replacements.has(url) || missed.has(url)) continue;
      const owned = normalizeAlreadyOwned(url);
      if (owned) {
        replacements.set(url, owned);
        continue;
      }
      if (dryRun) {
        replacements.set(url, `${MEDIA_BASE}/__DRY_RUN_EXTERNAL__/${encodeURIComponent(new URL(url).host)}`);
        continue;
      }
      const uploaded = await uploadExternal(url);
      if (uploaded) {
        replacements.set(url, uploaded);
      } else {
        missed.add(url);
      }
    }
  }

  let filesChanged = 0;
  for (const file of files) {
    const original = await readFile(file, 'utf8');
    let next = original;
    for (const [from, to] of replacements) {
      next = next.split(from).join(to);
    }
    if (next !== original) {
      filesChanged += 1;
      if (!dryRun) {
        await writeFile(file, next);
      }
    }
  }

  console.log(
    `[marketing-media] summary=${JSON.stringify({
      dryRun,
      filesScanned: files.length,
      filesChanged,
      replacements: replacements.size,
      missed: missed.size,
    })}`
  );
  for (const url of missed) {
    console.warn('[marketing-media] missed', { host: new URL(url).host, path: new URL(url).pathname });
  }
}

void main().catch((error) => {
  console.error('[marketing-media] unrecoverable error', error);
  process.exit(1);
});
