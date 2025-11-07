/* eslint-disable no-console */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

import dotenv from 'dotenv';
import fg from 'fast-glob';
import OpenAI from 'openai';
import pLimit from 'p-limit';

const FRONTEND_ROOT = process.cwd();
const REPO_ROOT = path.resolve(FRONTEND_ROOT, '..');
const MODELS_ROOT = path.join(REPO_ROOT, 'content', 'models');
const SOURCE_DIR = path.join(MODELS_ROOT, 'en');
const TARGET_DIRS = {
  fr: path.join(MODELS_ROOT, 'fr'),
  es: path.join(MODELS_ROOT, 'es'),
} as const;
const CACHE_DIR = path.join(FRONTEND_ROOT, '.cache');
const CACHE_FILE = path.join(CACHE_DIR, 'models-i18n.json');

dotenv.config({ path: path.join(FRONTEND_ROOT, '.env.local'), override: true });
dotenv.config();

type TargetLocale = 'fr' | 'es';
type FlatRecord = Record<string, string>;

const TARGET_LOCALES: TargetLocale[] = ['fr', 'es'];
const TARGET_LABELS: Record<TargetLocale, string> = {
  fr: 'French (France)',
  es: 'Spanish (Spain)',
};
const MODEL = process.env.OPENAI_MODEL || 'gpt-5-mini';
const PLACEHOLDER_REGEX = /\{[^}]+\}/g;
const BRAND_REGEX =
  /\b(MaxVideoAI|OpenAI|Google|DeepMind|Fal ?AI|Sora ?2(?:\.0| Pro)?|Sora|Veo ?3(?:\.1)?|Veo|Pika ?2\.2|Pika|MiniMax(?: Hailuo 02)?|Hailuo)\b/gi;
const PROTECTED_PLACEHOLDER_START = '«';
const PROTECTED_PLACEHOLDER_END = '»';
const PROTECTED_BRAND_START = '‹';
const PROTECTED_BRAND_END = '›';
const PATH_SEPARATOR = '§';
const CHUNK_SIZE = 40;
const NON_TRANSLATABLE_PATHS: string[][] = [['seo', 'image']];
const limit = pLimit(2);

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is required to translate model overlays.');
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function shouldTranslate(pathParts: string[]) {
  return !NON_TRANSLATABLE_PATHS.some(
    (blocked) => blocked.length === pathParts.length && blocked.every((segment, index) => segment === pathParts[index])
  );
}

function flattenStrings(value: unknown, pathParts: string[] = [], acc: FlatRecord = {}): FlatRecord {
  if (typeof value === 'string') {
    if (shouldTranslate(pathParts)) {
      acc[pathParts.join(PATH_SEPARATOR)] = value;
    }
    return acc;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      flattenStrings(entry, [...pathParts, String(index)], acc);
    });
    return acc;
  }

  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, entry]) => {
      flattenStrings(entry, [...pathParts, key], acc);
    });
  }

  return acc;
}

function setByPath(target: unknown, pathParts: string[], value: string) {
  let cursor = target as Record<string, unknown> | unknown[];
  pathParts.forEach((part, index) => {
    const isLast = index === pathParts.length - 1;
    const numeric = /^\d+$/.test(part);

    if (isLast) {
      if (Array.isArray(cursor)) {
        cursor[Number(part)] = value;
      } else if (cursor && typeof cursor === 'object') {
        (cursor as Record<string, unknown>)[part] = value;
      }
      return;
    }

    if (Array.isArray(cursor)) {
      const idx = Number(part);
      if (cursor[idx] === undefined) {
        cursor[idx] = numeric ? [] : {};
      }
      cursor = cursor[idx] as Record<string, unknown> | unknown[];
    } else if (cursor && typeof cursor === 'object') {
      if (!(part in cursor)) {
        (cursor as Record<string, unknown>)[part] = numeric ? [] : {};
      }
      cursor = (cursor as Record<string, unknown> | unknown[])[part] as Record<string, unknown> | unknown[];
    }
  });
}

function protectPlaceholders(value: string) {
  return value.replace(PLACEHOLDER_REGEX, (match) => `${PROTECTED_PLACEHOLDER_START}${match}${PROTECTED_PLACEHOLDER_END}`);
}

function restorePlaceholders(value: string) {
  const pattern = new RegExp(`${PROTECTED_PLACEHOLDER_START}(\\{[^}]+\\})${PROTECTED_PLACEHOLDER_END}`, 'g');
  return value.replace(pattern, '$1');
}

function protectBrands(value: string) {
  return value.replace(BRAND_REGEX, (match) => `${PROTECTED_BRAND_START}${match}${PROTECTED_BRAND_END}`);
}

