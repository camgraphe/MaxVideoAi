import { z } from 'zod';

const text = z.string().trim().min(1);
const archiveContentSchema = z.object({
  title: text,
  intro: text,
  alternativesTitle: text,
  chooseLabel: text,
  historyTitle: text,
  historyBody: text,
  historyLabel: text,
  examplesLabel: text,
  source: z.object({
    label: text,
    href: z.string().url().refine((href) => href.startsWith('https://'), 'Archive sources must use HTTPS'),
  }).strict().optional(),
  alternatives: z.array(z.object({
    modelId: text,
    title: text,
    description: text,
  }).strict()).min(1),
}).strict();

export type ModelArchiveContent = z.infer<typeof archiveContentSchema>;
export function parseModelArchiveContent(value: unknown): ModelArchiveContent {
  return archiveContentSchema.parse(value);
}
