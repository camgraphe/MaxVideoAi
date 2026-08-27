import { FEATURES } from '@/content/feature-flags';
import {
  isMcpFoundationFeatureEnabled,
  type FeatureEnv,
} from '@/server/mcp/feature-access';

export type McpRuntimeCapabilities = Readonly<{
  paidGeneration: boolean;
  referenceUploads: boolean;
}>;

export type McpOperationalPublication = Readonly<{
  transport: boolean;
  oauth: boolean;
  discovery: boolean;
  paidGeneration: boolean;
  referenceUploads: boolean;
}>;

export function resolveMcpRuntimeCapabilities(
  env: FeatureEnv,
  requestHost: string | null,
  publication: McpOperationalPublication = FEATURES.mcp,
): McpRuntimeCapabilities {
  const operationalStaging = env.NODE_ENV === 'production'
    && env.MCP_STAGING_OPERATIONAL_ENABLED === 'true'
    && isMcpFoundationFeatureEnabled('transport', env, requestHost, publication)
    && isMcpFoundationFeatureEnabled('oauth', env, requestHost, publication);
  const stagingReferenceCleanup = operationalStaging
    && env.MCP_STAGING_REFERENCE_CLEANUP_ENABLED === 'true'
    && env.MCP_STAGING_REFERENCE_STORAGE_PREFIX === 'mcp-reference-staging/'
    && Boolean(env.CRON_SECRET?.trim());
  return Object.freeze({
    paidGeneration: publication.paidGeneration || operationalStaging,
    referenceUploads: publication.referenceUploads || stagingReferenceCleanup,
  });
}
