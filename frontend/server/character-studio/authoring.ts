import { createHash } from 'node:crypto';
import { ZodError } from 'zod/v4';
import { query, type QueryExecutor } from '@/lib/db';
import { AgentApiError } from '@/server/agent-api/errors';
import { quoteMatchesActor, requireGenerationActor, type GenerationActor } from '@/server/agent-api/generation-actor';
import { stableJson } from '@/server/agent-api/generation-normalization';
import { priceCanonicalGeneration, priceCanonicalGenerationInExecutor, type GenerationPricingResult } from '@/server/agent-api/generation-pricing';
import { reservePaidGenerationInitialJob } from '@/server/agent-api/paid-generation-execution';
import { createQuoteRepository, generationQuoteCodec, type McpGenerationQuote } from '@/server/agent-api/quote-repository';
import { createCreatorGenerationService, type CreatorGenerationOptions } from '@/server/tools/creator-generation-service';
import { getGenerationStatus } from '@/server/generations/generation-status';
import { prepareCharacterBuilderRequest } from '@/server/tools/character-builder/preparation';
import { CharacterBuilderError } from '@/server/tools/character-builder/error';
import type { CharacterBuilderSettingsSnapshot } from '@/types/character-builder';
import { prepareCharacterBuilderAuthoring, characterBuilderCanonicalRequest } from './authoring-preparation';
import { characterBuilderQuoteInput, characterBuilderConfirmationInput } from './authoring-request';
import { projectCharacterBuilderRecipe } from './authoring-output';
import { StudioLibraryError } from './source';

export type CharacterBuilderAuthoringOptions = {
  executionEnabled:boolean;
  accountUrl?:string;
  generation?:typeof createCreatorGenerationService;
  generationStatus?:typeof getGenerationStatus;
  onQuotePrepared?:CreatorGenerationOptions['onQuotePrepared'];
};
type Binding = {recipe:CharacterBuilderSettingsSnapshot;recipe_hash:string;reference_fingerprint:string};
const recipeHash = (recipe: CharacterBuilderSettingsSnapshot) => createHash('sha256').update(stableJson(recipe)).digest('hex');
function unavailable():never {throw new AgentApiError('QUOTE_EXPIRED','Review the current Character Builder quote.');}
function marker(quote:McpGenerationQuote):unknown {
  return (quote.pricingSnapshot.canonicalPricing as {meta?:{characterBuilderRecipeHash?:unknown}}|undefined)?.meta?.characterBuilderRecipeHash;
}
/** This marker keeps ordinary confirmation from discarding a Builder recipe. */
function bindPricing(pricing:GenerationPricingResult, hash:string):GenerationPricingResult {
  return {...pricing,pricingSnapshot:{...pricing.pricingSnapshot,meta:{
    ...(pricing.pricingSnapshot.meta as Record<string,unknown>|undefined),characterBuilderRecipeHash:hash,
  }}};
}
async function publicErrors<T>(action:()=>Promise<T>):Promise<T> {
  try {return await action();} catch(error) {
    if (error instanceof ZodError || error instanceof CharacterBuilderError)
      throw new AgentApiError('PARAMETER_INVALID','Check the Character Builder recipe and owned references.');
    if (error instanceof StudioLibraryError)
      throw new AgentApiError('REFERENCE_NOT_FOUND','The saved character or original is unavailable in your account.');
    throw error;
  }
}

