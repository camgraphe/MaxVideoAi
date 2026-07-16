import { randomUUID } from 'node:crypto';

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { AgentApiError, toAgentApiFailure } from '@/server/agent-api/errors';
import type { AgentGenerationResourceLink } from '@/server/agent-api/generation-status';

const MAX_RESOURCE_LINKS_PER_RESPONSE = 20;

function asStructuredContent(value: object): Record<string, unknown> {
  return value as Record<string, unknown>;
}

function resultContent(
  value: object,
  resourceLinks: ReadonlyArray<AgentGenerationResourceLink> = [],
): CallToolResult['content'] {
  return [
    { type: 'text', text: JSON.stringify(value, null, 2) },
    ...resourceLinks.slice(0, MAX_RESOURCE_LINKS_PER_RESPONSE).map((link) => ({
      type: 'resource_link' as const,
      ...link,
    })),
  ];
}

export function successfulToolResult(
  value: object,
  resourceLinks: ReadonlyArray<AgentGenerationResourceLink> = [],
): CallToolResult {
  return {
    content: resultContent(value, resourceLinks),
    structuredContent: asStructuredContent(value),
  };
}

export async function runAgentTool(operation: () => Promise<object>): Promise<CallToolResult> {
  try {
    return successfulToolResult(await operation());
  } catch (error) {
    if (error instanceof AgentApiError) {
      const failure = toAgentApiFailure(error);
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
    };
  }
}

export async function runAgentToolWithResourceLinks<TValue extends object>(
  operation: () => Promise<TValue>,
  resources: (value: TValue) => ReadonlyArray<AgentGenerationResourceLink>,
): Promise<CallToolResult> {
  try {
    const value = await operation();
    return successfulToolResult(value, resources(value));
  } catch (error) {
    return runAgentTool(async () => { throw error; });
  }
}
