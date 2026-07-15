import { z } from 'zod';

import type { AppLocale } from '@/i18n/locales';

const nonEmptyString = z.string().refine((value) => value.trim().length > 0, 'Expected a non-empty string');
const nullableString = nonEmptyString.nullable();
const tabSchema = z.object({
  id: nonEmptyString,
  label: nonEmptyString,
  title: nonEmptyString,
  description: nullableString,
  copy: nonEmptyString,
}).strict();
const demoSchema = z.object({
  title: nonEmptyString,
  promptLabel: nonEmptyString,
  prompt: nonEmptyString,
  notes: z.array(nonEmptyString),
  summary: z.object({
    subject: nonEmptyString,
    action: nonEmptyString,
    camera: nonEmptyString,
    style: nonEmptyString,
    output: nonEmptyString,
  }).strict(),
  presentationOverrides: z.object({
    modeLabel: nonEmptyString,
    outputLabel: nonEmptyString,
    duration: nullableString,
    aspectRatio: nullableString,
    audioChipMode: z.enum(['media', 'supported', 'on', 'off', 'silent']),
    audioChipLabel: nullableString,
    altContext: nonEmptyString,
  }).strict(),
}).strict();
const imageExampleSchema = z.object({
  id: nonEmptyString,
  title: nonEmptyString,
  badge: nonEmptyString,
  kind: z.enum(['image', 'references', 'edit', 'typography', 'layout', 'quality']),
  prompt: nonEmptyString,
}).strict();
const promptingSchema = z.object({
  modelSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  section: z.object({
    title: nonEmptyString,
    intro: nullableString,
    tip: nullableString,
    guide: z.object({ label: nonEmptyString, href: nonEmptyString }).strict().nullable(),
    referencesTitle: nullableString,
  }).strict(),
  tabs: z.array(tabSchema),
  tabNotes: z.array(z.object({ tabId: nonEmptyString, body: nonEmptyString }).strict()),
  globalPrinciples: z.array(nonEmptyString),
  engineWhy: z.array(nonEmptyString),
  demo: demoSchema.nullable(),
  imageExamples: z.object({
    title: nonEmptyString,
    intro: nonEmptyString,
    workspaceLabel: nonEmptyString,
    items: z.array(imageExampleSchema).min(1),
  }).strict().nullable(),
}).strict();

export type ModelPromptingContent = z.infer<typeof promptingSchema>;

const INTERNAL_GUIDE_HREF: Record<AppLocale, RegExp> = {
  en: /^\/models\/[a-z0-9]+(?:-[a-z0-9]+)*$/,
  fr: /^\/fr\/modeles\/[a-z0-9]+(?:-[a-z0-9]+)*$/,
  es: /^\/es\/modelos\/[a-z0-9]+(?:-[a-z0-9]+)*$/,
};

function isAllowedGuideHref(href: string, locale: AppLocale): boolean {
  return /^https:\/\/[^\s]+$/.test(href) || INTERNAL_GUIDE_HREF[locale].test(href);
}

export function parseModelPromptingContent(
  input: unknown,
  expectedSlug: string,
  locale: AppLocale,
  source = `content/models/${locale}/${expectedSlug}.json#prompting`,
): ModelPromptingContent {
  if (input === undefined) {
    throw new Error(`[model-prompting-content] Missing prompting content for ${expectedSlug}/${locale} in ${source}`);
  }
  const result = promptingSchema.safeParse(input);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`).join('; ');
    throw new Error(`[model-prompting-content] Invalid prompting content in ${source}: ${issues}`);
  }
  if (result.data.modelSlug !== expectedSlug) {
    throw new Error(`[model-prompting-content] Model identity mismatch in ${source}: expected ${expectedSlug}, received ${result.data.modelSlug}`);
  }
  const tabIds = new Set(result.data.tabs.map((tab) => tab.id));
  if (tabIds.size !== result.data.tabs.length) throw new Error(`[model-prompting-content] Duplicate tab id in ${source}`);
  const notedTabIds = new Set<string>();
  for (const note of result.data.tabNotes) {
    if (!tabIds.has(note.tabId)) throw new Error(`[model-prompting-content] Tab note references unknown tab ${note.tabId} in ${source}`);
    if (notedTabIds.has(note.tabId)) throw new Error(`[model-prompting-content] Duplicate tab note for ${note.tabId} in ${source}`);
    notedTabIds.add(note.tabId);
  }
  const exampleIds = result.data.imageExamples?.items.map((item) => item.id) ?? [];
  if (new Set(exampleIds).size !== exampleIds.length) {
    throw new Error(`[model-prompting-content] Duplicate image example id in ${source}`);
  }
  if (Boolean(result.data.demo) === Boolean(result.data.imageExamples)) {
    throw new Error(`[model-prompting-content] Expected exactly one demo or imageExamples block in ${source}`);
  }
  const guideHref = result.data.section.guide?.href;
  if (guideHref && !isAllowedGuideHref(guideHref, locale)) {
    throw new Error(`[model-prompting-content] Invalid ${locale} guide href in ${source}: ${JSON.stringify(guideHref)}`);
  }
  return result.data;
}
