import { NextRequest, NextResponse } from 'next/server';
import { runFalPoll } from '@/server/fal-poll';

export const dynamic = 'force-dynamic';

const POLL_TOKEN = (process.env.FAL_POLL_TOKEN ?? '').trim();

function authorize(req: NextRequest): NextResponse | null {
  if (!POLL_TOKEN) return null;
  const rawHeader = req.headers.get('x-fal-poll-token') ?? req.headers.get('authorization') ?? '';
  const token = rawHeader.startsWith('Bearer ') ? rawHeader.slice('Bearer '.length).trim() : rawHeader.trim();
  if (token && token === POLL_TOKEN) {
    return null;
  }
  const sanitized = token ? `${token.slice(0, 4)}…${token.slice(-4)}` : null;
  console.warn('[fal-poll] unauthorized request', {
    hasHeader: Boolean(rawHeader),
    tokenLength: token.length,
    matches: token === POLL_TOKEN,
    sanitizedToken: sanitized,
    envTokenLength: POLL_TOKEN.length,
  });
  return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
}

export async function POST(req: NextRequest) {
  const auth = authorize(req);
  if (auth) return auth;
  return runFalPoll();
}

export async function GET(req: NextRequest) {
  const auth = authorize(req);
  if (auth) return auth;
  return runFalPoll();
}

export const runtime = 'nodejs';
