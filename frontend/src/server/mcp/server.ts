import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import mcpPublication from '@/config/mcp-publication.json';
import { FEATURES } from '@/content/feature-flags';
import {
  createAgentAccountStatusService,
  type AgentAccountStatusWalletDeps,
} from '@/server/agent-api/account-status';
import { listAgentModels } from '@/server/agent-api/model-catalog';
import {
  listAgentMedia,
  type AgentMediaPage,
  type ListAgentMediaInput,
} from '@/server/agent-api/media-library';
import { recommendAgentModels } from '@/server/agent-api/model-recommendations';
import {
  createConfirmGenerationService,
  type ConfirmGenerationInput,
} from '@/server/agent-api/confirm-generation';
import {
  createPrepareGenerationService,
  type PreparedGeneration,
  type PrepareGenerationInput,
  type TrialRiskRequestContext,
} from '@/server/agent-api/prepare-generation';
import {
  getAgentGenerationStatus,
  listAgentRecentGenerations,
  type AgentGenerationRecovery,
  type AgentGenerationRecoveryPage,
  type GetAgentGenerationStatusInput,
  type ListAgentRecentGenerationsInput,
} from '@/server/agent-api/generation-status';
import type { AgentPrincipal } from '@/server/agent-api/principal';
import {
  createMcpTopupHandoffService,
  type McpTopupHandoffDependencies,
  type McpTopupHandoffResult,
} from '@/server/agent-api/topup-handoff';
import type {
  AgentAccountStatus,
  AgentModel,
  AgentModelFilter,
  AgentModelRecommendationInput,
  AgentModelRecommendationResult,
} from '@/server/agent-api/types';
import type { McpConfig } from '@/server/mcp/config';
import { MAXVIDEOAI_MCP_INSTRUCTIONS } from '@/server/mcp/instructions';
import { registerGetAccountStatusTool } from '@/server/mcp/tools/get-account-status';
import { registerConfirmGenerationTool } from '@/server/mcp/tools/confirm-generation';
import { registerCreateTopupLinkTool } from '@/server/mcp/tools/create-topup-link';
import { registerGetGenerationStatusTool } from '@/server/mcp/tools/get-generation-status';
import { registerListModelsTool } from '@/server/mcp/tools/list-models';
import { registerListMediaTool } from '@/server/mcp/tools/list-media';
import { registerListRecentGenerationsTool } from '@/server/mcp/tools/list-recent-generations';
import { registerPrepareGenerationTool } from '@/server/mcp/tools/prepare-generation';
import { registerRecommendModelsTool } from '@/server/mcp/tools/recommend-models';

export type MaxVideoAiMcpServices = {
  getAccountStatus(principal: AgentPrincipal): Promise<AgentAccountStatus>;
  listModels(filter: AgentModelFilter, principal: AgentPrincipal): Promise<AgentModel[]>;
  recommendModels(
    input: AgentModelRecommendationInput,
    principal: AgentPrincipal
  ): Promise<AgentModelRecommendationResult>;
  prepareGeneration?(
    input: PrepareGenerationInput,
    principal: AgentPrincipal,
  ): Promise<PreparedGeneration>;
  confirmGeneration?(
    input: ConfirmGenerationInput,
    principal: AgentPrincipal,
  ): Promise<import('@/server/generations/generation-status').AgentGenerationStatus>;
  getGenerationStatus?(
    input: GetAgentGenerationStatusInput,
    principal: AgentPrincipal,
  ): Promise<AgentGenerationRecovery>;
  listRecentGenerations?(
    input: ListAgentRecentGenerationsInput,
    principal: AgentPrincipal,
  ): Promise<AgentGenerationRecoveryPage>;
  createTopupLink?(
    input: { quoteId: string },
    principal: AgentPrincipal,
  ): Promise<McpTopupHandoffResult>;
  listMedia?(
    input: ListAgentMediaInput,
    principal: AgentPrincipal,
  ): Promise<AgentMediaPage>;
};

export type MaxVideoAiMcpServerOptions = {
  paidGeneration?: boolean;
  referenceUploads?: boolean;
};

export function createDefaultMaxVideoAiMcpServices(
  config: McpConfig,
  trialRiskContext: TrialRiskRequestContext,
  accountStatusDeps?: AgentAccountStatusWalletDeps,
  topupHandoffDeps?: Partial<Omit<McpTopupHandoffDependencies, 'billingBaseUrl'>>,
): MaxVideoAiMcpServices {
  return {
    getAccountStatus: createAgentAccountStatusService(config.accountUrl, accountStatusDeps),
    listModels: (filter) => listAgentModels(filter),
    recommendModels: (input) => recommendAgentModels(input),
    prepareGeneration: createPrepareGenerationService(config.accountUrl, trialRiskContext),
    confirmGeneration: createConfirmGenerationService(config.accountUrl, trialRiskContext),
    getGenerationStatus: (input, principal) => getAgentGenerationStatus(input, principal),
    listRecentGenerations: (input, principal) => listAgentRecentGenerations(input, principal),
    createTopupLink: createMcpTopupHandoffService({
      billingBaseUrl: new URL(config.accountUrl).origin,
      ...topupHandoffDeps,
    }),
    listMedia: (input, principal) => listAgentMedia(input, principal),
  };
}

export function createMaxVideoAiMcpServer(
  principal: AgentPrincipal,
  services: MaxVideoAiMcpServices,
  options: MaxVideoAiMcpServerOptions = {},
): McpServer {
  const server = new McpServer(
    {
      name: 'maxvideoai',
      version: '0.1.0',
      websiteUrl: 'https://maxvideoai.com/mcp',
    },
    {
      instructions: MAXVIDEOAI_MCP_INSTRUCTIONS,
      capabilities: { tools: {} },
    }
  );

  registerGetAccountStatusTool(server, principal, services);
  registerListModelsTool(server, principal, services);
  registerRecommendModelsTool(server, principal, services);
  if (options.referenceUploads ?? FEATURES.mcp.referenceUploads) {
    registerListMediaTool(server, principal, services);
  }
  if (options.paidGeneration ?? mcpPublication.paidGeneration) {
    registerPrepareGenerationTool(server, principal, services);
    registerConfirmGenerationTool(server, principal, services);
    registerGetGenerationStatusTool(server, principal, services);
    registerListRecentGenerationsTool(server, principal, services);
    registerCreateTopupLinkTool(server, principal, services);
  }
  return server;
}
