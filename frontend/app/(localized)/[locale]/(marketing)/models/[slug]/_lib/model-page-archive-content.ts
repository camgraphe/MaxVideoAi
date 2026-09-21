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
  sourcesLabel: text,
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
