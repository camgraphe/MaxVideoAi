import { ZodError } from 'zod';
import { query } from '@/lib/db';
import { AgentApiError } from '@/server/agent-api/errors';
import { requireGenerationActor, quoteMatchesActor, type GenerationActor } from '@/server/agent-api/generation-actor';
import { createQuoteRepository, generationQuoteCodec, type McpGenerationQuote, type GenerationQuoteScope } from '@/server/agent-api/quote-repository';
import { createCreatorGenerationService } from '@/server/tools/creator-generation-service';
import { getGenerationStatus } from '@/server/generations/generation-status';
import { resolveStudioMedia } from '@/server/studio/media-resolver';
import { getActiveAccountRestriction } from '@/server/fraud-cleanup';
import { listStudioCharacters, getStudioCharacter, getStudioCharacterLook, saveStudioCharacterOutput } from './store';
import { StudioLibraryError } from './source';
import { prepareRecast, confirmRecast, resolveCharacterPortraitAsset, type RecastPreparationDependencies, type RecastLifecycleOptions } from './recast';
import { recastReadiness } from './recast-readiness';
import { characterListInput, characterGetInput, characterSelectionInput, characterSaveInput, integrationRecastSettings, recastQuoteInput, recastConfirmationInput } from './integration-request';

export type RecastPassages = Partial<Record<'audio'|'video', {
  startSec:number; endSec:number; durationSec:number; sourceId:string; excerptId:string;
}>>;
export type CharacterStudioIntegrationOptions = RecastLifecycleOptions & {
  executionEnabled: boolean;
  prepareDependencies?: RecastPreparationDependencies;
  generation?: typeof createCreatorGenerationService;
  readiness?: typeof recastReadiness;
  generationStatus?: typeof getGenerationStatus;
};

async function publicErrors<T>(action: () => Promise<T>): Promise<T> {
  try { return await action(); } catch (error) {
    if (error instanceof ZodError) throw new AgentApiError('PARAMETER_INVALID', 'Check the character or Recast settings.');
    if (error instanceof StudioLibraryError) throw new AgentApiError(
      error.status === 401 ? 'AUTH_REQUIRED' : error.status === 404 ? 'REFERENCE_NOT_FOUND' : 'PARAMETER_INVALID',
      error.status === 404 ? 'This character, look or original is unavailable in your account.' : 'Check the character selection.',
    );
    throw error;
  }
}
function scope(actor: GenerationActor): GenerationQuoteScope {
  return actor.authMethod === 'studio-session' ? { origin: actor.authMethod, projectId: actor.projectId } : { origin: actor.authMethod };
}

