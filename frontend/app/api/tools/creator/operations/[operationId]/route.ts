import { withCreatorMediaReadAccess } from '@/server/tools/creator-media-access';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createCreatorOperationsService } from '@/server/tools/creator-operations';
import { runCreatorHttp } from '@/server/tools/creator-http';
export const runtime = 'nodejs';
export const maxDuration = 800;
export async function GET(request: NextRequest, props: { params: Promise<{ operationId: string }> }) {
  return runCreatorHttp(request, async actor => withCreatorMediaReadAccess(actor.userId, await createCreatorOperationsService(actor, { enabled: false }).status(z.string().uuid().parse((await props.params).operationId))));
}