function restoreBrands(value: string) {
  const pattern = new RegExp(`${PROTECTED_BRAND_START}(.*?)${PROTECTED_BRAND_END}`, 'g');
  return value.replace(pattern, '$1');
}

function chunkEntries(entries: FlatRecord, size: number) {
  const keys = Object.keys(entries);
  const chunks: FlatRecord[] = [];
  for (let i = 0; i < keys.length; i += size) {
    const slice = keys.slice(i, i + size);
    const chunk: FlatRecord = {};
    slice.forEach((key) => {
      chunk[key] = entries[key];
    });
    chunks.push(chunk);
  }
  return chunks;
}

function buildMessages(locale: TargetLocale, entries: FlatRecord): OpenAI.Chat.ChatCompletionMessageParam[] {
  const localeLabel = TARGET_LABELS[locale];
  return [
    {
      role: 'system',
      content: [
        `Translate marketing copy for engine overlays into ${localeLabel}.`,
        'Return JSON only, matching the provided keys exactly.',
        `Preserve content wrapped with ${PROTECTED_PLACEHOLDER_START} ${PROTECTED_PLACEHOLDER_END} or ${PROTECTED_BRAND_START} ${PROTECTED_BRAND_END}.`,
        'Keep punctuation, numbers, and casing unless grammar requires otherwise.',
      ].join('\n'),
    },
    {
      role: 'user',
      content: JSON.stringify(entries),
    },
  ];
}

async function translateChunk(locale: TargetLocale, entries: FlatRecord): Promise<FlatRecord> {
  const guarded: FlatRecord = {};
  Object.entries(entries).forEach(([key, value]) => {
    guarded[key] = protectBrands(protectPlaceholders(value));
  });

  const response = await client.chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_object' },
    messages: buildMessages(locale, guarded),
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new Error('Received empty translation payload.');
  }

  const parsed = JSON.parse(raw) as Record<string, string>;
  const restored: FlatRecord = {};
  Object.entries(parsed).forEach(([key, value]) => {
    if (typeof value === 'string') {
      restored[key] = restoreBrands(restorePlaceholders(value));
    }
  });
  return restored;
}

async function translateLocale(locale: TargetLocale, entries: FlatRecord): Promise<FlatRecord> {
  const keys = Object.keys(entries);
  if (!keys.length) {
    return {};
  }
  const chunks = chunkEntries(entries, CHUNK_SIZE);
  const result: FlatRecord = {};
  for (const chunk of chunks) {
    const translated = await translateChunk(locale, chunk);
    Object.assign(result, translated);
  }
  return result;
}

async function readCache(): Promise<Record<string, string>> {
  try {
    const raw = await fs.readFile(CACHE_FILE, 'utf8');
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

function cloneData<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T;
}

async function main() {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await Promise.all(Object.values(TARGET_DIRS).map((dir) => fs.mkdir(dir, { recursive: true })));

  const files = await fg('*.json', { cwd: SOURCE_DIR });
  const cache = await readCache();
  const pending: Array<{
    slug: string;
    hash: string;
    data: unknown;
    flat: FlatRecord;
  }> = [];

  for (const file of files) {
    const slug = file.replace(/\.json$/, '');
    const sourcePath = path.join(SOURCE_DIR, file);
    const raw = await fs.readFile(sourcePath, 'utf8');
    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    if (cache[slug] === hash) {
      continue;
    }
    const data = JSON.parse(raw) as unknown;
    const flat = flattenStrings(data);
    pending.push({ slug, hash, data, flat });
  }

  if (!pending.length) {
    console.log('No model overlay changes detected. Skipping translations.');
    return;
  }

  for (const entry of pending) {
    await Promise.all(
      TARGET_LOCALES.map((locale) =>
        limit(async () => {
          const localizedFlat = await translateLocale(locale, entry.flat);
          const localized = cloneData(entry.data);
          Object.entries(localizedFlat).forEach(([pathKey, value]) => {
            const pathParts = pathKey.split(PATH_SEPARATOR);
            setByPath(localized, pathParts, value);
          });
          const targetPath = path.join(TARGET_DIRS[locale], `${entry.slug}.json`);
          await fs.writeFile(targetPath, `${JSON.stringify(localized, null, 2)}\n`, 'utf8');
          console.log(`Translated ${entry.slug} → ${locale}`);
        })
      )
    );
    cache[entry.slug] = entry.hash;
  }

  await fs.writeFile(CACHE_FILE, `${JSON.stringify(cache, null, 2)}\n`, 'utf8');
  console.log(`Completed translations for ${pending.length} model(s).`);
}

main().catch((error) => {
  console.error('Failed to translate model overlays:', error);
  process.exit(1);
});
