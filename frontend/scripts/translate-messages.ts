import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import deepmerge from 'deepmerge';
import pLimit from 'p-limit';
import OpenAI from 'openai';

const BASE_PATH = process.cwd();
dotenv.config({ path: path.resolve(BASE_PATH, '.env.local'), override: true });
dotenv.config();

type Locale = 'fr' | 'es';
type Dictionary = Record<string, unknown>;
type FlatDictionary = Record<string, string>;

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is required to run translations.');
}

const MODEL = process.env.OPENAI_MODEL || 'gpt-5-mini';
const SOURCE_PATH = path.resolve(BASE_PATH, 'messages/en.json');
const TARGET_PATHS: Record<Locale, string> = {
  fr: path.resolve(BASE_PATH, 'messages/fr.json'),
  es: path.resolve(BASE_PATH, 'messages/es.json'),
};
const GLOSSARY_PATH = path.resolve(BASE_PATH, 'scripts/glossary.json');

const CHUNK_SIZE = 60;
const CONCURRENCY = 2;
const PLACEHOLDER_REGEX = /\{[^}]+\}/g;
const BRAND_REGEX = /\b(MaxVideoAI|Sora ?2(?:\.0)?|Sora|Veo ?3(?:\.1)?|Pika(?: 2\.2)?|MiniMax Hailuo 02)\b/g;
const PATH_SEPARATOR = '§';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const glossary = fs.existsSync(GLOSSARY_PATH)
  ? (JSON.parse(fs.readFileSync(GLOSSARY_PATH, 'utf8')) as Record<string, Record<Locale, string>>)
  : {};

function flatten(input: Dictionary, prefix: string[] = [], accumulator: FlatDictionary = {}): FlatDictionary {
  if (typeof input === 'string') {
    accumulator[prefix.join(PATH_SEPARATOR)] = input;
    return accumulator;
  }

  if (Array.isArray(input)) {
    input.forEach((value, index) => {
      flatten(value as Dictionary, [...prefix, String(index)], accumulator);
    });
    return accumulator;
  }

  if (input && typeof input === 'object') {
    Object.entries(input).forEach(([key, value]) => {
      flatten(value as Dictionary, [...prefix, key], accumulator);
    });
  }

  return accumulator;
}

function setByPath(target: Dictionary, pathParts: string[], value: string) {
  let cursor: Dictionary | unknown[] = target;

  pathParts.forEach((part, index) => {
    const isLast = index === pathParts.length - 1;
    const numeric = /^\d+$/.test(part);

    if (isLast) {
      if (Array.isArray(cursor)) {
        (cursor as unknown[])[Number(part)] = value;
      } else if (cursor && typeof cursor === 'object') {
        (cursor as Dictionary)[part] = value;
      }
      return;
    }

    if (Array.isArray(cursor)) {
      if (!(cursor as unknown[])[Number(part)]) {
        (cursor as unknown[])[Number(part)] = numeric ? [] : {};
      }
      cursor = (cursor as unknown[])[Number(part)] as Dictionary;
    } else if (cursor && typeof cursor === 'object') {
      if (!(cursor as Dictionary)[part]) {
        (cursor as Dictionary)[part] = numeric ? [] : {};
      }
      cursor = (cursor as Dictionary)[part] as Dictionary;
    }
  });
}

function normalizePlaceholders(value: string) {
  return value.replace(PLACEHOLDER_REGEX, (match) => `«${match}»`);
}

function restorePlaceholders(value: string) {
  return value.replace(/«(\{[^}]+\})»/g, '$1');
}

function protectBrands(value: string) {
  return value.replace(BRAND_REGEX, '‹$1›');
}

function restoreBrands(value: string) {
  return value.replace(/‹(.*?)›/g, '$1');
}

function applyGlossary(value: string, locale: Locale) {
  return Object.entries(glossary).reduce((acc, [term, mapping]) => {
    const localized = mapping?.[locale];
    if (!localized) {
      return acc;
    }
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
    return acc.replace(regex, localized);
  }, value);
}

