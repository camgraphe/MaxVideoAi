const PRODUCTION_API_HOST = 'api.maxvideoai.com';
export const MCP_PRODUCTION_RESOURCE_URL = `https://${PRODUCTION_API_HOST}/mcp`;
const PRODUCTION_ACCOUNT_URL = 'https://maxvideoai.com/account/connections';
const PROTECTED_RESOURCE_PATH = '/.well-known/oauth-protected-resource/mcp';

type McpConfigEnv = Readonly<Record<string, string | undefined>>;

export type McpConfig = {
  apiHost: string;
  resourceUrl: string;
  protectedResourceMetadataUrl: string;
  accountUrl: string;
};

function readOptional(env: McpConfigEnv, name: string): string | null {
  const value = env[name]?.trim();
  return value ? value : null;
}

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '[::1]' || normalized === '::1';
}

function canonicalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/\.+$/, '');
}

function parseResourceUrl(value: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('MCP_RESOURCE_URL must be an absolute URL.');
  }

  if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/mcp') {
    throw new Error('MCP_RESOURCE_URL must identify the exact /mcp resource without credentials, query, or fragment.');
  }
  return parsed;
}

export function resolveMcpConfig(env: McpConfigEnv = process.env): McpConfig {
  const isProduction = readOptional(env, 'NODE_ENV') === 'production';
  const configuredResourceUrl = readOptional(env, 'MCP_RESOURCE_URL');
  const configuredApiHost = readOptional(env, 'MCP_API_HOST');

  if (!isProduction && (!configuredResourceUrl || !configuredApiHost)) {
    throw new Error('Development MCP config requires explicit MCP_RESOURCE_URL and MCP_API_HOST values.');
  }

  const resourceUrl = configuredResourceUrl ?? MCP_PRODUCTION_RESOURCE_URL;
  const apiHost = configuredApiHost ?? PRODUCTION_API_HOST;
  const parsed = parseResourceUrl(resourceUrl);

  if (isProduction && parsed.protocol !== 'https:') {
    throw new Error('Production MCP_RESOURCE_URL must use HTTPS.');
  }
  if (!isProduction && !isLoopbackHostname(parsed.hostname)) {
    throw new Error('Development MCP_RESOURCE_URL must use a loopback hostname.');
  }
  if (parsed.host.toLowerCase() !== apiHost.toLowerCase()) {
    throw new Error('MCP_API_HOST must match the configured MCP resource URL host.');
  }

  const usesProductionApiOrigin =
    parsed.protocol === 'https:' &&
    canonicalizeHostname(parsed.hostname) === PRODUCTION_API_HOST &&
    parsed.port === '';
  const accountUrl = usesProductionApiOrigin
    ? PRODUCTION_ACCOUNT_URL
    : `${parsed.origin}/account/connections`;

  return {
    apiHost,
    resourceUrl: parsed.toString(),
    protectedResourceMetadataUrl: `${parsed.origin}${PROTECTED_RESOURCE_PATH}`,
    accountUrl,
  };
}
