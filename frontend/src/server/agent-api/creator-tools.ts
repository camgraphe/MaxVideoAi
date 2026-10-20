import { z } from 'zod';
import type { AgentPrincipal } from './principal';
import { AgentApiError } from './errors';
import { getActiveAccountRestriction } from '@/server/fraud-cleanup';
import { createCreatorOperationsService } from '@/server/tools/creator-operations';
import { listCreatorToolProfiles } from '@/server/tools/creator-profiles';
import { createSubtitleOperationsService } from '@/server/subtitles/operations';
import { subtitleRepository } from '@/server/subtitles/repository';
import { serializeSubtitles } from '@/lib/subtitles/serialize';
import { CREATOR_TOOL_IDS, type CreatorToolId } from '@/lib/toolbox/creator-availability';
import { withCreatorMediaReadAccess } from '@/server/tools/creator-media-access';

export type CreatorMcpServices = {
  list(principal: AgentPrincipal): Promise<object>;
  prepare(input: unknown, principal: AgentPrincipal): Promise<object>;
  confirm(input: { toolId: CreatorToolId; operationId: string; confirmed: true }, principal: AgentPrincipal): Promise<object>;
  status(input: { toolId: CreatorToolId; operationId: string }, principal: AgentPrincipal): Promise<object>;
  readDocument(input: { documentId: string; revision?: number }, principal: AgentPrincipal): Promise<object>;
  editDocument(input: { documentId: string; expectedRevision: number; requestId: string; change: unknown }, principal: AgentPrincipal): Promise<object>;
  prepareExport(input: { documentId: string; revision: number }, principal: AgentPrincipal): Promise<object>;
  prepareStudio(input: { projectId: string; sequenceId: string; expectedRevision: number; language?: string; keyterms?: string[] }, principal: AgentPrincipal): Promise<object>;
  exportText(input: { documentId: string; revision: number; format: 'srt' | 'vtt' }, principal: AgentPrincipal): Promise<object>;
};
export function asCreatorAgentError(error: unknown): AgentApiError {
  if (error instanceof AgentApiError) return error;
  const code = error instanceof Error ? error.message : '';
  if (code === 'INSUFFICIENT_FUNDS') return new AgentApiError('INSUFFICIENT_FUNDS', 'Add funds before confirming this quote.');
  if (code.endsWith('_NOT_FOUND')) return new AgentApiError('REFERENCE_NOT_FOUND', 'This operation or document is unavailable to this account and client.');
  if (code.includes('CONFLICT') || code.includes('EXPIRED') || code.includes('SOURCE_CHANGED')) return new AgentApiError('QUOTE_EXPIRED', 'The revision or source changed. Read its current state and prepare a new quote if needed.');
  if (code.includes('UNAVAILABLE') || code.startsWith('MISSING_')) return new AgentApiError('ENGINE_UNAVAILABLE', 'This tool is currently unavailable.');
  return new AgentApiError('PARAMETER_INVALID', 'Check the selected media, duration, settings and document revision.');
}
export function createAgentCreatorToolsService(options: { enabled: boolean }): CreatorMcpServices {
  const creators = (principal: AgentPrincipal) => createCreatorOperationsService(principal, options);
  const subtitles = (principal: AgentPrincipal) => createSubtitleOperationsService(principal, options);
  async function authorize(principal: AgentPrincipal) {
    if (!options.enabled) throw new AgentApiError('ENGINE_UNAVAILABLE', 'Creator tools are currently unavailable.');
    if (!principal.emailVerified) throw new AgentApiError('EMAIL_VERIFICATION_REQUIRED', 'Verify your email before using paid tools.');
    if (await getActiveAccountRestriction(principal.userId)) throw new AgentApiError('ACCOUNT_RESTRICTED', 'This account cannot run paid tools.');
  }
  async function readDocument(input: { documentId: string; revision?: number }, principal: AgentPrincipal) {
    const document = await subtitleRepository.read(principal.userId, input.documentId, input.revision);
    if (!document) throw new AgentApiError('REFERENCE_NOT_FOUND', 'Subtitle document unavailable.');
    return document;
  }
  return {
    async list() {
      return { tools: CREATOR_TOOL_IDS.map(id => ({ id, source: id === 'subtitles' ? ['audio', 'video']
        : id === 'lip-sync' ? ['image+audio', 'video+audio'] : id === 'motion-transfer' ? ['image+video'] : [id === 'product-photo-editor' ? 'image' : 'video'],
        profiles: id === 'subtitles' ? [{ id: 'scribe-v2', editing: 'text, timing and style; no new transcription', exports: ['srt', 'vtt', 'mp4 from video source'] }]
          : listCreatorToolProfiles(options).filter(profile => profile.toolId === id),
      })), requiresExactQuoteApproval: true, statusPolling: 'Follow retry.afterSeconds; null ends automatic polling.' };
    },
    async prepare(value, principal) {
      await authorize(principal);
      const input = z.object({ toolId: z.enum(CREATOR_TOOL_IDS) }).passthrough().parse(value);
      if (input.toolId === 'subtitles') {
        const { toolId, ...request } = input;
        return { toolId, ...await subtitles(principal).prepare(request) };
      }
      return creators(principal).prepare(input);
    },
    async confirm(input, principal) {
      await authorize(principal);
      const result = await (input.toolId === 'subtitles' ? subtitles(principal) : creators(principal)).confirm({ operationId: input.operationId, confirmed: input.confirmed });
      return withRetry(await withCreatorMediaReadAccess(principal.userId, result));
    },
    async status(input, principal) {
      return withRetry(await withCreatorMediaReadAccess(principal.userId, await (input.toolId === 'subtitles' ? subtitles(principal) : creators(principal)).status(input.operationId)));
    },
    async readDocument(input, principal) { return { document: await readDocument(input, principal) }; },
    async editDocument(input, principal) {
      return { document: await subtitleRepository.update(principal.userId, input.documentId, input.expectedRevision, input.requestId, input.change) };
    },
    async prepareExport(input, principal) { await authorize(principal); return { toolId: 'subtitles', ...await subtitles(principal).prepareExport(input) }; },
    async prepareStudio(input, principal) { await authorize(principal); return { toolId: 'subtitles', ...await subtitles(principal).prepareStudioSubtitles(input) }; },
    async exportText(input, principal) {
      const document = await readDocument(input, principal);
      return { documentId: document.id, revision: document.revision, format: input.format,
        filename: `subtitles-r${document.revision}.${input.format}`, text: serializeSubtitles(document, input.format) };
    },
  };
}
function withRetry<T extends object>(result: T) {
  const data = result as Record<string, unknown>;
  const state = data.status ?? data.state;
  return { ...result, retry: { afterSeconds: data.needsAttention === true || data.retryable === false
    || ['prepared', 'completed', 'failed'].includes(String(state)) ? null : 5 } };
}
