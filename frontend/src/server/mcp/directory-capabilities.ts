import { isMcpOpenaiDirectoryHost } from '@/lib/mcp-host-routing';
import type { McpDistributionProfile } from './distribution-profile';
import type { MaxVideoAiMcpServerOptions } from './server';

const switches = {
  paidGeneration: 'MCP_OPENAI_DIRECTORY_PAID_GENERATION_ENABLED',
  referenceUploads: 'MCP_OPENAI_DIRECTORY_REFERENCE_UPLOADS_ENABLED',
  montagePreparation: 'MCP_OPENAI_DIRECTORY_MONTAGE_PREPARATION_ENABLED',
  audioGeneration: 'MCP_OPENAI_DIRECTORY_AUDIO_GENERATION_ENABLED',
  studioMontageCreation: 'MCP_OPENAI_DIRECTORY_STUDIO_MONTAGE_CREATION_ENABLED',
  studioTimelineEditing: 'MCP_OPENAI_DIRECTORY_STUDIO_TIMELINE_EDITING_ENABLED',
  studioExports: 'MCP_OPENAI_DIRECTORY_STUDIO_EXPORTS_ENABLED',
  creatorTools: 'MCP_OPENAI_DIRECTORY_CREATOR_TOOLS_ENABLED',
  characterStudio: 'MCP_OPENAI_DIRECTORY_CHARACTER_STUDIO_ENABLED',
} as const;

// Called only after request configuration validates the dedicated resource.
// Unset switches preserve the publication defaults; the direct host ignores them.
export function resolveMcpRequestServerOptions(
  requestHost: string | null,
  distributionProfile: McpDistributionProfile,
  env: Readonly<Record<string, string | undefined>>,
  base: MaxVideoAiMcpServerOptions,
): MaxVideoAiMcpServerOptions {
  const options = { ...base, distributionProfile };
  if (distributionProfile !== 'openai-directory' || !requestHost
    || !isMcpOpenaiDirectoryHost(requestHost) || env.MCP_OPENAI_DIRECTORY_ENABLED !== 'true') return options;
  for (const key of Object.keys(switches) as Array<keyof typeof switches>) {
    const value = env[switches[key]];
    if (value === undefined) continue;
    if (value !== 'true' && value !== 'false') throw new Error(`Invalid ${switches[key]}.`);
    options[key] = value === 'true';
  }
  return options;
}