function buildMessages(locale: Locale, entries: FlatDictionary): OpenAI.Chat.ChatCompletionMessageParam[] {
  const localeLabel = locale === 'fr' ? 'French (France)' : 'Spanish (Spain)';
  return [
    {
      role: 'system',
      content: [
        `Translate UI strings into ${localeLabel}.`,
        'Requirements:',
        '- Keep placeholders like {count} intact (they are wrapped using « »).',
        '- Do NOT translate engine/product names (they are wrapped using ‹ ›).',
        '- Preserve punctuation (•, →, x1-x4) and formatting.',
        `- Apply this glossary strictly: ${JSON.stringify(glossary)}`,
        '- Return JSON only, matching the provided keys.',
      ].join('\n'),
    },
    { role: 'user', content: JSON.stringify(entries) },
  ];
}

async function translateChunk(locale: Locale, chunk: FlatDictionary): Promise<FlatDictionary> {
  const guarded: FlatDictionary = {};
  Object.entries(chunk).forEach(([key, value]) => {
    guarded[key] = protectBrands(normalizePlaceholders(value));
  });

  const response = await client.chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_object' },
    messages: buildMessages(locale, guarded),
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new Error('Empty translation response.');
  }

  const parsed = JSON.parse(raw) as FlatDictionary;
  const normalized: FlatDictionary = {};

  Object.entries(parsed).forEach(([key, value]) => {
    let output = String(value);
    output = applyGlossary(output, locale);
    output = restoreBrands(restorePlaceholders(output));
    normalized[key] = output;
  });

  return normalized;
}

function chunkEntries(entries: FlatDictionary): FlatDictionary[] {
  const chunks: FlatDictionary[] = [];
  let current: FlatDictionary = {};

  Object.entries(entries).forEach(([key, value], index) => {
    current[key] = value;
    if ((index + 1) % CHUNK_SIZE === 0) {
      chunks.push(current);
      current = {};
    }
  });

  if (Object.keys(current).length) {
    chunks.push(current);
  }

  return chunks;
}

function loadJson(pathname: string): Dictionary {
  if (!fs.existsSync(pathname)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(pathname, 'utf8')) as Dictionary;
}

async function processLocale(locale: Locale, sourceFlat: FlatDictionary) {
  const targetPath = TARGET_PATHS[locale];
  const existing = loadJson(targetPath);
  const existingFlat = flatten(existing);

  const pendingEntries: FlatDictionary = {};
  Object.entries(sourceFlat).forEach(([key, value]) => {
    if (!(key in existingFlat) || existingFlat[key] === '') {
      pendingEntries[key] = value;
    }
  });

  if (!Object.keys(pendingEntries).length) {
    console.log(`[i18n] ${locale}: no missing keys.`);
    return;
  }

  const limit = pLimit(CONCURRENCY);
  const chunks = chunkEntries(pendingEntries);
  const translated: FlatDictionary = {};

  await Promise.all(
    chunks.map((chunk, index) =>
      limit(async () => {
        const result = await translateChunk(locale, chunk);
        Object.assign(translated, result);
        await sleep(200 + index * 25);
      })
    )
  );

  const updated: Dictionary = JSON.parse(JSON.stringify(existing));
  Object.entries(translated).forEach(([flatKey, translatedValue]) => {
    setByPath(updated, flatKey.split(PATH_SEPARATOR), translatedValue);
  });

  const merged = deepmerge(existing, updated, {
    arrayMerge: (_destinationArray, sourceArray) => sourceArray,
  });

  fs.writeFileSync(targetPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
  console.log(`[i18n] ${locale}: translated ${Object.keys(translated).length} keys.`);
}

async function main() {
  if (!fs.existsSync(SOURCE_PATH)) {
    throw new Error(`Missing source dictionary at ${SOURCE_PATH}`);
  }

  const source = JSON.parse(fs.readFileSync(SOURCE_PATH, 'utf8')) as Dictionary;
  const sourceFlat = flatten(source);

  for (const locale of ['fr', 'es'] as Locale[]) {
    await processLocale(locale, sourceFlat);
  }
}

main().catch((error) => {
  console.error('[i18n] Translation failed:', error);
  process.exit(1);
});
