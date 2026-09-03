import type { AgentPrincipal } from '@/server/agent-api/principal';
import {
  createAgentGenerationExecutabilityEnvironment,
  type AgentGenerationExecutabilityEnvironment,
} from '@/server/agent-runtime/model-executability';
import { getRuntimeModelById } from '@/config/model-runtime';
import { P0_VIDEO_MODEL_IDS } from '@/lib/pricing-audit/p0-video-scenarios';
import { MODEL_LAUNCH_WAVES } from '@/config/model-launch-waves';

const STAGING_ACCOUNT_HOST = 'maxvideoai-mcp-staging.vercel.app';

function csvIncludes(value: string | undefined, expected: string): boolean {
  return (value ?? '')
    .split(',')
    .map((candidate) => candidate.trim())
    .filter(Boolean)
    .includes(expected);
}

function isExactStagingSurface(
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
    && host === STAGING_ACCOUNT_HOST;
}

function isExactMcpStagingCanary(
  principal: AgentPrincipal,
  accountUrl: string,
  env: NodeJS.ProcessEnv,
): boolean {
  return isExactStagingSurface(accountUrl, env)
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

function isExactWorkspaceStagingCanary(
  principal: AgentPrincipal,
  accountUrl: string,
  env: NodeJS.ProcessEnv,
): boolean {
  return isExactStagingSurface(accountUrl, env)
    && principal.clientId === null
    && csvIncludes(env.WORKSPACE_STAGING_CANARY_ACCOUNT_IDS, principal.userId);
}

export type McpPrelaunchModelAccess = Readonly<{
  allowedModelIds: ReadonlySet<string>;
}>;

function resolvePrelaunchModelAccess(
  resolveRuntimeModel: typeof getRuntimeModelById,
): McpPrelaunchModelAccess | null {
  const launchCanaryIds = Array.from(new Set([
    ...P0_VIDEO_MODEL_IDS,
    ...MODEL_LAUNCH_WAVES.flatMap((wave) => wave.id === 'p1'
      ? wave.models.map(({ modelId }) => modelId)
      : []),
  ]));
  const ids = launchCanaryIds.filter((id) => {
    const model = resolveRuntimeModel(id);
    return model?.lifecycle === 'current' && model.publication.app.published === false;
  });
  return ids.length
    ? Object.freeze({ allowedModelIds: new Set(ids) })
    : null;
}

export function resolveMcpPrelaunchModelAccess(
  principal: AgentPrincipal,
  accountUrl: string,
  env: NodeJS.ProcessEnv = process.env,
  resolveRuntimeModel: typeof getRuntimeModelById = getRuntimeModelById,
): McpPrelaunchModelAccess | null {
  if (!isExactMcpStagingCanary(principal, accountUrl, env)) return null;
  return resolvePrelaunchModelAccess(resolveRuntimeModel);
}

export function resolveWorkspacePrelaunchModelAccess(
  principal: AgentPrincipal,
  accountUrl: string,
  env: NodeJS.ProcessEnv = process.env,
  resolveRuntimeModel: typeof getRuntimeModelById = getRuntimeModelById,
): McpPrelaunchModelAccess | null {
  if (!isExactWorkspaceStagingCanary(principal, accountUrl, env)) return null;
  return resolvePrelaunchModelAccess(resolveRuntimeModel);
}

function createStagingCanaryGenerationEnvironment(
  env: NodeJS.ProcessEnv,
): AgentGenerationExecutabilityEnvironment {
  const environment = createAgentGenerationExecutabilityEnvironment(Object.freeze({
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
  return Object.freeze({
    ...environment,
    falApiKey: env.FAL_API_KEY ?? env.FAL_KEY ?? environment.falApiKey,
  });
}

export function resolveMcpStagingCanaryGenerationEnvironment(
  principal: AgentPrincipal,
  accountUrl: string,
  env: NodeJS.ProcessEnv = process.env,
): AgentGenerationExecutabilityEnvironment {
  if (!isExactMcpStagingCanary(principal, accountUrl, env)) {
    return createAgentGenerationExecutabilityEnvironment(env);
  }

  return createStagingCanaryGenerationEnvironment(env);
}

export function resolveWorkspaceStagingCanaryGenerationEnvironment(
  principal: AgentPrincipal,
  accountUrl: string,
  env: NodeJS.ProcessEnv = process.env,
): AgentGenerationExecutabilityEnvironment {
  if (!isExactWorkspaceStagingCanary(principal, accountUrl, env)) {
    return createAgentGenerationExecutabilityEnvironment(env);
  }
  return createStagingCanaryGenerationEnvironment(env);
}
