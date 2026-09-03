import { resolveAgentPrincipal } from '@/server/mcp/oauth-adapter';
import {
  resolveMcpPrelaunchModelAccess,
  resolveMcpStagingCanaryGenerationEnvironment,
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
 * Reuses the MCP launch-canary contract for every authenticated surface. Access
 * is granted only from the exact staging host to a verified OAuth account and
 * OAuth client present in the server-side allowlists.
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
  const access = resolveMcpPrelaunchModelAccess(principal, request.url, env);
  if (!access) return null;
  return Object.freeze({
    principal,
    access,
    generationEnvironment: resolveMcpStagingCanaryGenerationEnvironment(
      principal,
      request.url,
      env,
    ),
  });
}
