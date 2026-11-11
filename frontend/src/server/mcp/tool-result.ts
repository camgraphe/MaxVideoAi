import { randomUUID } from 'node:crypto';

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { AgentApiError, toAgentApiFailure } from '@/server/agent-api/errors';
import type { AgentGenerationResourceLink } from '@/server/agent-api/generation-status';
import { projectMcpToolResult, type McpToolResultPolicy } from '@/server/mcp/distribution-profile';

const MAX_RESOURCE_LINKS_PER_RESPONSE = 20;

function asStructuredContent(value: object): Record<string, unknown> {
  return value as Record<string, unknown>;
}

function resultContent(
  value: object,
  resourceLinks: ReadonlyArray<AgentGenerationResourceLink> = [],
): CallToolResult['content'] {
  return [
    // Preserve the complete JSON fallback alongside structuredContent for hosts
    // that consume either representation. Only formatting whitespace is removed.
    { type: 'text', text: JSON.stringify(value) },
    ...resourceLinks.slice(0, MAX_RESOURCE_LINKS_PER_RESPONSE).map((link) => ({
      type: 'resource_link' as const,
      ...link,
    })),
  ];
}

export function successfulToolResult(
  value: object,
  resourceLinks: ReadonlyArray<AgentGenerationResourceLink> = [],
  policy?: McpToolResultPolicy,
): CallToolResult {
  const projected = projectMcpToolResult(value, policy);
  return {
    content: resultContent(projected, resourceLinks),
    structuredContent: asStructuredContent(projected),
  };
}

export async function runAgentTool(
  operation: () => Promise<object>,
  policy?: McpToolResultPolicy,
): Promise<CallToolResult> {
  try {
    return successfulToolResult(await operation(), [], policy);
  } catch (error) {
    if (error instanceof AgentApiError) {
      const failure = projectMcpToolResult(toAgentApiFailure(error), policy);
      return {
        isError: true,
        content: resultContent(failure),
        structuredContent: asStructuredContent(failure),
      };
    }

    const correlationId = randomUUID();
    console.error('[mcp] unexpected tool failure', { correlationId });
    const failure = {
      ok: false as const,
      error: {
        code: 'INTERNAL_ERROR' as const,
        message: 'An unexpected error occurred.',
        retryable: false,
        nextAction: null,
        correlationId,
      },
    };
    return {
      isError: true,
      content: resultContent(failure),
      structuredContent: asStructuredContent(failure),
      _meta: { correlationId },
    };
  }
}

export async function runAgentToolWithResourceLinks<TValue extends object>(
  operation: () => Promise<TValue>,
  resources: (value: TValue) => ReadonlyArray<AgentGenerationResourceLink>,
  policy?: McpToolResultPolicy,
): Promise<CallToolResult> {
  try {
    const value = await operation();
    return successfulToolResult(value, resources(value), policy);
  } catch (error) {
    return runAgentTool(async () => { throw error; }, policy);
  }
}
