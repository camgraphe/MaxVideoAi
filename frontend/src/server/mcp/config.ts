import { isMcpApiHost, isMcpOpenaiDirectoryHost, MCP_OPENAI_DIRECTORY_RESOURCE_URL } from '@/lib/mcp-host-routing';

const PRODUCTION_API_HOST = 'api.maxvideoai.com';
export const MCP_PRODUCTION_RESOURCE_URL = `https://${PRODUCTION_API_HOST}/mcp`;
const PRODUCTION_ACCOUNT_URL = 'https://maxvideoai.com/account/connections';
export const MCP_OPENAI_QUALIFICATION_RESOURCE_URL = 'https://openai-review.maxvideoai.com/mcp';
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

// Default: a separate resource backed by the primary application. Qualification
// is an explicit, fixed-origin alternative; this routing check does not attest
// dedicated database/Auth/storage/worker bindings. An unset enablement never
// falls back to the direct profile on the reserved directory host.
export function isMcpOpenaiDirectoryEligible(env: McpConfigEnv, primary: McpConfig): boolean {
  const primaryResource = parseResourceUrl(primary.resourceUrl);
  const profile = readOptional(env, 'MCP_OPENAI_DIRECTORY_DEPLOYMENT_PROFILE') ?? 'shared-production';
  const expectedResource = profile === 'shared-production'
    ? new URL(MCP_PRODUCTION_RESOURCE_URL)
    : profile === 'dedicated-qualification' ? new URL(MCP_OPENAI_QUALIFICATION_RESOURCE_URL) : null;
  if (!expectedResource) return false;
  const expectedAccountUrl = profile === 'shared-production'
    ? PRODUCTION_ACCOUNT_URL : `${expectedResource.origin}/account/connections`;
  return env.NODE_ENV === 'production'
    && ['VERCEL_ENV', 'VERCEL_TARGET_ENV'].every((name) => !readOptional(env, name) || readOptional(env, name) === 'production')
    && primaryResource.protocol === 'https:' && !primaryResource.port
    && isMcpApiHost(primary.apiHost, expectedResource.host)
    && isMcpApiHost(primaryResource.host, expectedResource.host)
    && primary.accountUrl === expectedAccountUrl;
}

export function resolveMcpRequestConfig(
  requestHost: string | null,
  env: McpConfigEnv = process.env,
  primaryConfig?: McpConfig,
): McpConfig | null {
  if (!requestHost) return null;
  if (isMcpOpenaiDirectoryHost(requestHost)) {
    if (env.MCP_OPENAI_DIRECTORY_ENABLED !== 'true') return null;
    const primary = primaryConfig ?? resolveMcpConfig(env);
    if (!isMcpOpenaiDirectoryEligible(env, primary)) {
      throw new Error('The OpenAI directory channel requires the canonical production MCP configuration or its explicit dedicated qualification profile.');
    }
    const resource = parseResourceUrl(MCP_OPENAI_DIRECTORY_RESOURCE_URL);
    if (resource.protocol !== 'https:' || resource.port || isMcpApiHost(resource.host, PRODUCTION_API_HOST)) {
      throw new Error('The OpenAI directory resource must be a separate HTTPS host without a port.');
    }
    return {
      apiHost: resource.host, resourceUrl: resource.toString(),
      protectedResourceMetadataUrl: `${resource.origin}${PROTECTED_RESOURCE_PATH}`,
      accountUrl: primary.accountUrl,
    };
  }
  const primary = primaryConfig ?? resolveMcpConfig(env);
  return isMcpApiHost(requestHost, primary.apiHost) ? primary : null;
}
