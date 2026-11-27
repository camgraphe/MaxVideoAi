import { withNativeConfirmationPlatform } from '@/server/agent-api/native-generation-platform';
import { bindMobileQuoteSources, checkLockedMobileQuoteSources, mobileSourceEvidence } from './reference-visibility';
import { z } from 'zod';
import { audioModeIds } from '@/lib/mobile-audio-contract';
import { listAudioCapabilities } from '@/server/agent-api/audio-capabilities';
import { canonicalAudioRequestSchema } from '@/server/agent-api/audio-normalization';
import { audioQuoteRepositoryForActor } from '@/server/agent-api/audio-quote-repository';
import type { ConfirmAudioGenerationDependencies } from '@/server/agent-api/confirm-audio-generation';
import { AgentApiError } from '@/server/agent-api/errors';
import type { MobileGenerationActor } from '@/server/agent-api/generation-actor';
import type { PrepareAudioGenerationDependencies } from '@/server/agent-api/prepare-audio-generation';
import { acceptsMobileAudioSetting, readMobileAudioCatalog } from './audio-catalog';
import { readMobileJob } from './generations';
import { recoverScopedMobileQuote } from './quote-recovery';

const draftSchema = canonicalAudioRequestSchema
  .pick({ surface: true, mode: true, engineId: true, prompt: true, settings: true })
  .extend({ mode: z.enum(audioModeIds), references: z.array(z.object({
    role: z.enum(['source_video', 'voice_sample']),
    asset: z.object({ type: z.literal('asset'), kind: z.enum(['video', 'audio']), assetId: z.string().regex(/^ma_[a-f0-9]{32}$/u) }).strict(),
  }).strict()).max(2).optional() })
  .strict();
const approval = z.object({ quoteId: z.string().uuid(), confirmed: z.literal(true) }).strict();
const accountUrl = 'https://maxvideoai.com/account/connections';
function actor(userId: string): MobileGenerationActor {
  return { authMethod: 'mobile-session', userId, clientId: null };
}

export async function prepareMobileAudioQuote(
  userId: string,
  body: unknown,
  dependencies: Partial<PrepareAudioGenerationDependencies> = {},
) {
  const parsed = draftSchema.safeParse(body);
  if (!parsed.success) throw new AgentApiError('PARAMETER_INVALID', 'Invalid Audio settings.');
  const input = parsed.data;
  const capabilities = (dependencies.listCapabilities ?? listAudioCapabilities)();
  const mode = readMobileAudioCatalog(capabilities, true).modes.find(
    (item) => item.mode === input.mode && item.engineId === input.engineId,
  );
  if (!mode) throw new AgentApiError('PARAMETER_INVALID', 'The selected engine does not provide this Audio mode.');
  if (!mode.available)
    throw new AgentApiError('ENGINE_UNAVAILABLE', 'This Audio mode is unavailable.');
  const references = input.references ?? [];
  if ((mode.references?.sourceVideo === 'required' && !references.some(ref => ref.role === 'source_video')) ||
      references.some(ref => ref.role === 'voice_sample' && (
        mode.references?.voiceSample !== 'optional_seed_only' || input.settings.voiceModel !== 'seed'
      ))) throw new AgentApiError('REFERENCE_INVALID', 'Review the source media for this audio project.');
  const selected = mode.variants.filter((variant) =>
    Object.entries(variant.settings).every(([key, fixed]) => {
      const value = input.settings[key as keyof typeof input.settings];
      return value === undefined || value === fixed;
    }),
  );
  if (!selected.some((variant) => variant.available))
    throw new AgentApiError('ENGINE_UNAVAILABLE', 'This Audio variant is unavailable.');
  const fields = Object.entries(input.settings);
  if (
    !selected.some(
      (variant) =>
        variant.available &&
        fields.every(([key, value]) =>
          acceptsMobileAudioSetting(
            variant.controls.find((control) => control.key === key),
            value,
          ),
        ),
    )
  ) {
    throw new AgentApiError('PARAMETER_INVALID', 'Review the settings for this Audio variant.');
  }
  const initial = await mobileSourceEvidence(userId, references.map(ref => ref.asset.assetId));
  const quotes = audioQuoteRepositoryForActor(actor(userId));
  const { createPrepareAudioGenerationForActorService } = await import('@/server/agent-api/prepare-audio-generation');
  const prepare = createPrepareAudioGenerationForActorService(accountUrl, {
    ...dependencies,
    insertPreparedQuote: async (quote, deps) => quotes.insertPreparedQuote({
      ...quote, pricingSnapshot: await bindMobileQuoteSources(userId, quote.request, quote.pricingSnapshot, initial, deps.executor),
    }, deps),
    listCapabilities: () => capabilities,
    paidGenerationEnabled: () => true,
  });
  return prepare({ ...input, references, outputCount: 1 }, actor(userId));
}

export async function confirmMobileAudioQuote(
  userId: string,
  body: unknown,
  dependencies: Partial<ConfirmAudioGenerationDependencies> = {},
  headers?: Headers,
) {
  const input = approval.safeParse(body);
  if (!input.success)
    throw new AgentApiError(
      'CONFIRMATION_REQUIRED',
      'Confirm the exact Audio quote before generating.',
    );
  const quotes = audioQuoteRepositoryForActor(actor(userId));
  const { createConfirmAudioGenerationForActorService } = await import('@/server/agent-api/confirm-audio-generation');
  const confirm = createConfirmAudioGenerationForActorService(accountUrl, {
    ...dependencies,
    lockOwnedQuote: async (owner, deps) => checkLockedMobileQuoteSources(await quotes.lockOwnedQuote(owner, deps), deps.executor),
    paidGenerationEnabled: () => true,
  });
  const session = actor(userId);
  const accepted = await confirm(input.data, headers ? withNativeConfirmationPlatform(session, headers) : session);
  return readMobileJob(userId, accepted.jobId);
}

export function recoverMobileAudioQuote(userId: string, quoteId: string) {
  return recoverScopedMobileQuote(
    userId,
    quoteId,
    audioQuoteRepositoryForActor(actor(userId)).lockOwnedQuote,
  );
}
