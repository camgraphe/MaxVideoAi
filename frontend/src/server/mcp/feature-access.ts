import { FEATURES } from '@/content/feature-flags';
import { isMcpApiHost } from '@/lib/mcp-host-routing';
import { resolveMcpConfig } from '@/server/mcp/config';

export type McpFoundationFeature = 'transport' | 'oauth' | 'discovery';
type FeatureEnv = Readonly<Record<string, string | undefined>>;

const PRODUCTION_HOSTS = new Set([
  'maxvideoai.com',
  'www.maxvideoai.com',
  'api.maxvideoai.com',
]);

function canonicalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/\.+$/, '');
}

function requestMatchesConfiguredHost(requestHost: string | null | undefined, configuredHost: string): boolean {
  return typeof requestHost === 'string' && isMcpApiHost(requestHost, configuredHost);
}

function isHostedStagingEnabled(env: FeatureEnv, requestHost: string | null | undefined): boolean {
  if (env.NODE_ENV !== 'production' || env.MCP_STAGING_ENABLED !== 'true') return false;
  const allowedHost = env.MCP_STAGING_HOST?.trim().toLowerCase();
  if (!allowedHost) return false;
  const allowedHostname = canonicalizeHostname(allowedHost);
  if (PRODUCTION_HOSTS.has(allowedHostname)) return false;

  try {
    const config = resolveMcpConfig(env);
    const resource = new URL(config.resourceUrl);
    return (
      resource.protocol === 'https:' &&
      canonicalizeHostname(resource.hostname) === allowedHostname &&
      resource.host.toLowerCase() === allowedHost &&
      config.apiHost.toLowerCase() === allowedHost &&
      requestMatchesConfiguredHost(requestHost, config.apiHost)
    );
  } catch {
    return false;
  }
}

export function isMcpFoundationFeatureEnabled(
  feature: McpFoundationFeature,
  env: FeatureEnv = process.env,
  requestHost?: string | null,
): boolean {
  if (FEATURES.mcp[feature]) return true;
  if (isHostedStagingEnabled(env, requestHost)) return true;
  if (env.NODE_ENV === 'production' || env.MCP_LOCAL_ENABLED !== 'true') return false;

  try {
    const config = resolveMcpConfig(env);
    return requestMatchesConfiguredHost(requestHost, config.apiHost);
  } catch {
    return false;
  }
}
