import { FEATURES } from '@/content/feature-flags';
import {
  isMcpFoundationFeatureEnabled,
  type FeatureEnv,
} from '@/server/mcp/feature-access';

export type McpRuntimeCapabilities = Readonly<{
  paidGeneration: boolean;
  referenceUploads: boolean;
}>;

export function resolveMcpRuntimeCapabilities(
  env: FeatureEnv,
  requestHost: string | null,
): McpRuntimeCapabilities {
  const operationalStaging = env.NODE_ENV === 'production'
    && env.MCP_STAGING_OPERATIONAL_ENABLED === 'true'
    && isMcpFoundationFeatureEnabled('transport', env, requestHost)
    && isMcpFoundationFeatureEnabled('oauth', env, requestHost);
  return Object.freeze({
    paidGeneration: FEATURES.mcp.paidGeneration || operationalStaging,
    referenceUploads: FEATURES.mcp.referenceUploads || operationalStaging,
  });
}
