import { createHash } from 'node:crypto';

export const PRICING_CUTOVER_READ_ONLY_OPTIONS = '-c default_transaction_read_only=on -c statement_timeout=10000 -c lock_timeout=2000';

/** No ambient URL fallback, arbitrary host overrides, or PgBouncer target. */
export function pricingCutoverConnection(env: Record<string, string | undefined>): string {
  try {
    const connection = env.DATABASE_URL_UNPOOLED?.trim() || env.DATABASE_URL?.trim();
    if (!connection) throw new Error();
    const url = new URL(connection);
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.username || !url.pathname.slice(1)) throw new Error();
    const keys = [...url.searchParams.keys()];
    if (new Set(keys).size !== keys.length || (url.port && Number(url.port) < 1)) throw new Error();
    const hosts = url.searchParams.getAll('host');
    const local = ['localhost', '127.0.0.1'].includes(url.hostname) && hosts.length === 1 && hosts[0].startsWith('/');
    const neon = url.hostname.endsWith('.neon.tech') && !url.hostname.split('.').some(part => part.endsWith('-pooler'))
      && hosts.length === 0 && url.searchParams.get('sslmode') === 'require';
    if (!local && !neon) throw new Error();
    const allowed = local ? ['host'] : ['sslmode', 'channel_binding'];
    if ([...url.searchParams.keys()].some(key => !allowed.includes(key))) throw new Error();
    return connection;
  } catch { throw new Error('Use an explicit environment file with a direct Neon or local Unix socket connection.'); }
}

/** Bind exactly the endpoint passed to pg, including its effective port/socket.
 * Explicit password callback prevents ambient PGPASSWORD and .pgpass fallback. */
export function pricingCutoverTarget(env: Record<string, string | undefined>) {
  const url = new URL(pricingCutoverConnection(env));
  const host = url.searchParams.get('host') || url.hostname;
  const port = Number(url.port || 5432);
  const database = decodeURIComponent(url.pathname.slice(1));
  const user = decodeURIComponent(url.username);
  const password = decodeURIComponent(url.password);
  const socket = host.startsWith('/');
  const config = { host, port, database, user, password: () => password,
    ssl: socket ? false : { rejectUnauthorized: true },
    enableChannelBinding: url.searchParams.get('channel_binding') === 'require',
    options: PRICING_CUTOVER_READ_ONLY_OPTIONS, connectionTimeoutMillis: 10_000 };
  return { config, databaseIdentity: createHash('sha256').update(JSON.stringify({ host, port, database, user,
    transport: socket ? 'unix_socket' : 'tls_verified' })).digest('hex') };
}
