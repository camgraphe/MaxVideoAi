import {z} from 'zod';

export const studioProjectSummarySchema=z.object({
  id:z.string().min(1).max(256),
  name:z.string().max(240),
  updatedAt:z.string().datetime(),
  persistenceMode:z.enum(['connected','legacy']),
});
export const studioProjectSummariesSchema=z.array(studioProjectSummarySchema).max(100);
export type StudioProjectSummary=z.infer<typeof studioProjectSummarySchema>;
