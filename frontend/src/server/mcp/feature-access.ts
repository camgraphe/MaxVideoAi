import { FEATURES } from '@/content/feature-flags';
import { resolveMcpConfig } from '@/server/mcp/config';

export type McpFoundationFeature = 'transport' | 'oauth' | 'discovery';
type FeatureEnv = Readonly<Record<string, string | undefined>>;

export function isMcpFoundationFeatureEnabled(
  feature: McpFoundationFeature,
  env: FeatureEnv = process.env
): boolean {
  if (FEATURES.mcp[feature]) return true;
  if (env.NODE_ENV === 'production' || env.MCP_LOCAL_ENABLED !== 'true') return false;

  try {
    resolveMcpConfig(env);
    return true;
  } catch {
    return false;
  }
}
