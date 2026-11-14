import type { TransactionQueryExecutor } from '@/lib/db';
import { toolAssetRefSchema, type ToolAssetRef } from '@/lib/toolbox/contract';
import { creatorOperationInputSchema } from '@/lib/toolbox/creator-tools';
import { conversationSelectionSettings } from '@/lib/studio/conversation-creation-contract';
import { studioCreatorQuoteSchema, studioCreatorOperationViewSchema, type StudioCreatorPreparation,
  type StudioCreatorQuote, type StudioCreatorOperationView } from '@/lib/studio/conversation-creator-contract';
import { requireGenerationActor, type StudioGenerationActor } from '@/server/agent-api/generation-actor';
import { AgentApiError } from '@/server/agent-api/errors';
import { createCreatorOperationsService } from '@/server/tools/creator-operations';
import { createSubtitleOperationsService } from '@/server/subtitles/operations';
import type { SubtitleOperationRecord } from '@/server/subtitles/jobs';
import { subtitleRepository } from '@/server/subtitles/repository';
import { withCreatorMediaReadAccess } from '@/server/tools/creator-media-access';
import { readStudioProjectMedia } from './conversation-media-generation';

export type StudioCreatorCheckpoint = (quote: StudioCreatorQuote, executor: TransactionQueryExecutor) => Promise<void>;
export type StudioCreatorOptions = {
  enabled: boolean; accountUrl?: string; attachedRefs?: readonly ToolAssetRef[];
  creators?: typeof createCreatorOperationsService; subtitles?: typeof createSubtitleOperationsService;
  documents?: typeof subtitleRepository; readAccess?: typeof withCreatorMediaReadAccess;
  readProjectMedia?: typeof readStudioProjectMedia;
};
const refKey = (ref: ToolAssetRef) => ref.type === 'asset' ? `asset:${ref.kind}:${ref.assetId}` : `output:${ref.kind}:${ref.jobId}:${ref.outputId}`;
function subtitleQuote(operation: SubtitleOperationRecord): StudioCreatorQuote {
  return studioCreatorQuoteSchema.parse({ operationId: operation.id, toolId: 'subtitles', kind: operation.operation_kind,
    price: { amountCents: operation.pricing_snapshot.totalCents, currency: operation.pricing_snapshot.currency },
    expiresAt: new Date(operation.expires_at).toISOString(), confirmationRequired: true,
    ...(operation.request_snapshot.document ? { document: { id: operation.request_snapshot.document.id, revision: operation.request_snapshot.document.revision } } : {}),
  });
}

