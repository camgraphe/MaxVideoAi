import type { AgentPrincipal } from '@/server/agent-api/principal';
import {
  createAgentGenerationExecutabilityEnvironment,
  type AgentGenerationExecutabilityEnvironment,
} from '@/server/agent-runtime/model-executability';

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
    && csvIncludes(env.MCP_STAGING_CANARY_ACCOUNT_IDS, principal.userId)
    && csvIncludes(env.MCP_STAGING_CANARY_CLIENT_IDS, principal.clientId);
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
