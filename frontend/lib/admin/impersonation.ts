const SESSION_COOKIE = 'mvid_impersonation_session';
const TARGET_COOKIE = 'mvid_impersonation_target';
const COOKIE_MAX_AGE_SECONDS = 60 * 60; // 1 hour

export type ImpersonationSessionPayload = {
  adminId: string;
  accessToken: string;
  refreshToken: string;
  returnTo: string;
};

export type ImpersonationTargetPayload = {
  userId: string;
  email: string | null;
  startedAt: string;
};

function encodePayload(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodePayload<T>(value?: string | null): T | null {
  if (!value) return null;
  try {
    const decoded = Buffer.from(value, 'base64url').toString('utf8');
    return JSON.parse(decoded) as T;
  } catch {
    return null;
  }
}

export function encodeImpersonationSession(payload: ImpersonationSessionPayload): string {
  return encodePayload(payload);
}

export function encodeImpersonationTarget(payload: ImpersonationTargetPayload): string {
  return encodePayload(payload);
}

export function decodeImpersonationSessionCookie(value?: string | null): ImpersonationSessionPayload | null {
  return decodePayload<ImpersonationSessionPayload>(value);
}

export function decodeImpersonationTargetCookie(value?: string | null): ImpersonationTargetPayload | null {
  return decodePayload<ImpersonationTargetPayload>(value);
}

export const impersonationCookieNames = {
  session: SESSION_COOKIE,
  target: TARGET_COOKIE,
};

export function impersonationCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: COOKIE_MAX_AGE_SECONDS,
  };
}

export function sanitizeRelativePath(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return null;
  }
  return trimmed;
}
