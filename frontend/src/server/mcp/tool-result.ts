import { randomUUID } from 'node:crypto';

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { AgentApiError, toAgentApiFailure } from '@/server/agent-api/errors';

function asStructuredContent(value: object): Record<string, unknown> {
  return value as Record<string, unknown>;
}

function resultContent(value: object): CallToolResult['content'] {
  return [{ type: 'text', text: JSON.stringify(value, null, 2) }];
}

export function successfulToolResult(value: object): CallToolResult {
  return {
    content: resultContent(value),
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
