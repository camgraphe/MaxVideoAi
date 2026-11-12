import {
  createCharacterBuilderAuthoringService,
} from '@/server/character-studio/authoring';
import type {
  CharacterBuilderAuthoringInput, CharacterBuilderConfirmationInput,
} from '@/server/character-studio/authoring-request';
import type { AgentGenerationStatus } from '@/server/generations/generation-status';
import { AgentApiError } from './errors';
import { requireOAuthGenerationActor } from './generation-actor';
import { buildAgentGenerationRecovery, buildGenerationResourceLinks } from './generation-status';
import type { AgentPrincipal } from './principal';

function builderRecovery(status:AgentGenerationStatus|null,quoteId:string,accountUrl:string) {
  if (!status) return {quoteId,jobId:null,status:'no_job' as const,retry:null};
  const recovery=buildAgentGenerationRecovery(status,accountUrl);
  return {...recovery,quoteId,retry:recovery.retry&&{
    tool:'get_character_builder_status' as const,arguments:{quoteId},afterSeconds:recovery.retry.afterSeconds,
  }};
}
export function buildCharacterBuilderResourceLinks(result:ReturnType<typeof builderRecovery>) {
  return 'surface' in result?buildGenerationResourceLinks({...result,retry:null}):[];
}
export function createAgentCharacterBuilderService(
  principal:AgentPrincipal,
  options:{executionEnabled:boolean;accountUrl:string},
  createIntegration=createCharacterBuilderAuthoringService,
) {
  requireOAuthGenerationActor(principal);
  if (!principal.clientId) throw new AgentApiError('AUTH_REQUIRED','Connect MaxVideoAI to use Character Builder.');
  const service=createIntegration(principal,options);
  return {
    prepare:(input:CharacterBuilderAuthoringInput)=>service.prepare(input),
    async confirm(input:CharacterBuilderConfirmationInput) {
      return builderRecovery(await service.confirm(input),input.quoteId,options.accountUrl);
    },
    async getQuote(input:{quoteId:string}) {
      const owned=await service.getQuote(input);
      if (!owned) throw new AgentApiError('QUOTE_EXPIRED','This Character Builder quote is unavailable in this context.');
      return {...owned,expiresAt:owned.expiresAt.toISOString()};
    },
    async recover(input:{quoteId:string}) {
      return builderRecovery(await service.recover(input),input.quoteId,options.accountUrl);
    },
  };
}
export type AgentCharacterBuilderService=ReturnType<typeof createAgentCharacterBuilderService>;
