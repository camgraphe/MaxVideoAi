import 'server-only';

import path from 'node:path';
import fs from 'node:fs/promises';
import type { AppLocale } from '@/i18n/locales';

type EngineOverlayPrompt =
  | string
  | {
      title?: string;
      prompt?: string;
      notes?: string;
    };

type EngineOverlayFaq = {
  q?: string;
  question?: string;
  a?: string;
  answer?: string;
};

type OverlayLink = {
  label?: string;
  href?: string;
  before?: string;
  after?: string;
};

type OverlayHero = {
  title?: string;
  intro?: string;
  ctaPrimary?: OverlayLink;
  secondaryLinks?: OverlayLink[];
};

type OverlayBestUseCases = {
  title?: string;
  items?: string[];
};

type OverlayTechnicalOverviewEntry = {
  label?: string;
  body?: string;
  link?: OverlayLink;
};

type OverlayPromptStructure = {
  title?: string;
  quote?: string;
  description?: string;
  steps?: string[];
};

type OverlayTips = {
  title?: string;
  items?: string[];
};

type EngineOverlay = {
  marketingName?: string;
  versionLabel?: string;
  overview?: string;
  pricingNotes?: string;
  seo?: {
    title?: string;
    description?: string;
    image?: string;
  };
  hero?: OverlayHero;
  bestUseCases?: OverlayBestUseCases;
  technicalOverviewTitle?: string;
  technicalOverview?: OverlayTechnicalOverviewEntry[];
  promptStructure?: OverlayPromptStructure;
  tips?: OverlayTips;
  compareLink?: OverlayLink;
  prompts?: EngineOverlayPrompt[];
  faqs?: EngineOverlayFaq[];
};

export type LocalizedPrompt = {
  title: string;
  prompt: string;
  notes?: string;
};

export type LocalizedFaq = {
  question: string;
  answer: string;
};

export type EngineLocalizedContent = {
  marketingName?: string;
  versionLabel?: string;
  overview?: string;
  pricingNotes?: string;
  seo: {
    title?: string;
    description?: string;
    image?: string;
  };
  hero?: OverlayHero;
  bestUseCases?: OverlayBestUseCases;
  technicalOverviewTitle?: string;
  technicalOverview?: OverlayTechnicalOverviewEntry[];
  promptStructure?: OverlayPromptStructure;
  tips?: OverlayTips;
  compareLink?: OverlayLink;
  prompts: LocalizedPrompt[];
  faqs: LocalizedFaq[];
};

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

function mergeSeo(base?: EngineOverlay['seo'], overlay?: EngineOverlay['seo']) {
  return {
    title: overlay?.title ?? base?.title,
    description: overlay?.description ?? base?.description,
    image: overlay?.image ?? base?.image,
  };
}

function normalizePrompts(entries?: EngineOverlayPrompt[]): LocalizedPrompt[] {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries
    .map((entry, index) => {
      if (typeof entry === 'string') {
        const text = entry.trim();
        if (!text) return null;
        return {
          title: `Prompt ${index + 1}`,
          prompt: text,
        };
      }
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const promptText = entry.prompt?.trim();
      if (!promptText) {
        return null;
      }
      return {
        title: entry.title?.trim() || `Prompt ${index + 1}`,
        prompt: promptText,
        notes: entry.notes,
      };
    })
    .filter((item): item is LocalizedPrompt => Boolean(item));
}

function normalizeFaqs(entries?: EngineOverlayFaq[]): LocalizedFaq[] {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const question = (entry.q ?? entry.question)?.trim();
      const answer = (entry.a ?? entry.answer)?.trim();
      if (!question || !answer) {
        return null;
      }
      return { question, answer };
    })
    .filter((item): item is LocalizedFaq => Boolean(item));
}

export async function getEngineLocalized(slug: string, locale: AppLocale): Promise<EngineLocalizedContent> {
  const base = await readOverlay(slug, 'en');
  const overlay = locale === 'en' ? base : await readOverlay(slug, locale);
  const resolvedPrompts =
    overlay.prompts && overlay.prompts.length ? normalizePrompts(overlay.prompts) : normalizePrompts(base.prompts);
  const resolvedFaqs =
    overlay.faqs && overlay.faqs.length ? normalizeFaqs(overlay.faqs) : normalizeFaqs(base.faqs);

  return {
    marketingName: overlay.marketingName ?? base.marketingName,
    versionLabel: overlay.versionLabel ?? base.versionLabel,
    overview: overlay.overview ?? base.overview,
    pricingNotes: overlay.pricingNotes ?? base.pricingNotes,
    seo: mergeSeo(base.seo, overlay.seo),
    hero: mergeHero(base.hero, overlay.hero),
    bestUseCases: overlay.bestUseCases ?? base.bestUseCases,
    technicalOverviewTitle: overlay.technicalOverviewTitle ?? base.technicalOverviewTitle,
    technicalOverview: overlay.technicalOverview ?? base.technicalOverview,
    promptStructure: mergePromptStructure(base.promptStructure, overlay.promptStructure),
    tips: overlay.tips ?? base.tips,
    compareLink: overlay.compareLink ?? base.compareLink,
    prompts: resolvedPrompts,
    faqs: resolvedFaqs,
  };
}

function mergeHero(base?: OverlayHero, overlay?: OverlayHero): OverlayHero | undefined {
  if (!base && !overlay) return undefined;
  return {
    title: overlay?.title ?? base?.title,
    intro: overlay?.intro ?? base?.intro,
    ctaPrimary: overlay?.ctaPrimary ?? base?.ctaPrimary,
    secondaryLinks: overlay?.secondaryLinks ?? base?.secondaryLinks,
  };
}

function mergePromptStructure(
  base?: OverlayPromptStructure,
  overlay?: OverlayPromptStructure
): OverlayPromptStructure | undefined {
  if (!base && !overlay) return undefined;
  return {
    title: overlay?.title ?? base?.title,
    quote: overlay?.quote ?? base?.quote,
    description: overlay?.description ?? base?.description,
    steps: overlay?.steps ?? base?.steps,
  };
}
