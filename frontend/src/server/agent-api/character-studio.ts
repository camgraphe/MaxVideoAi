import type { z } from 'zod';

import { createCharacterStudioIntegration } from '@/server/character-studio/integration';
import type {
  characterGetInput,
  characterListInput,
  characterSaveInput,
  characterSelectionInput,
  CharacterStudioRecastInput,
  recastConfirmationInput,
  recastQuoteInput,
} from '@/server/character-studio/integration-request';
import type { AgentGenerationStatus } from '@/server/generations/generation-status';

import { buildAgentAccountDestinations } from './account-destinations';
import { AgentApiError } from './errors';
import { requireOAuthGenerationActor } from './generation-actor';
import { buildAgentGenerationRecovery, buildGenerationResourceLinks } from './generation-status';
import type { AgentPrincipal } from './principal';

function recastRecovery(status: AgentGenerationStatus | null, quoteId: string, accountUrl: string) {
  if (!status) return { quoteId, jobId: null, status: 'no_job' as const, retry: null };
  const recovery = buildAgentGenerationRecovery(status, accountUrl);
  return {
    ...recovery,
    quoteId,
    retry: recovery.retry && {
      tool: 'get_recast_status' as const,
      arguments: { quoteId },
      afterSeconds: recovery.retry.afterSeconds,
    },
  };
}

export function buildRecastResourceLinks(result: ReturnType<typeof recastRecovery>) {
  return 'surface' in result ? buildGenerationResourceLinks({ ...result, retry: null }) : [];
}

export function createAgentCharacterStudioService(
  principal: AgentPrincipal,
  options: { executionEnabled: boolean; accountUrl: string },
  createIntegration = createCharacterStudioIntegration,
) {
  requireOAuthGenerationActor(principal);
  if (!principal.clientId) throw new AgentApiError('AUTH_REQUIRED', 'Connect MaxVideoAI in your MCP host to use Character Studio.');
  const service = createIntegration(principal, options);
  return {
    async list(input: z.input<typeof characterListInput>) {
      const page = await service.list(input);
      const { connections } = buildAgentAccountDestinations(options.accountUrl);
      return {
        ...page,
        characterBuilderUrl: new URL('/app/tools/character-builder', connections.url).toString(),
      };
    },
    get: (input: z.input<typeof characterGetInput>) => service.get(input),
    select: (input: z.input<typeof characterSelectionInput>) => service.select(input),
    save: (input: z.input<typeof characterSaveInput>) => service.save(input),
    prepareRecast: (input: CharacterStudioRecastInput) => service.prepareRecast(input),
    async confirmRecast(input: z.input<typeof recastConfirmationInput>) {
      const status = await service.confirmRecast(input);
      if (!status) throw new AgentApiError('INTERNAL_ERROR', 'The submitted Recast status is unavailable. Recover it using the same quoteId.');
      return recastRecovery(status, input.quoteId, options.accountUrl);
    },
    async getRecastQuote(input: z.input<typeof recastQuoteInput>) {
      const quote = await service.getRecastQuote(input);
      if (!quote) throw new AgentApiError('QUOTE_EXPIRED', 'This Recast quote is not available in this context.');
      return {
        quoteId: quote.quoteId,
        amountCents: quote.priceCents,
        currency: quote.currency,
        expiresAt: quote.expiresAt.toISOString(),
        state: quote.state,
        jobId: quote.jobId,
        summary: quote.request,
        requestHash: quote.requestHash,
        passages: quote.passages,
      };
    },
    async recoverRecast(input: z.input<typeof recastQuoteInput>) {
      return recastRecovery(await service.recoverRecast(input), input.quoteId, options.accountUrl);
    },
  };
}

export type AgentCharacterStudioService = ReturnType<typeof createAgentCharacterStudioService>;
