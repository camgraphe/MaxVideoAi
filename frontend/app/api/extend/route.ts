import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { ok: false, error: 'Not implemented: extend operation.' },
    { status: 501 }
  );
}

