import { NextResponse } from 'next/server';
import { getServiceNoticeSetting } from '@/server/app-settings';

export const dynamic = 'force-dynamic';

export async function GET() {
  const setting = await getServiceNoticeSetting();
  return NextResponse.json(setting, {
    headers: {
      'Cache-Control': 'public, max-age=30',
    },
  });
}