/** Authorized consumers choose the actor and admission. Model arguments cannot choose either. */
export function createCharacterStudioIntegration(actor: GenerationActor, options: CharacterStudioIntegrationOptions) {
  requireGenerationActor(actor);
  const quotes = createQuoteRepository(generationQuoteCodec, scope(actor));
  const readiness = options.readiness ?? recastReadiness;
  const generation = options.generation ?? createCreatorGenerationService;
  const status = options.generationStatus ?? getGenerationStatus;
  const readAcceptedJob = async (quoteId: string, jobId: string) => {
    const job = await status({userId:actor.userId,jobId});
    if (!job) throw new AgentApiError('INTERNAL_ERROR',
      'The accepted Recast job is temporarily unavailable. Recover this same quote; do not submit a replacement.',
      true, {type:'retry',quoteId});
    return job;
  };

  const select = (value: unknown) => publicErrors(async () => {
    const input = characterSelectionInput.parse(value);
    const character = await getStudioCharacter(actor.userId, input.characterId);
    const look = input.lookId ? await getStudioCharacterLook(actor.userId, input.characterId, input.lookId) : null;
    const image = look ?? character.identity;
    const assetId = await resolveCharacterPortraitAsset(actor.userId, { jobId: image.jobId, imageUrl: image.imageUrl });
    await resolveStudioMedia(actor.userId, { type:'asset', assetId, kind:'image' });
    return { characterId: character.id, lookId: look?.id ?? null, name: character.name,
      lookName: look?.name ?? null, assetId, kind:'image' as const, jobId:image.jobId };
  });

  const getRecastQuote = (value: unknown): Promise<(McpGenerationQuote & {passages: RecastPassages}) | null> => publicErrors(async () => {
    const {quoteId} = recastQuoteInput.parse(value);
    const quote = await quotes.getOwnedQuote({quoteId, userId:actor.userId, oauthClientId:actor.clientId});
    if (!quote || !quoteMatchesActor(quote,actor) || quote.request.engineId !== 'wan-3-prime') return null;
    const [binding] = await query<{passages:RecastPassages}>(
      'SELECT passages FROM character_studio_recast_quotes WHERE quote_id=$1 AND user_id=$2 AND request_hash=$3',
      [quoteId, actor.userId, quote.requestHash],
    );
    return binding ? {...quote, passages:binding.passages} : null;
  });
  return {
    list: (value: unknown = {}) => publicErrors(async () => {
      const input = characterListInput.parse(value);
      return listStudioCharacters(actor.userId, input.cursor, input.name, input.search);
    }),
    get: (value: unknown) => publicErrors(async () => {
      const input = characterGetInput.parse(value);
      return getStudioCharacter(actor.userId, input.characterId, input.lookCursor, undefined, input.lookName);
    }),
    select,
    save: (value: unknown) => publicErrors(() => saveStudioCharacterOutput(actor.userId, characterSaveInput.parse(value))),
    prepareRecast: (value: unknown) => publicErrors(async () => {
      const input = integrationRecastSettings.parse(value);
      if (!options.executionEnabled) throw new AgentApiError('ENGINE_UNAVAILABLE', 'Recast preparation is currently unavailable.');
      if (actor.authMethod === 'oauth' && !actor.emailVerified)
        throw new AgentApiError('EMAIL_VERIFICATION_REQUIRED', 'Verify your email before preparing Recast.');
      if (await getActiveAccountRestriction(actor.userId)) throw new AgentApiError('ACCOUNT_RESTRICTED', 'This account cannot prepare Recast.');
      const mode = input.video ? 'v2v' : input.audio || input.product ? 'ref2v' : 'i2v';
      if (readiness(mode)) throw new AgentApiError('ENGINE_UNAVAILABLE', 'Recast preparation is currently unavailable.');
      const portrait = 'characterId' in input.portrait ? {assetId:(await select(input.portrait)).assetId} : input.portrait;
      return prepareRecast(actor, {...input, portrait}, options.prepareDependencies, options);
    }),
    getRecastQuote,
    confirmRecast: (value: unknown) => publicErrors(async () => {
      const input = recastConfirmationInput.parse(value);
      const quote = await getRecastQuote({quoteId:input.quoteId});
      if (!quote) throw new AgentApiError('QUOTE_EXPIRED', 'This Recast quote is not available in this context.');
      // The transactional confirmation owner recovers claimed jobs before admission checks.
      // Closing execution must prevent a new purchase without stranding an accepted one.
      const adapter: typeof createCreatorGenerationService = (currentActor, currentOptions) => generation(currentActor, {
        ...currentOptions, enabled: options.executionEnabled && !readiness(quote.request.mode as 'i2v'|'ref2v'|'v2v'),
      });
      if (quote.state === 'prepared' && actor.authMethod === 'oauth' && !actor.emailVerified)
        throw new AgentApiError('EMAIL_VERIFICATION_REQUIRED', 'Verify your email before confirming Recast.');
      const job = await confirmRecast(actor,input,adapter,options);
      return readAcceptedJob(input.quoteId,job.jobId);
    }),
    recoverRecast: (value: unknown) => publicErrors(async () => {
      const quote = await getRecastQuote(value);
      if (!quote) throw new AgentApiError('QUOTE_EXPIRED', 'This Recast quote is not available in this context.');
      return quote.jobId ? readAcceptedJob(quote.quoteId,quote.jobId) : null;
    }),
  };
}
export type CharacterStudioIntegration = ReturnType<typeof createCharacterStudioIntegration>;