/** No transport arguments can select the actor, quote scope, price owner or job metadata. */
export function createCharacterBuilderAuthoringService(actor:GenerationActor,options:CharacterBuilderAuthoringOptions) {
  requireGenerationActor(actor);
  const generation = options.generation??createCreatorGenerationService;
  const readStatus = options.generationStatus??getGenerationStatus;
  const scope = actor.authMethod==='studio-session'?{origin:actor.authMethod,projectId:actor.projectId}:{origin:actor.authMethod};
  const quotes = createQuoteRepository(generationQuoteCodec,scope);
  async function binding(quote:McpGenerationQuote,db:QueryExecutor,lock=false):Promise<Binding|null> {
    const [row] = await db.query<Binding>(`SELECT recipe,recipe_hash,reference_fingerprint FROM character_builder_quotes
      WHERE quote_id=$1 AND user_id=$2 AND request_hash=$3${lock?' FOR SHARE':''}`,
      [quote.quoteId,actor.userId,quote.requestHash]);
    if (!row || recipeHash(row.recipe)!==row.recipe_hash || marker(quote)!==row.recipe_hash) return null;
    // Accepted history uses its frozen recipe; current prompt/default changes cannot strand recovery.
    if (quote.state!=='prepared') return row;
    const recipe = row.recipe;
    const prepared = prepareCharacterBuilderRequest({...recipe.builder,action:recipe.action,lineage:recipe.lineage,
      generateCount:1,userId:actor.userId});
    if (recipe.action!=='generate' || stableJson(prepared.settingsSnapshot)!==stableJson(recipe)
      || stableJson(quote.request)!==stableJson(characterBuilderCanonicalRequest(prepared))) return null;
    return row;
  }
  async function ownedQuote(value:unknown) {
    const {quoteId}=characterBuilderQuoteInput.parse(value);
    const quote=await quotes.getOwnedQuote({quoteId,userId:actor.userId,oauthClientId:actor.clientId});
    if (!quote || !quoteMatchesActor(quote,actor)) return null;
    const row=await binding(quote,{query});
    return row?{quote,...row}:null;
  }
  async function readAcceptedJob(jobId:string) {
    const status=await readStatus({userId:actor.userId,jobId});
    if (!status) throw new AgentApiError('INTERNAL_ERROR',
      'The accepted Character Builder job is temporarily unavailable. Recover this same quote.',true,{type:'retry',jobId});
    return status;
  }
  return {
    /** Server-only journal projection; never registered as a transport tool. */
    readStoredQuote:(value:unknown)=>publicErrors(()=>ownedQuote(value)),
    prepare:(value:unknown)=>publicErrors(async()=>{
      if (!options.executionEnabled) throw new AgentApiError('ENGINE_UNAVAILABLE','Character Builder preparation is unavailable.');
      if (actor.authMethod==='oauth'&&!actor.emailVerified)
        throw new AgentApiError('EMAIL_VERIFICATION_REQUIRED','Verify your email before preparing Character Builder.');
      const {prepared,canonical,referenceFingerprint}=await prepareCharacterBuilderAuthoring(actor,value);
      const hash=recipeHash(prepared.settingsSnapshot);
      const quote=await generation(actor,{enabled:options.executionEnabled,accountUrl:options.accountUrl,
        expectedReferenceFingerprint:referenceFingerprint,
        prepareDependencies:{priceGeneration:async(request,tier,context)=>
          bindPricing(await priceCanonicalGeneration(request,tier,undefined,context),hash)},
        onQuotePrepared:async(quote,tx)=>{
          await tx.query(`INSERT INTO character_builder_quotes(quote_id,user_id,request_hash,recipe_hash,reference_fingerprint,recipe)
            VALUES($1,$2,$3,$4,$5,$6::jsonb)`,[quote.quoteId,actor.userId,quote.requestHash,hash,referenceFingerprint,
              JSON.stringify(prepared.settingsSnapshot)]);
          await options.onQuotePrepared?.(quote,tx);
        },
      }).prepare(canonical);
      return {kind:'wallet' as const,quoteId:quote.quoteId,amountCents:quote.price.amountCents,currency:quote.price.currency,
        expiresAt:quote.expiresAt,topupRequired:quote.topupRequired,recipe:projectCharacterBuilderRecipe(prepared.settingsSnapshot),quote};
    }),
    getQuote:(value:unknown)=>publicErrors(async()=>{
      const owned=await ownedQuote(value);
      if (!owned) return null;
      const {quote,recipe}=owned;
      return {quoteId:quote.quoteId,amountCents:quote.priceCents,currency:quote.currency,
        expiresAt:quote.expiresAt,state:quote.state,jobId:quote.jobId,recipe:projectCharacterBuilderRecipe(recipe)};
    }),
    confirm:(value:unknown)=>publicErrors(async()=>{
      const input=characterBuilderConfirmationInput.parse(value);
      const owned=await ownedQuote({quoteId:input.quoteId});
      if (!owned) unavailable();
      if (owned.quote.state==='prepared'&&actor.authMethod==='oauth'&&!actor.emailVerified)
        throw new AgentApiError('EMAIL_VERIFICATION_REQUIRED','Verify your email before confirming Character Builder.');
      const job=await generation(actor,{enabled:options.executionEnabled,accountUrl:options.accountUrl,
        expectedReferenceFingerprint:owned.reference_fingerprint,
        onQuoteLocked:async(quote,tx)=>{
          const row=await binding(quote,tx,true);
          if (!row || quote.priceCents!==input.amountCents || quote.currency!==input.currency) unavailable();
          if (quote.state==='prepared'&&row.recipe.builder.characterId) {
            const [character]=await tx.query('SELECT id FROM character_studio_characters WHERE id=$1 AND user_id=$2 FOR SHARE',
              [row.recipe.builder.characterId,actor.userId]);
            if (!character) throw new AgentApiError('REFERENCE_NOT_FOUND','The saved character is unavailable in your account.');
          }
        },
        confirmDependencies:{
          priceGeneration:async(request,tier,dependencies)=>bindPricing(
            await priceCanonicalGenerationInExecutor(request,tier,dependencies),owned.recipe_hash),
          reserveInitialJob:(input,dependencies)=>reservePaidGenerationInitialJob({...input,imageJob:{
            surface:'character',settingsSnapshot:owned.recipe}},dependencies),
        },
      }).confirm({quoteId:input.quoteId,confirmed:true});
      return readAcceptedJob(job.jobId);
    }),
    recover:(value:unknown)=>publicErrors(async()=>{
      const owned=await ownedQuote(value);
      if (!owned) unavailable();
      return owned.quote.jobId?readAcceptedJob(owned.quote.jobId):null;
    }),
  };
}
export type CharacterBuilderAuthoringService=ReturnType<typeof createCharacterBuilderAuthoringService>;
