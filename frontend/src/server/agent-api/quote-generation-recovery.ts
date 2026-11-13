import { buildOwnedGenerationMediaAccess } from '@/server/generations/generation-media-access';
import type { AgentGenerationStatus } from '@/server/generations/generation-status';
import { createMcpMediaLink, primaryGenerationMediaUrl } from '@/server/mcp/media-link';
import { buildAgentGenerationRecovery } from './generation-status';
import type { AgentPrincipal } from './principal';

/** Presentation only: the calling quote owner has already read and scoped the job. */
export async function buildQuoteGenerationRecovery<TTool extends 'get_character_builder_status' | 'get_recast_status'>(
  status: AgentGenerationStatus | null,
  quoteId: string,
  statusTool: TTool,
  principal: AgentPrincipal,
  accountUrl: string,
) {
  if (!status) return { quoteId, jobId: null, status: 'no_job' as const, retry: null };
  const accessible = await buildOwnedGenerationMediaAccess(principal.userId, status);
  const recovery = buildAgentGenerationRecovery(accessible!, accountUrl);
  const url = recovery.status === 'completed' ? primaryGenerationMediaUrl(recovery.result) : null;
  const openUrl = url && createMcpMediaLink({
    principal, origin: recovery.library.url,
    source: { type: 'generation', jobId: recovery.jobId }, url,
  });
  return {
    ...recovery,
    ...(openUrl ? { openUrl } : {}),
    quoteId,
    retry: recovery.retry && {
      tool: statusTool, arguments: { quoteId }, afterSeconds: recovery.retry.afterSeconds,
    },
  };
}
