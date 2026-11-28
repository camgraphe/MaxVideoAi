import { withNativeConfirmationPlatform } from '@/server/agent-api/native-generation-platform';
import { selectedMobileSettings, validMobileSettings } from '@/lib/mobile-model-settings';
import { MAX_CANONICAL_SETTING_STRING_CHARS } from '@/server/agent-api/generation-normalization';
import {
  bindMobileQuoteSources,
  checkLockedMobileQuoteSources,
  mobileSourceEvidence,
} from './reference-visibility';
import { z } from 'zod';
import { AgentApiError } from '@/server/agent-api/errors';
import type { PrepareGenerationDependencies } from '@/server/agent-api/prepare-generation';
import type { ConfirmGenerationDependencies } from '@/server/agent-api/confirm-generation';
import { createQuoteRepository, generationQuoteCodec } from '@/server/agent-api/quote-repository';
import type { MobileGenerationActor } from '@/server/agent-api/generation-actor';
import { readMobileModels } from './catalog';
import { readMobileJob } from './generations';
import { recoverScopedMobileQuote } from './quote-recovery';
import { MAX_GENERATION_REFERENCES } from '@/lib/generation-reference-limits';
import { isMobileMode } from '@/lib/mobile-generation-contract';

const accountUrl = 'https://maxvideoai.com/account/connections';
const quotes = createQuoteRepository(generationQuoteCodec, { origin: 'mobile-session' });
const context = { clientIp: null, userAgent: null };
const draft = z
  .object({
    surface: z.enum(['image', 'video']),
    seedanceWorkflow: z.object({ step: z.literal('draft') }).strict().optional(),
    engineId: z.string().min(1).max(128),
    mode: z.string().max(32),
    operation: z.literal('kling-edit').optional(),
    prompt: z.string().trim().min(1).max(32_000),
    settings: z.record(
      z.string().max(64),
      z.union([z.number().finite(), z.string().max(MAX_CANONICAL_SETTING_STRING_CHARS), z.boolean()]),
    ),
    imageReferences: z
      .array(z.string().regex(/^ma_[a-f0-9]{32}$/u))
      .min(1)
      .max(MAX_GENERATION_REFERENCES)
      .optional(),
    mediaReferences: z.array(z.object({
      fieldId: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/u),
      kind: z.enum(['audio','video']),
      assetId: z.string().regex(/^ma_[a-f0-9]{32}$/u),
    }).strict()).min(1).max(MAX_GENERATION_REFERENCES).optional(),
    lastFrame: z
      .object({ assetId: z.string().regex(/^ma_[a-f0-9]{32}$/u), role: z.literal('last_frame') })
      .strict()
      .optional(),
    reference: z
      .object({
        assetId: z.string().regex(/^ma_[a-f0-9]{32}$/u),
        role: z.enum(['source', 'first_frame', 'reference']),
      })
      .strict()
      .nullish(),
  })
  .strict();
const approved = z.object({ quoteId: z.string().uuid(), confirmed: z.literal(true) }).strict();
const seedanceFinal = z.object({
  surface: z.literal('video'), engineId: z.literal('seedance-2-5'),
  seedanceWorkflow: z.object({ step: z.literal('final'), draftJobId: z.string().min(1).max(255) }).strict(),
  settings: z.object({ resolution: z.enum(['1080p', '4k']) }).strict(),
}).strict();
function actor(userId: string): MobileGenerationActor {
  return { authMethod: 'mobile-session', userId, clientId: null };
}

