import { isMcpOpenaiDirectoryHost } from '@/lib/mcp-host-routing';
import { isMcpOpenaiDirectoryEligible, resolveMcpConfig, type McpConfig } from '@/server/mcp/config';

export type McpDistributionProfile = 'direct' | 'openai-directory';

// Request config first checks that the resource is enabled and allowed. In
// dual-channel mode the exact host fixes the profile, regardless of client
// family, tool arguments or the legacy single-endpoint profile variable.
export function resolveMcpDistributionProfile(
  env: Readonly<Record<string, string | undefined>> = process.env,
  requestHost?: string | null,
  primaryConfig?: McpConfig,
): McpDistributionProfile {
  if (requestHost && isMcpOpenaiDirectoryHost(requestHost)) return 'openai-directory';
  if (requestHost && env.MCP_OPENAI_DIRECTORY_ENABLED === 'true'
    && isMcpOpenaiDirectoryEligible(env, primaryConfig ?? resolveMcpConfig(env))) return 'direct';
  const value = env.MCP_DISTRIBUTION_PROFILE?.trim() || 'direct';
  if (value !== 'direct' && value !== 'openai-directory') {
    throw new Error('Unsupported MCP_DISTRIBUTION_PROFILE.');
  }
  return value;
}

export type McpToolResultPolicy = {
  profile: McpDistributionProfile;
  tool: 'get_account_status' | 'get_model_details' | 'prepare_generation' | 'confirm_generation'
    | 'prepare_audio_generation' | 'confirm_audio_generation'
    | 'prepare_studio_export' | 'confirm_studio_export' | 'get_studio_export'
    | 'list_creator_tools' | 'prepare_creator_tool' | 'confirm_creator_tool' | 'get_creator_tool_operation'
    | 'list_saved_characters' | 'get_saved_character' | 'save_character' | 'select_saved_character'
    | 'prepare_recast' | 'confirm_recast' | 'get_recast_quote' | 'get_recast_status'
    | 'get_subtitle_document' | 'edit_subtitle_document' | 'prepare_subtitle_export' | 'prepare_studio_subtitles' | 'export_subtitle_text';
};

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// An explicit distribution contract, not a response-size optimization. Domain
// services retain their full data, ownership checks and payment behavior.
export function projectMcpToolResult(value: object, policy?: McpToolResultPolicy): object {
  if (policy?.profile !== 'openai-directory') return value;
  const result = value as Record<string, unknown>;
  if (record(result.error) && result.error.code === 'INSUFFICIENT_FUNDS') {
    return {
      ...result,
      error: {
        ...result.error,
        message: 'The connected account has insufficient existing entitlements for this operation. No paid operation was submitted.',
        retryable: false,
        nextAction: null,
      },
    };
  }
  if (policy.tool === 'get_account_status') {
    const account = { ...result };
    delete account.accountId;
    delete account.clientId;
    if (record(account.destinations)) {
      const destinations = { ...account.destinations };
      delete destinations.billing;
      return { ...account, destinations };
    }
    return account;
  }
  return value;
}
