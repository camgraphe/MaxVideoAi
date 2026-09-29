/** The sandbox never inherits commercial credentials, including future env-file keys. */
export function buildPricingSandboxEnvironment(input: {
  parent: NodeJS.ProcessEnv;
  fileVariables: Record<string, string>;
  databaseUrl: string;
  port: number;
}): NodeJS.ProcessEnv {
  const address = new URL(input.databaseUrl);
  const sockets = address.searchParams.getAll('host');
  if (!['postgres:', 'postgresql:'].includes(address.protocol) ||
      !['localhost', '127.0.0.1'].includes(address.hostname) ||
      sockets.length !== 1 || !sockets[0]?.startsWith('/') ||
      [...address.searchParams.keys()].some((key) => key !== 'host')) {
    throw new Error('Pricing sandbox requires an unambiguous local socket database');
  }
  if (!Number.isInteger(input.port) || input.port < 1024 || input.port > 65535) throw new Error('Invalid sandbox port');
  const environment: NodeJS.ProcessEnv = { NODE_ENV: 'development' };
  for (const key of new Set([...Object.keys(input.parent), ...Object.keys(input.fileVariables)])) environment[key] = '';
  for (const key of ['PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL', 'TERM']) {
    if (input.parent[key]) environment[key] = input.parent[key];
  }
  return {
    ...environment,
    NODE_ENV: 'development',
    DATABASE_URL: input.databaseUrl,
    NEXT_PUBLIC_API_BASE: `http://localhost:${input.port}`,
    NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'local-pricing-sandbox',
    NEXT_PUBLIC_ENABLE_CLARITY: 'false',
    NEXT_PUBLIC_RESULT_PROVIDER: 'mock',
    RESULT_PROVIDER: 'mock',
    PAYMENT_MODE: 'wallet',
    LOCAL_ADMIN_BYPASS: '1',
    LOCAL_ADMIN_BYPASS_USER_ID: '11111111-1111-4111-8111-111111111111',
    PRICING_SANDBOX: '1',
  };
}
