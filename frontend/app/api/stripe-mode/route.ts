import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const secret = process.env.STRIPE_SECRET_KEY || '';
    if (!secret) return NextResponse.json({ mode: 'disabled' as const });
    const mode = secret.startsWith('sk_test_') ? 'test' : 'live';
    return NextResponse.json({ mode });
  } catch {
    return NextResponse.json({ mode: 'disabled' as const });
  }
}