export async function prepareMobileQuote(
  userId: string,
  body: unknown,
  options: {
    modelSettings?: boolean;
    readModels?: typeof readMobileModels;
    dependencies?: Partial<PrepareGenerationDependencies>;
  } = {},
) {
  const { createPrepareGenerationForActorService } = await import('@/server/agent-api/prepare-generation');
  const final = seedanceFinal.safeParse(body);
  if (final.success) {
    // The shared actor verifies ownership and eligibility and inherits creative settings from the Draft.
    return createPrepareGenerationForActorService(accountUrl, context, {
      ...options.dependencies, paidGenerationEnabled: () => true, insertPreparedQuote: quotes.insertPreparedQuote,
    })(final.data, actor(userId));
  }
  const input = draft.safeParse(body);
  if (!input.success || !isMobileMode(input.data.mode))
    throw new AgentApiError('PARAMETER_INVALID', 'Invalid mobile generation settings.');
  const { surface, engineId, prompt, mode, reference, settings } = input.data;
  const [model] = await (options.readModels ?? readMobileModels)({
    surface,
    id: engineId,
    mediaReferences: !!input.data.mediaReferences,
    modelSettings: options.modelSettings,
    videoOperations: input.data.operation === 'kling-edit',
  });
  const controls = model?.modes.find((item) => item.mode === mode);
  if (!controls) throw new AgentApiError('MODE_UNSUPPORTED', 'This model or mode is unavailable.');
  if (input.data.operation !== controls.operation)
    throw new AgentApiError('MODE_UNSUPPORTED', 'Review the available video operation.');
  if (input.data.seedanceWorkflow && (controls.seedanceDraft !== 'native' || settings.resolution !== '480p'))
    throw new AgentApiError('SEEDANCE_DRAFT_UNAVAILABLE', 'Review the available Draft settings.');
  const media = input.data.mediaReferences;
  const series = input.data.imageReferences;
  for (const item of media ?? []) {
    if (!controls.mediaReferenceFields?.some(field => field.fieldId === item.fieldId && field.kind === item.kind))
      throw new AgentApiError('REFERENCE_INVALID', 'The selected media field is unavailable for this model and workflow.');
  }
  for (const field of controls.mediaReferenceFields ?? []) {
    const count = media?.filter(item => item.fieldId === field.fieldId).length ?? 0;
    if (count < field.min || count > field.max)
      throw new AgentApiError('REFERENCE_INVALID', 'Review the number of selected media references.');
  }
  if (media && mode === 'ref2v' && reference)
    throw new AgentApiError('REFERENCE_INVALID', 'Select reference images in their ordered field.');
  if (controls.requiredReferenceFieldIds?.length && !controls.requiredReferenceFieldIds.some(id =>
    (id === controls.imageSeries?.fieldId && series?.length) || media?.some(item => item.fieldId === id)))
    throw new AgentApiError('REFERENCE_REQUIRED', 'Select a reference accepted by this workflow.');
  if (
    series &&
    (!controls.imageSeries ||
      reference ||
      input.data.lastFrame ||
      series.length < controls.imageSeries.min ||
      series.length > controls.imageSeries.max ||
      new Set(series).size !== series.length)
  )
    throw new AgentApiError(
      'REFERENCE_INVALID',
      'Review the number and order of the selected reference images.',
    );
  if (((mode === 'ref2v' && !(media && controls.imageSeries?.min === 0)) || (controls.imageSeries?.min ?? 1) > 1) && !series)
    throw new AgentApiError('REFERENCE_REQUIRED', 'Choose the reference images for this workflow.');
  if ((controls.lastFrame && !input.data.lastFrame) ||
      (input.data.lastFrame && !(controls.lastFrame || controls.optionalLastFrame)))
    throw new AgentApiError('REFERENCE_REQUIRED', 'Review the first and last frame for this workflow.');
  const alternateMedia = mode === 'ref2v' && !reference && !!media && controls.imageSeries?.min === 0;
  const optionalFirst = controls.optionalFirstFrame && reference?.role === 'first_frame';
  if (!series && !alternateMedia && !optionalFirst && (reference?.role ?? null) !== controls.referenceRole) {
    throw new AgentApiError(
      'REFERENCE_REQUIRED',
      controls.sourceVideo
        ? 'Choose a source video for this workflow.'
        : 'Choose an image for the selected mode.',
    );
  }
  const selected = selectedMobileSettings(controls, settings);
  if (!validMobileSettings(controls, selected))
    throw new AgentApiError('PARAMETER_INVALID', 'The selected settings have changed. Review this model again.');
  const references = [
    ...(series?.map((assetId, slot) => ({
      kind: 'asset' as const,
      role: 'reference' as const,
      assetId,
      slot,
      ...(media ? { fieldId: controls.imageSeries!.fieldId, mediaKind: 'image' as const } : {}),
    })) ?? []),
    ...(media?.map((item, index) => ({
      kind: 'asset' as const, assetId: item.assetId, fieldId: item.fieldId, mediaKind: item.kind,
      role: controls.sourceAudio?.fieldId === item.fieldId ? 'source' as const : 'reference' as const,
      slot: (series?.length ?? 0) + index,
    })) ?? []),
    ...(reference ? [{ kind: 'asset' as const, ...reference }] : []),
    ...(input.data.lastFrame ? [{ kind: 'asset' as const, ...input.data.lastFrame }] : []),
  ];
  const ids = references.map((ref) => ref.assetId);
  if (media && (ids.length > MAX_GENERATION_REFERENCES || new Set(ids).size !== ids.length))
    throw new AgentApiError('REFERENCE_INVALID', 'Each selected media reference must be distinct.');
  const initial = await mobileSourceEvidence(userId, ids);
  const prepare = createPrepareGenerationForActorService(accountUrl, context, {
    ...options.dependencies,
    paidGenerationEnabled: () => true,
    insertPreparedQuote: async (quote, deps) =>
      quotes.insertPreparedQuote(
        {
          ...quote,
          pricingSnapshot: await bindMobileQuoteSources(
            userId,
            quote.request,
            quote.pricingSnapshot,
            initial,
            deps.executor,
          ),
        },
        deps,
      ),
  });
  return prepare(
    {
      surface,
      engineId,
      mode: controls.mode,
      ...(controls.operation ? { operation: controls.operation } : {}),
      ...(input.data.seedanceWorkflow ? { seedanceWorkflow: input.data.seedanceWorkflow } : {}),
      prompt,
      settings: selected,
      outputCount: 1,
      ...(media ? { orderedMediaReferences: true as const } : series ? { orderedImageReferences: true as const } : {}),
      references,
    },
    actor(userId),
  );
}

export async function confirmMobileQuote(
  userId: string,
  body: unknown,
  dependencies: Partial<ConfirmGenerationDependencies> = {},
  headers?: Headers,
) {
  const input = approved.safeParse(body);
  if (!input.success)
    throw new AgentApiError('CONFIRMATION_REQUIRED', 'Confirm the exact quote before generating.');
  const { createConfirmGenerationForActorService } = await import('@/server/agent-api/confirm-generation');
  const confirm = createConfirmGenerationForActorService(accountUrl, context, {
    ...dependencies,
    paidGenerationEnabled: () => true,
    trialGenerationEnabled: () => false,
    lockOwnedQuote: async (owner, deps) =>
      checkLockedMobileQuoteSources(await quotes.lockOwnedQuote(owner, deps), deps.executor),
    markQuoteExpired: quotes.markQuoteExpired,
    claimPreparedQuote: quotes.claimPreparedQuote,
    markQuoteAccepted: quotes.markQuoteAccepted,
    markQuoteFailed: quotes.markQuoteFailed,
  });
  const session = actor(userId);
  const accepted = await confirm(input.data, headers ? withNativeConfirmationPlatform(session, headers) : session);
  return readMobileJob(userId, accepted.jobId);
}

export function recoverMobileQuote(userId: string, quoteId: string) {
  return recoverScopedMobileQuote(userId, quoteId, quotes.lockOwnedQuote);
}
