import { NextRequest } from 'next/server';
import { studioBody, studioRoute } from '@/server/character-studio/http';
import { getStudioCharacter, renameStudioCharacter, updateStudioPresentation } from '@/server/character-studio/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ characterId: string }> };
export function GET(req: NextRequest, { params }: Context) {
  return studioRoute(req, async (userId) => ({
    character: await getStudioCharacter(
      userId,
      (await params).characterId,
      req.nextUrl.searchParams.get('beforeLook'),
    ),
  }));
}
export function PATCH(req: NextRequest, { params }: Context) {
  return studioRoute(req, async (userId) => {
    const body = await studioBody(req);
    return {
      character: 'presentation' in body
        ? await updateStudioPresentation(userId, (await params).characterId, body.presentation)
        : await renameStudioCharacter(userId, (await params).characterId, body.name as string),
    };
  });
}
