import { NextRequest, NextResponse } from 'next/server';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { deleteLibraryAsset } from '@/server/media-library';

export const runtime = 'nodejs';

export async function DELETE(_req: NextRequest, props: { params: Promise<{ assetId: string }> }) {
  const { userId } = await getRouteAuthContext(_req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }
  const { assetId } = await props.params;
  const result = await deleteLibraryAsset({ userId, assetId });
  if (result === 'not_found') {
    return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
