import { NextResponse } from 'next/server';
import { getPublicEngines } from '@/server/engine-overrides';
import { getBaseEngines } from '@/lib/engines';

export async function GET() {
  const engines = process.env.DATABASE_URL ? await getPublicEngines() : getBaseEngines();
  return NextResponse.json({ ok: true, engines });
}
