import { generateKeyPairSync, randomUUID, sign, verify } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

// Only a loopback test protocol fixture. Never imported by production code.
export const STUDIO_FIXTURE_OWNERS = [
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
] as const;
export const STUDIO_FIXTURE_NON_ADMIN = '10000000-0000-4000-8000-000000000003';
const STUDIO_FIXTURE_USERS: readonly string[] = [
  ...STUDIO_FIXTURE_OWNERS,
  STUDIO_FIXTURE_NON_ADMIN,
];

type FixtureUser = {
  id: string; aud: string; role: string; email: string; email_confirmed_at: string;
  created_at: string; updated_at: string; app_metadata: { provider: string; providers: string[] };
  user_metadata: Record<string, never>; identities: Array<{ id: string; user_id: string; provider: string }>;
};
type FixtureSession = {
  access_token: string; refresh_token: string; token_type: 'bearer'; expires_in: number; expires_at: number; user: FixtureUser;
};
type Claims = {
  sub: string; aud: string; role: string; iss: string; iat: number; exp: number;
  session_id: string; email: string; client_id?: string;
};

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

export async function startStudioAuthFixture(options: { appOrigin?: string; port?: number } = {}) {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const kid = randomUUID();
  const anonKey = 'studio-disposable-auth-fixture-anon';
  const publicJwk = { ...publicKey.export({ format: 'jwk' }), kid, alg: 'ES256', use: 'sig' };
  const sessions = new Map<string, { subject: string; sessionId: string; clientId?: string }>();
  let origin = '';

  function createSession(subject: string, settings: { expiresIn?: number; clientId?: string } = {}): FixtureSession {
    if (!STUDIO_FIXTURE_USERS.includes(subject)) throw new Error('Unknown fixture user.');
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresIn = settings.expiresIn ?? 3600;
    const sessionId = randomUUID();
    const timestamp = new Date(issuedAt * 1000).toISOString();
    const user: FixtureUser = {
      id: subject, aud: 'authenticated', role: 'authenticated',
      email: `studio-${subject.slice(-1)}@example.invalid`, email_confirmed_at: timestamp,
      created_at: timestamp, updated_at: timestamp,
      app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {},
      identities: [{ id: subject, user_id: subject, provider: 'email' }],
    };
    const claims: Claims = {
      sub: subject, aud: 'authenticated', role: 'authenticated', iss: `${origin}/auth/v1`,
      iat: issuedAt, exp: issuedAt + expiresIn, session_id: sessionId, email: user.email,
      ...(settings.clientId ? { client_id: settings.clientId } : {}),
    };
    const payload = `${encode({ alg: 'ES256', typ: 'JWT', kid })}.${encode(claims)}`;
    const signature = sign('sha256', Buffer.from(payload), { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url');
    const refreshToken = randomUUID();
    sessions.set(refreshToken, { subject, sessionId, clientId: settings.clientId });
    return { access_token: `${payload}.${signature}`, refresh_token: refreshToken, token_type: 'bearer', expires_in: expiresIn, expires_at: claims.exp, user };
  }

  function verifyToken(token: string, allowExpired = false): Claims | null {
    try {
      const pieces = token.split('.');
      if (pieces.length !== 3) return null;
      const header = JSON.parse(Buffer.from(pieces[0], 'base64url').toString());
      if (header.alg !== 'ES256' || header.kid !== kid) return null;
      if (!verify('sha256', Buffer.from(`${pieces[0]}.${pieces[1]}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(pieces[2], 'base64url'))) return null;
      const claims = JSON.parse(Buffer.from(pieces[1], 'base64url').toString()) as Claims;
      const now = Math.floor(Date.now() / 1000);
      if (claims.iss !== `${origin}/auth/v1` || claims.aud !== 'authenticated' || claims.role !== 'authenticated'
        || !Number.isFinite(claims.exp) || (!allowExpired && claims.exp <= now) || claims.iat > now + 5) return null;
      const active = [...sessions.values()].some((session) => session.subject === claims.sub && session.sessionId === claims.session_id);
      return active ? claims : null;
    } catch { return null; }
  }

  const server = createServer(async (request, response) => {
    response.setHeader('Content-Type', 'application/json');
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('Access-Control-Allow-Origin', options.appOrigin ?? 'http://127.0.0.1:3036');
    response.setHeader('Access-Control-Allow-Headers', 'authorization, apikey, content-type, x-client-info, x-supabase-api-version');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    const reply = (status: number, body: unknown) => { response.writeHead(status); response.end(JSON.stringify(body)); };
    if (request.method === 'OPTIONS') { response.writeHead(204).end(); return; }
    const url = new URL(request.url ?? '/', origin);
    if (request.method === 'GET' && url.pathname === '/auth/v1/.well-known/jwks.json') {
      reply(200, { keys: [publicJwk] }); return;
    }
    if (request.method === 'GET' && url.pathname === '/auth/v1/user') {
      const token = request.headers.authorization?.replace(/^Bearer /i, '') ?? '';
      const claims = verifyToken(token);
      if (!claims) { reply(401, { code: 'bad_jwt', message: 'Invalid or inactive fixture token.' }); return; }
      const timestamp = new Date(claims.iat * 1000).toISOString();
      reply(200, {
        id: claims.sub, aud: claims.aud, role: claims.role, email: claims.email,
        email_confirmed_at: timestamp, created_at: timestamp, updated_at: timestamp,
        app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {},
        identities: [{ id: claims.sub, user_id: claims.sub, provider: 'email' }],
      }); return;
    }
    if (request.method === 'POST' && url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'refresh_token') {
      try {
        let body = '';
        for await (const chunk of request) {
          body += chunk.toString();
          if (body.length > 16_384) { reply(413, { code: 'body_too_large' }); return; }
        }
        const refreshToken = JSON.parse(body).refresh_token;
        const current = typeof refreshToken === 'string' ? sessions.get(refreshToken) : undefined;
        if (!current) { reply(400, { code: 'refresh_token_not_found', message: 'Invalid fixture refresh token.' }); return; }
        sessions.delete(refreshToken);
        reply(200, createSession(current.subject, { clientId: current.clientId }));
      } catch { reply(400, { code: 'invalid_request', message: 'Invalid fixture request.' }); }
      return;
    }
    reply(404, { code: 'not_found', message: 'No fixture route.' });
  });
  if (options.port === 3026) throw new Error('Port 3026 belongs to the app coordinator.');
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port ?? 0, '127.0.0.1', resolve);
  });
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  return {
    origin, anonKey, createSession,
    cookiesFor(session: FixtureSession): Array<{ name: string; value: string }> {
      const value = `base64-${encode(session)}`;
      if (value.length <= 3000) return [{ name: 'sb-127-auth-token', value }];
      return Array.from({ length: Math.ceil(value.length / 3000) }, (_, index) => ({
        name: `sb-127-auth-token.${index}`, value: value.slice(index * 3000, (index + 1) * 3000),
      }));
    },
    revokeSession(token: string) {
      const claims = verifyToken(token, true);
      if (!claims) return;
      for (const [refresh, session] of sessions) if (session.sessionId === claims.session_id) sessions.delete(refresh);
    },
    async close() {
      sessions.clear();
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    },
  };
}
