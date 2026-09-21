import { z } from 'zod';
import { withDbTransaction, query } from '@/lib/db';
import { parseEditorialDraft } from '@/lib/editorial/schema';

export const correctionSchema = z.object({
  articleId: z.string().uuid(), version: z.number().int().positive(), digest: z.string().regex(/^[a-f0-9]{64}$/),
  requestId: z.string().uuid(), locale: z.enum(['en','fr','es']),
  blockId: z.string().regex(/^[a-z][a-z0-9-]{1,63}$/).optional(),
  message: z.string().trim().min(8).max(3000),
}).strict();
export type EditorialCorrection = z.infer<typeof correctionSchema>;

// Review comments are data. Recording a correction never runs a model or publishes.
export async function requestEditorialCorrection(input: EditorialCorrection, actor: string) {
  const data = correctionSchema.parse(input);
  return withDbTransaction(async tx => {
    await tx.query('SELECT id FROM editorial_articles WHERE id=$1 FOR UPDATE',[data.articleId]);
    const replay = await tx.query<{id:string;detail:EditorialCorrection}>(
      "SELECT id,detail FROM editorial_events WHERE article_id=$1 AND kind='draft_rejected' AND detail->>'requestId'=$2",[data.articleId,data.requestId]);
    if (replay[0]) {
      const previous = correctionSchema.parse(replay[0].detail);
      if (JSON.stringify(previous) !== JSON.stringify(data)) throw Error('Correction request ID already used');
      return {id:replay[0].id,status:'recorded' as const};
    }
    const latest = (await tx.query<{version:number;digest:string;payload:unknown}>(
      'SELECT version,digest,payload FROM editorial_versions WHERE article_id=$1 ORDER BY version DESC LIMIT 1 FOR UPDATE',[data.articleId]))[0];
    if (!latest || latest.version !== data.version || latest.digest.trim() !== data.digest) throw Error('Correction target is not the latest exact version');
    const draft = parseEditorialDraft(latest.payload);
    if (data.blockId && !draft.locales[data.locale].blocks.some(b=>b.id===data.blockId)) throw Error('Unknown correction block');
    const event = (await tx.query<{id:string}>(
      "INSERT INTO editorial_events(article_id,version,kind,actor,detail) VALUES($1,$2,'draft_rejected',$3,$4::jsonb) RETURNING id",
      [data.articleId,data.version,actor,JSON.stringify(data)]))[0];
    await tx.query("UPDATE editorial_articles SET status='draft' WHERE id=$1",[data.articleId]);
    await tx.query('UPDATE editorial_versions SET approved_by=NULL,approved_at=NULL WHERE article_id=$1 AND version=$2',[data.articleId,data.version]);
    return {id:event.id,status:'recorded' as const};
  });
}
export async function listEditorialCorrections(articleId:string, version:number) {
  return query<{id:string;detail:EditorialCorrection;created_at:string}>(
    "SELECT id,detail,created_at FROM editorial_events WHERE article_id=$1 AND version=$2 AND kind='draft_rejected' ORDER BY id",[articleId,version]);
}
