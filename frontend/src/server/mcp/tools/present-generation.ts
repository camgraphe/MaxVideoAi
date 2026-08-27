import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import {
  createSignedDownloadUrl,
  extractStorageKeyFromUrl,
} from '@/server/storage';
import { buildGenerationResourceLinks } from '@/server/agent-api/generation-status';
import type {
  AgentGenerationDownload,
  AgentGenerationRecovery,
} from '@/server/agent-api/generation-status';
import type { AgentPrincipal } from '@/server/agent-api/principal';
import { GENERATION_RESULT_APP_URI } from '@/server/mcp/generation-result-app';
import type { MaxVideoAiMcpServices } from '@/server/mcp/server';
import { runAgentToolWithResourceLinks } from '@/server/mcp/tool-result';
import { getGenerationStatusInputSchema } from '@/server/mcp/tools/get-generation-status';

const DOWNLOAD_TTL_SECONDS = 60 * 60;

type GenerationDownloadDependencies = {
  now?: () => Date;
  extractStorageKeyFromUrl?: typeof extractStorageKeyFromUrl;
  createSignedDownloadUrl?: typeof createSignedDownloadUrl;
};

function primaryOutputUrl(recovery: AgentGenerationRecovery): string | null {
  if (recovery.status !== 'completed' || !recovery.result) return null;
  return recovery.result.surface === 'video'
    ? recovery.result.videoUrl
    : recovery.result.imageUrls[0] ?? null;
}

function generationDownloadFilename(recovery: AgentGenerationRecovery, mediaUrl: string): string {
  const safeJobId = recovery.jobId
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 96) || 'generation';
  let extension = recovery.surface === 'video' ? 'mp4' : 'jpg';
  try {
    const match = new URL(mediaUrl).pathname.match(/\.([a-z0-9]{2,5})$/i);
    if (match?.[1]) extension = match[1].toLowerCase();
  } catch {
    // The recovery service has already bounded public result URLs.
  }
  return `maxvideoai-${safeJobId}.${extension}`;
}

export async function createGenerationDownloadDescriptor(
  recovery: AgentGenerationRecovery,
  dependencies: GenerationDownloadDependencies = {},
): Promise<AgentGenerationDownload | null> {
  const mediaUrl = primaryOutputUrl(recovery);
  if (!mediaUrl) return null;
  const extractKey = dependencies.extractStorageKeyFromUrl ?? extractStorageKeyFromUrl;
  const storageKey = extractKey(mediaUrl);
  if (!storageKey) return null;

  const filename = generationDownloadFilename(recovery, mediaUrl);
  const signDownload = dependencies.createSignedDownloadUrl ?? createSignedDownloadUrl;
  const url = await signDownload(storageKey, {
    expiresInSeconds: DOWNLOAD_TTL_SECONDS,
    downloadFilename: filename,
  });
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.hash) return null;
  const now = dependencies.now?.() ?? new Date();
  return {
    url: parsed.toString(),
    filename,
    expiresAt: new Date(now.getTime() + DOWNLOAD_TTL_SECONDS * 1000).toISOString(),
  };
}

export function registerPresentGenerationTool(
  server: McpServer,
  principal: AgentPrincipal,
  services: MaxVideoAiMcpServices,
): void {
  if (!services.getGenerationStatus) {
    throw new Error('get_generation_status service is required when present_generation is enabled.');
  }
  server.registerTool(
    'present_generation',
    {
      title: 'Present a MaxVideoAI generation',
      description:
        'Use this when a completed owned MaxVideoAI generation should be shown inline as a playable video or image result. Call get_generation_status or list_recent_generations first; do not use this to poll, generate, retry, or charge credits.',
      inputSchema: getGenerationStatusInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: {
        ui: { resourceUri: GENERATION_RESULT_APP_URI },
        'ui/resourceUri': GENERATION_RESULT_APP_URI,
        'openai/outputTemplate': GENERATION_RESULT_APP_URI,
        'openai/toolInvocation/invoking': 'Loading generation…',
        'openai/toolInvocation/invoked': 'Generation ready',
      },
    },
    async (input) => runAgentToolWithResourceLinks(
      async () => {
        const recovery = await services.getGenerationStatus!(input, principal);
        let download: AgentGenerationDownload | null = null;
        try {
          download = services.createGenerationDownload
            ? await services.createGenerationDownload(recovery, principal)
            : await createGenerationDownloadDescriptor(recovery);
        } catch {
          console.error('[mcp] failed to prepare a direct generation download', {
            jobId: recovery.jobId,
          });
        }
        return { ...recovery, download };
      },
      buildGenerationResourceLinks,
    ),
  );
}
