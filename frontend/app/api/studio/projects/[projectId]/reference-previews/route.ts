import type {NextRequest} from 'next/server';
import {handleStudioReferencePreviews} from '../../../_lib/studio-reference-previews-handler';

export const runtime = 'nodejs';
type Context = {params: Promise<{projectId: string}>};
export async function POST(req: NextRequest, context: Context) {
  return handleStudioReferencePreviews(req, (await context.params).projectId);
}
