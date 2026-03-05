import { NextRequest, NextResponse } from 'next/server';

function secureCompare(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

export function readRequestToken(req: NextRequest, headerNames: string[] = []): string {
  for (const headerName of headerNames) {
    const direct = req.headers.get(headerName)?.trim();
    if (direct) return direct;
  }

  const auth = req.headers.get('authorization') ?? '';
  const bearer = auth.replace(/^Bearer\s+/i, '').trim();
  return bearer;
}

function isProtectedEnvironment(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
}

export function authorizeHealthcheckRequest(req: NextRequest): NextResponse | null {
  const token = (process.env.HEALTHCHECK_TOKEN ?? '').trim();
  if (!token) {
    if (isProtectedEnvironment()) {
      return NextResponse.json({ ok: false, error: 'HEALTHCHECK_TOKEN not configured' }, { status: 503 });
    }
    return null;
  }

  const provided = readRequestToken(req, ['x-healthcheck-token']);
  if (!provided || !secureCompare(provided, token)) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  return null;
}
