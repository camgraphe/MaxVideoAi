import { NextRequest } from 'next/server';
import { studioBody, studioRoute } from '@/server/character-studio/http';
import { listStudioCharacters, saveStudioCharacterOutput } from '@/server/character-studio/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function GET(req: NextRequest) {
  return studioRoute(req, (userId) => listStudioCharacters(userId, req.nextUrl.searchParams.get('before')));
}
export function POST(req: NextRequest) {
  return studioRoute(req, async (userId) => {
    const body = await studioBody(req);
    return saveStudioCharacterOutput(userId, {
      name: body.name as string,
      jobId: body.jobId as string,
      imageUrl: body.imageUrl as string,
    });
  });
}
