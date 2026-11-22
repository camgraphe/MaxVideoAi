import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { promptReferenceLocationSchema } from '@/lib/prompt-assistance/analysis-request';
import { mobileResponse, mobileUser, MobileHttpError } from '@/server/mobile/http';
import { readMobileMiloMedia } from '@/server/mobile/milo-media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const ids = z.object({
  sessionId: z.string().uuid(),
  requestId: z.string().uuid(),
});
const querySchema = z.union([
  ids
    .extend({
      offset: z
        .string()
        .regex(/^(0|[1-5]?\d)$/)
        .transform(Number)
        .optional(),
    })
    .strict(),
  ids
    .extend({
      fieldId: promptReferenceLocationSchema.shape.fieldId,
      slot: z
        .string()
        .regex(/^(0|[1-9]\d?)$/)
        .transform(Number),
    })
    .strict(),
]);

export function GET(req: NextRequest) {
  return mobileResponse(async () => {
    if (process.env.PROMPT_ASSISTANCE_ENABLED !== 'true')
      throw new MobileHttpError('NOT_FOUND', 404, 'Milo unavailable.');
    const userId = await mobileUser(req, true);
    const params = req.nextUrl.searchParams;
    const parsed = querySchema.safeParse(Object.fromEntries(params));
    if (!parsed.success || Array.from(params.keys()).some((key) => params.getAll(key).length !== 1))
      throw new SyntaxError('Invalid media request.');
    const { sessionId, requestId } = parsed.data;
    const location =
      'fieldId' in parsed.data ? { fieldId: parsed.data.fieldId, slot: parsed.data.slot } : undefined;
    const items = await readMobileMiloMedia(
      userId,
      sessionId,
      requestId,
      location,
      'offset' in parsed.data ? parsed.data.offset : undefined,
    );
    return { ok: true, result: { sessionId, requestId, items } };
  });
}
