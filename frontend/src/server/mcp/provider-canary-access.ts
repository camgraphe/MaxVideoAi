import type { AgentPrincipal } from '@/server/agent-api/principal';
import {
  createAgentGenerationExecutabilityEnvironment,
  type AgentGenerationExecutabilityEnvironment,
} from '@/server/agent-runtime/model-executability';
import { getRuntimeModelById } from '@/config/model-runtime';
import { P0_VIDEO_MODEL_IDS } from '@/lib/pricing-audit/p0-video-scenarios';

const STAGING_ACCOUNT_HOST = 'maxvideoai-mcp-staging.vercel.app';

function csvIncludes(value: string | undefined, expected: string): boolean {
  return (value ?? '')
    .split(',')
    .map((candidate) => candidate.trim())
    .filter(Boolean)
    .includes(expected);
}

function isExactStagingCanary(
  principal: AgentPrincipal,
  accountUrl: string,
  env: NodeJS.ProcessEnv,
): boolean {
  let host: string;
  try {
    host = new URL(accountUrl).host;
  } catch {
    return false;
  }
  return env.NODE_ENV === 'production'
    && env.MCP_STAGING_OPERATIONAL_ENABLED === 'true'
    && host === STAGING_ACCOUNT_HOST
    && principal.clientId !== null
    && (
      csvIncludes(env.MCP_STAGING_CANARY_ACCOUNT_IDS, principal.userId)
      || csvIncludes(env.MCP_STAGING_CANARY_ADDITIONAL_ACCOUNT_IDS, principal.userId)
    )
    && (
      csvIncludes(env.MCP_STAGING_CANARY_CLIENT_IDS, principal.clientId)
      || csvIncludes(env.MCP_STAGING_CANARY_ADDITIONAL_CLIENT_IDS, principal.clientId)
    );
}

export type McpPrelaunchModelAccess = Readonly<{
  allowedModelIds: ReadonlySet<string>;
}>;

export function resolveMcpPrelaunchModelAccess(
  principal: AgentPrincipal,
  accountUrl: string,
  env: NodeJS.ProcessEnv = process.env,
  resolveRuntimeModel: typeof getRuntimeModelById = getRuntimeModelById,
): McpPrelaunchModelAccess | null {
  if (!isExactStagingCanary(principal, accountUrl, env)) return null;
  const ids = P0_VIDEO_MODEL_IDS.filter((id) => {
    const model = resolveRuntimeModel(id);
    return model?.lifecycle === 'current' && model.publication.app.published === false;
  });
  return ids.length === P0_VIDEO_MODEL_IDS.length
    ? Object.freeze({ allowedModelIds: new Set(ids) })
    : null;
}

export function resolveMcpStagingCanaryGenerationEnvironment(
  principal: AgentPrincipal,
  accountUrl: string,
  env: NodeJS.ProcessEnv = process.env,
): AgentGenerationExecutabilityEnvironment {
  if (!isExactStagingCanary(principal, accountUrl, env)) {
    return createAgentGenerationExecutabilityEnvironment(env);
  }

  return createAgentGenerationExecutabilityEnvironment(Object.freeze({
    ...env,
    GOOGLE_VERTEX_IMAGE_MCP_ENABLED: 'true',
    GOOGLE_VERTEX_IMAGE_MCP_PUBLIC_ROUTING_ENABLED: 'true',
    GOOGLE_VERTEX_VEO_ENABLED: 'true',
    GOOGLE_VERTEX_VEO_PUBLIC_ROUTING_ENABLED: 'true',
    GOOGLE_VERTEX_VEO_ADMIN_ONLY: 'false',
    GOOGLE_VERTEX_OMNI_ENABLED: 'true',
    GOOGLE_VERTEX_OMNI_PUBLIC_ROUTING_ENABLED: 'true',
    GOOGLE_VERTEX_OMNI_ADMIN_ONLY: 'false',
  }));
}
