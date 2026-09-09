import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { createStudioMontageInputSchema } from '@/lib/studio/montage-contract';
import { AgentApiError } from '@/server/agent-api/errors';
import type { AgentPrincipal } from '@/server/agent-api/principal';
import type { MaxVideoAiMcpServices } from '@/server/mcp/server';
import { runAgentTool } from '@/server/mcp/tool-result';
import { StudioConnectedPersistenceError } from '@/server/studio/montage-command';

export const createStudioMontageToolInputSchema = createStudioMontageInputSchema;

export function asStudioMontageAgentError(error: unknown): AgentApiError | unknown {
  if (error instanceof AgentApiError) return error;
  if (error instanceof StudioConnectedPersistenceError) {
    if (error.code === 'STUDIO_IDEMPOTENCY_CONFLICT') {
      return new AgentApiError(
        'PARAMETER_INVALID',
        'This idempotencyKey was already used for a different montage. Use a new key for changed content.',
      );
    }
    if (error.code === 'STUDIO_MONTAGE_PROJECT_GONE') {
      return new AgentApiError('REFERENCE_NOT_FOUND', 'The Studio project created by this retry no longer exists.');
    }
    if (error.code === 'STUDIO_MONTAGE_CREATION_DISABLED') {
      return new AgentApiError('ENGINE_UNAVAILABLE', 'Studio montage creation is not available.');
    }
  }
  const message = error instanceof Error ? error.message : '';
  if (message === 'MEDIA_NOT_AVAILABLE') {
    return new AgentApiError('REFERENCE_NOT_FOUND', 'One or more selected videos are not available.');
  }
  if (message === 'STUDIO_CONNECTED_SCHEMA_UNAVAILABLE') {
    return new AgentApiError('RATE_LIMITED', 'Studio montage creation is temporarily unavailable.', true);
  }
  return error;
}

export function registerCreateStudioMontageTool(
  server: McpServer,
  principal: AgentPrincipal,
  services: MaxVideoAiMcpServices,
): void {
  if (!services.createStudioMontage) {
    throw new Error('create_studio_montage service is required when its gate is enabled.');
  }
  server.registerTool(
    'create_studio_montage',
    {
      title: 'Create an editable Studio montage',
      description:
        'Create one persisted editable Studio project from 2–12 caller-ordered owned ready videos with frame-aligned trims. Reuse the exact idempotencyKey only for an exact retry of the same request.',
      inputSchema: createStudioMontageToolInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => runAgentTool(async () => {
      try {
        return await services.createStudioMontage!(input, principal);
      } catch (error) {
        throw asStudioMontageAgentError(error);
      }
    }),
  );
}
