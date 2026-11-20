import { getCinematicVideoMedia } from './model-page-cinematic-media';
import type { AppLocale } from '@/i18n/locales';

export function cinematicRecipeLinks(href: string | null | undefined, locale: AppLocale) {
  if (!href) return undefined;
  const entry = new URL(href, 'https://maxvideoai.com');
  entry.searchParams.set('lang', locale);
  const reuse = entry.pathname + entry.search;
  entry.searchParams.set('assistant', 'milo');
  entry.searchParams.set('refine', 'example');
  return { href: reuse, refineHref: entry.pathname + entry.search };
}

export function cinematicWorkflowHref(href: string, workflow: 'create' | 'modify' | 'extend', createMode: 't2v' | 'i2v' | 'ref2v' = 't2v') {
  const entry = new URL(href, 'https://maxvideoai.com');
  entry.searchParams.set('mode', { create: createMode, modify: 'v2v', extend: 'extend' }[workflow]);
  return entry.pathname + entry.search;
}

export function cinematicWorkflowBoard(modelSlug: string, workflow: 'create' | 'modify' | 'extend' | 'motion-control') {
  return getCinematicVideoMedia(modelSlug)?.boards.find(board => board.id === workflow);
}

/** Public prompt identity, not arbitrary prompt text or an automatic generation request. */
export function cinematicVideoPromptLinks(href: string, example: string, workflow: 'create' | 'modify' | 'extend' = 'create') {
  const entry = new URL(cinematicWorkflowHref(href, workflow), 'https://maxvideoai.com');
  entry.searchParams.delete('assistant');
  entry.searchParams.delete('refine');
  entry.searchParams.set('videoPrompt', example);
  const reuse = entry.pathname + entry.search;
  entry.searchParams.set('assistant', 'milo');
  entry.searchParams.set('refine', 'example');
  return { href: reuse, refineHref: entry.pathname + entry.search };
}
