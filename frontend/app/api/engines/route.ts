import { NextResponse } from 'next/server';
import { getConfiguredEngines } from '@/server/engines';

export async function GET() {
  const engines = await getConfiguredEngines();
  return NextResponse.json({ ok: true, engines });
}
