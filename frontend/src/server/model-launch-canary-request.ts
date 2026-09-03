import { resolveAgentPrincipal } from '@/server/mcp/oauth-adapter';
import {
  resolveMcpPrelaunchModelAccess,
  resolveMcpStagingCanaryGenerationEnvironment,
  resolveWorkspacePrelaunchModelAccess,
  resolveWorkspaceStagingCanaryGenerationEnvironment,
  type McpPrelaunchModelAccess,
} from '@/server/mcp/provider-canary-access';
import type { AgentPrincipal } from '@/server/agent-api/principal';
import type { AgentGenerationExecutabilityEnvironment } from '@/server/agent-runtime/model-executability';

export type LaunchCanaryRequestContext = Readonly<{
  principal: AgentPrincipal;
  access: McpPrelaunchModelAccess;
  generationEnvironment: AgentGenerationExecutabilityEnvironment;
}>;

export type LaunchCanaryRequestDependencies = Readonly<{
  resolvePrincipal?: typeof resolveAgentPrincipal;
  env?: NodeJS.ProcessEnv;
}>;

/**
 * Resolves launch-canary access on the exact staging surface. Hosted MCP
 * requests require matching account and client allowlists; first-party
 * workspace sessions require a verified Supabase principal in the separate
 * workspace account allowlist and must not carry an MCP client claim.
 */
export async function resolveLaunchCanaryRequestContext(
  request: Request,
  dependencies: LaunchCanaryRequestDependencies = {},
): Promise<LaunchCanaryRequestContext | null> {
  const env = dependencies.env ?? process.env;
  let principal: AgentPrincipal;
  try {
    principal = await (dependencies.resolvePrincipal ?? resolveAgentPrincipal)(request);
  } catch {
    return null;
  }
  const mcpAccess = resolveMcpPrelaunchModelAccess(principal, request.url, env);
  const workspaceAccess = mcpAccess
    ? null
    : resolveWorkspacePrelaunchModelAccess(principal, request.url, env);
  const access = mcpAccess ?? workspaceAccess;
  if (!access) return null;
  return Object.freeze({
    principal,
    access,
    generationEnvironment: mcpAccess
      ? resolveMcpStagingCanaryGenerationEnvironment(principal, request.url, env)
      : resolveWorkspaceStagingCanaryGenerationEnvironment(principal, request.url, env),
  });
}
