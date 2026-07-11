import { FEATURES } from '@/content/feature-flags';
import { resolveMcpConfig } from '@/server/mcp/config';

export type McpFoundationFeature = 'transport' | 'oauth' | 'discovery';
type FeatureEnv = Readonly<Record<string, string | undefined>>;

const PRODUCTION_HOSTS = new Set([
  'maxvideoai.com',
  'www.maxvideoai.com',
  'api.maxvideoai.com',
]);

function isHostedStagingEnabled(env: FeatureEnv): boolean {
  if (env.NODE_ENV !== 'production' || env.MCP_STAGING_ENABLED !== 'true') return false;
  const allowedHost = env.MCP_STAGING_HOST?.trim().toLowerCase();
  if (!allowedHost || PRODUCTION_HOSTS.has(allowedHost)) return false;

  try {
    const config = resolveMcpConfig(env);
    const resource = new URL(config.resourceUrl);
    return (
      resource.protocol === 'https:' &&
      resource.host.toLowerCase() === allowedHost &&
      config.apiHost.toLowerCase() === allowedHost
    );
  } catch {
    return false;
  }
}

export function isMcpFoundationFeatureEnabled(
  feature: McpFoundationFeature,
  env: FeatureEnv = process.env
): boolean {
  if (FEATURES.mcp[feature]) return true;
  if (isHostedStagingEnabled(env)) return true;
  if (env.NODE_ENV === 'production' || env.MCP_LOCAL_ENABLED !== 'true') return false;

  try {
    resolveMcpConfig(env);
    return true;
  } catch {
    return false;
  }
}
