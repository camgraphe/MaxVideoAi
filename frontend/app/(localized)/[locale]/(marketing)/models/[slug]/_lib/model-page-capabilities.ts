import { z } from 'zod';
import { getFalEngineBySlug } from '@/config/falEngines';
import type { AppLocale } from '@/i18n/locales';

const text = z.string().trim().min(1);
const action = z.object({ label: text, mode: z.enum(['t2v', 'i2v', 'fl2v', 'ref2v', 'v2v', 'extend']), model: text.optional() }).strict();
export const cinematicCapabilitiesSchema = z.object({
  title: text, intro: text, diagramLabel: text,
  items: z.array(z.object({
    id: z.string().regex(/^[a-z-]+$/), label: text, title: text, body: text,
    stages: z.array(text).length(3), uses: z.array(text).length(3), note: text,
    actions: z.array(action).min(1).max(3),
  }).strict()).min(3).max(4),
  controls: z.object({ title: text, body: text }).strict(),
  handoff: z.object({ title: text, body: text, actions: z.array(action).length(2) }).strict().optional(),
}).strict().refine(copy => new Set(copy.items.map(item => item.id)).size === copy.items.length, 'Unique workflow tabs');

/** Editorial modes must exist in Create. A neighbouring model is always named in the UI. */
export function buildCinematicCapabilities(copy: z.infer<typeof cinematicCapabilitiesSchema> | undefined, model: string, locale: AppLocale) {
  if (!copy) return undefined;
  function destination(value: z.infer<typeof action>) {
    const target = value.model ?? model;
    const engine = getFalEngineBySlug(target);
    if (!engine?.engine.modes.includes(value.mode)) throw new Error(`Unsupported cinematic workflow: ${target}/${value.mode}`);
    if (target !== model && !value.label.includes(engine.marketingName)) throw new Error('Cross-model actions must name the destination');
    const params = new URLSearchParams({ engine: engine.id, mode: value.mode, lang: locale });
    return { ...value, href: `/app?${params}` };
  }
  return { ...copy, items: copy.items.map(item => ({ ...item, actions: item.actions.map(destination) })),
    handoff: copy.handoff ? { ...copy.handoff, actions: copy.handoff.actions.map(destination) } : undefined };
}
export type CinematicCapabilities = NonNullable<ReturnType<typeof buildCinematicCapabilities>>;