/** Native Studio adapter. Canonical creator/subtitle owners keep pricing, scope, reservations and recovery. */
export function createStudioCreatorToolsService(actor: StudioGenerationActor, options: StudioCreatorOptions) {
  requireGenerationActor(actor);
  if (actor.authMethod !== 'studio-session') throw new AgentApiError('AUTH_REQUIRED', 'Studio session required.');
  // requestOrigin is an origin; canonical account destinations require this exact path.
  const accountUrl = new URL('/account/connections', options.accountUrl ?? 'https://maxvideoai.com').toString();
  const creators = options.creators ?? createCreatorOperationsService;
  const subtitles = options.subtitles ?? createSubtitleOperationsService;
  const documents = options.documents ?? subtitleRepository;
  const readAccess = options.readAccess ?? withCreatorMediaReadAccess;
  const selector = (value: Pick<StudioCreatorQuote, 'toolId' | 'operationId'>) => {
    const parsed = studioCreatorQuoteSchema.pick({ toolId: true, operationId: true }).parse({toolId:value.toolId,operationId:value.operationId});
    return parsed.toolId === 'subtitles' ? subtitles(actor, { enabled: options.enabled }) : creators(actor, { enabled: options.enabled, generationOptions:{accountUrl} });
  };
  async function assertSources(refs: readonly ToolAssetRef[]) {
    const attached = new Set((options.attachedRefs ?? []).map(refKey));
    if (refs.every(ref => attached.has(refKey(ref)))) return;
    const project = await (options.readProjectMedia ?? readStudioProjectMedia)(actor);
    const known = new Set([...attached, ...project.map(value => refKey(value.ref))]);
    if (refs.some(ref => !known.has(refKey(ref)))) throw new AgentApiError('REFERENCE_INVALID', 'Attach this media or select an exact ready output from this project before preparing a creator tool.');
  }
  function available() {
    if (!options.enabled) throw new AgentApiError('ENGINE_UNAVAILABLE', 'Creator execution is unavailable; existing operations and subtitle documents remain readable.');
  }
  async function prepare(request: StudioCreatorPreparation, checkpoint?: StudioCreatorCheckpoint): Promise<StudioCreatorQuote> {
    available();
    if (request.action === 'creator.subtitle-export.prepare' || request.action === 'creator.studio-subtitles.prepare' || request.toolId === 'subtitles') {
      const service = subtitles(actor, { enabled: options.enabled, onPrepared: checkpoint ? (operation, tx) => checkpoint(subtitleQuote(operation), tx) : undefined });
      let prepared: Awaited<ReturnType<typeof service.prepare>>;
      if (request.action === 'creator.subtitle-export.prepare') prepared = await service.prepareExport({ documentId: request.documentId, revision: request.revision });
      else if (request.action === 'creator.studio-subtitles.prepare') prepared = await service.prepareStudioSubtitles({ projectId: actor.projectId,
        sequenceId: request.sequenceId, expectedRevision: request.expectedRevision, ...(request.language ? { language: request.language } : {}), keyterms: request.keyterms });
      else {
        if (request.inputs.length !== 1 || request.inputs[0].role !== 'source' || !['video','audio'].includes(request.inputs[0].source.kind)
          || request.inputs[0].segment || request.profileId || (request.settings?.length ?? 0) > 0)
          throw new AgentApiError('PARAMETER_INVALID', 'Subtitles needs one complete owned audio/video source and no generation settings.');
        await assertSources(request.inputs.map(input => input.source));
        prepared = await service.prepare({ source: request.inputs[0].source, ...(request.language ? { language: request.language } : {}), keyterms: request.keyterms });
      }
      return studioCreatorQuoteSchema.parse({ operationId: prepared.operationId, toolId: 'subtitles', kind: prepared.kind,
        price: prepared.quote.price, expiresAt: prepared.quote.expiresAt, confirmationRequired: true,
        ...(request.action === 'creator.subtitle-export.prepare' ? { document: { id: request.documentId, revision: request.revision } } : {}),
      });
    }
    await assertSources(request.inputs.map(input => input.source));
    const settings = Object.fromEntries(Object.entries(conversationSelectionSettings(request.settings)).filter(([,value]) => value != null));
    const input = creatorOperationInputSchema.parse({ version: 1, toolId: request.toolId, inputs: request.inputs.map(({segment,...entry}) => ({ ...entry, ...(segment ? {segment} : {}) })),
      settings, ...(request.profileId ? { profileId: request.profileId } : {}) });
    const service = creators(actor, { enabled: options.enabled, generationOptions:{accountUrl}, onPrepared: checkpoint ? (quote, snapshot, tx) => checkpoint(studioCreatorQuoteSchema.parse({
      operationId: quote.quoteId, toolId: snapshot.input.toolId, kind: 'generate', price: { amountCents: quote.priceCents, currency: quote.currency },
      expiresAt: quote.expiresAt.toISOString(), confirmationRequired: true, profileId: snapshot.profile.id, disclosure: snapshot.profile.disclosure,
    }), tx) : undefined });
    const prepared = await service.prepare(input);
    return studioCreatorQuoteSchema.parse({ operationId: prepared.operationId, toolId: input.toolId, kind: 'generate',
      price: { amountCents: prepared.quote.price.amountCents, currency: prepared.quote.price.currency }, expiresAt: prepared.quote.expiresAt,
      confirmationRequired: true, profileId: prepared.operation.profile.id, disclosure: prepared.operation.profile.disclosure });
  }
  async function rawStatus(value: Pick<StudioCreatorQuote, 'toolId' | 'operationId'>): Promise<Record<string, unknown>> {
    const raw = await selector(value).status(value.operationId);
    const current = raw as unknown as Record<string, unknown>;
    if (current.operationId !== value.operationId) throw new AgentApiError('REFERENCE_NOT_FOUND', 'Creator operation unavailable.');
    return current;
  }
  function mediaUrl(value: unknown): string | null {
    if (typeof value !== 'string' || !value) return null;
    try { const url = new URL(value, options.accountUrl ?? 'https://maxvideoai.com'); return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null; } catch { return null; }
  }
  async function view(value: Pick<StudioCreatorQuote, 'toolId' | 'operationId'> & Partial<StudioCreatorQuote>, raw: Record<string, unknown>): Promise<StudioCreatorOperationView> {
    const presented = await readAccess(actor.userId, raw);
    const currentState = String(presented.status ?? presented.state);
    const price = presented.quote && typeof presented.quote === 'object' ? presented.quote as { expiresAt?: string } : null;
    const expired = currentState === 'prepared' && Date.parse(price?.expiresAt ?? value.expiresAt ?? '') <= Date.now();
    const state = expired ? 'expired' : ['prepared','queued','running','finalizing','completed','failed'].includes(currentState) ? currentState : 'unavailable';
    const needsAttention = presented.needsAttention === true || presented.retryable === false;
    const result = state === 'completed' && presented.result && typeof presented.result === 'object' ? presented.result as Record<string,unknown> : null;
    const outputs: NonNullable<StudioCreatorOperationView['result']>['outputs'] = [];
    if (result) {
      const sourceOutputs = Array.isArray(result.outputs) ? result.outputs : result.ref ? [ { ...result, asset: result.ref, kind: 'video' } ] : [];
      for (const output of sourceOutputs) {
        const parsed = toolAssetRefSchema.safeParse(output.asset);
        if (!parsed.success) continue;
        const readUrl = mediaUrl(output.readUrl);
        outputs.push({ ref: parsed.data, kind: parsed.data.kind, readUrl, thumbnailReadUrl: mediaUrl(output.thumbnailReadUrl), artifactDelivery: readUrl ? 'available' : 'unavailable' });
      }
    }
    const doc = result && typeof result.documentId === 'string' && Number.isSafeInteger(result.revision) && Number(result.revision) > 0
      ? { id: result.documentId, revision: Number(result.revision) } : null;
    const resultDocument = doc ? { ...doc, openUrl: `/app/tools/subtitles?document=${encodeURIComponent(doc.id)}&revision=${doc.revision}`,
      srtUrl: `/api/tools/subtitles/documents/${encodeURIComponent(doc.id)}/download?format=srt&revision=${doc.revision}`,
      vttUrl: `/api/tools/subtitles/documents/${encodeURIComponent(doc.id)}/download?format=vtt&revision=${doc.revision}` } : undefined;
    return studioCreatorOperationViewSchema.parse({ operationId: value.operationId, toolId: value.toolId, state,
      confirmationEnabled: options.enabled && state === 'prepared' && !needsAttention, jobId: typeof presented.jobId === 'string' ? presented.jobId : null,
      ...(needsAttention ? { needsAttention: true } : {}), retry: { afterSeconds: needsAttention || ['prepared','expired','completed','failed','unavailable'].includes(state) ? null : 5 },
      ...(typeof presented.error === 'string' ? { error: presented.error.slice(0,600) } : {}),
      result: result ? { ...(resultDocument ? { document: resultDocument } : {}), outputs } : null });
  }
  async function read(value: Pick<StudioCreatorQuote, 'toolId' | 'operationId'> & Partial<StudioCreatorQuote>): Promise<StudioCreatorOperationView> {
    try { return await view(value, await rawStatus(value)); }
    catch { return studioCreatorOperationViewSchema.parse({ operationId: value.operationId, toolId: value.toolId, state: 'unavailable', confirmationEnabled: false,
      jobId: null, retry: { afterSeconds: null }, error: 'This saved creator operation is temporarily unavailable. Recover it before considering another attempt.', result: null }); }
  }
  async function confirm(quote: StudioCreatorQuote, approvedPrice: StudioCreatorQuote['price']): Promise<StudioCreatorOperationView> {
    const saved = studioCreatorQuoteSchema.parse(quote);
    if (approvedPrice.amountCents !== saved.price.amountCents || approvedPrice.currency !== saved.price.currency)
      throw new AgentApiError('PARAMETER_INVALID', 'Review the exact saved creator price before confirming.');
    const current = await rawStatus(saved);
    if ((current.status ?? current.state) !== 'prepared' || current.jobId) return view(saved, current);
    available();
    const accepted = await selector(saved).confirm({ operationId: saved.operationId, confirmed: true });
    return view(saved, accepted as unknown as Record<string,unknown>);
  }
  async function readDocument(input: { documentId: string; revision?: number | null }) {
    const document = await documents.read(actor.userId, input.documentId, input.revision ?? undefined);
    if (!document) throw new AgentApiError('REFERENCE_NOT_FOUND', 'Subtitle document unavailable.');
    return document;
  }
  return { executionEnabled: options.enabled, prepare, read, confirm, readDocument,
    editDocument: (input: { documentId: string; expectedRevision: number; requestId: string; change: unknown }) =>
      documents.update(actor.userId, input.documentId, input.expectedRevision, input.requestId, input.change),
  };
}
export type StudioCreatorTools = ReturnType<typeof createStudioCreatorToolsService>;
export type StudioCreatorFactory = typeof createStudioCreatorToolsService;
