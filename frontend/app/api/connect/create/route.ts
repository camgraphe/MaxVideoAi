import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'deprecated_route', message: 'Use /api/stripe/setup-custom-account instead.' },
    { status: 410 }
  );
}
