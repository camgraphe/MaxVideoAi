import 'server-only';

import path from 'node:path';
import fs from 'node:fs/promises';
import type { AppLocale } from '@/i18n/locales';
import {
  mergeEngineLocalizedContent,
  type EngineLocalizedContent,
  type EngineOverlay,
} from './i18n-normalization';

export type { EngineLocalizedContent, LocalizedFaq, LocalizedPrompt } from './i18n-normalization';

const FRONTEND_ROOT = process.cwd();
let MODELS_CONTENT_DIR = path.join(FRONTEND_ROOT, '..', 'content', 'models');

async function ensureModelsDir(): Promise<string> {
  const candidates = [
    path.join(FRONTEND_ROOT, 'content', 'models'),
    path.join(FRONTEND_ROOT, '..', 'content', 'models'),
  ];
  for (const dir of candidates) {
    try {
      await fs.access(dir);
      MODELS_CONTENT_DIR = dir;
      return dir;
    } catch {
      // keep trying
    }
  }
  // default to sibling content path
  return MODELS_CONTENT_DIR;
}

async function readOverlay(slug: string, locale: AppLocale): Promise<EngineOverlay> {
  const baseDir = await ensureModelsDir();
  const filePath = path.join(baseDir, locale, `${slug}.json`);
  if (process.env.NODE_ENV === 'development') {
    console.info('[models/i18n] read overlay', { slug, locale, filePath });
  }
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as EngineOverlay;
  } catch (error) {
    console.warn(`[models/i18n] Failed to read overlay ${filePath}:`, error);
    return {};
  }
}

export async function getEngineLocalized(slug: string, locale: AppLocale): Promise<EngineLocalizedContent> {
  const base = await readOverlay(slug, 'en');
  const overlay = locale === 'en' ? base : await readOverlay(slug, locale);
  return mergeEngineLocalizedContent(base, overlay);
}
