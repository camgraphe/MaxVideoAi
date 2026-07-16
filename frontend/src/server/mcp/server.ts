import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import mcpPublication from '@/config/mcp-publication.json';
import {
  createAgentAccountStatusService,
  type AgentAccountStatusWalletDeps,
} from '@/server/agent-api/account-status';
import { listAgentModels } from '@/server/agent-api/model-catalog';
import { recommendAgentModels } from '@/server/agent-api/model-recommendations';
import {
  createConfirmGenerationService,
  type ConfirmGenerationInput,
} from '@/server/agent-api/confirm-generation';
import {
  createPrepareGenerationService,
  type PreparedGeneration,
  type PrepareGenerationInput,
} from '@/server/agent-api/prepare-generation';
import type { AgentPrincipal } from '@/server/agent-api/principal';
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
import { registerListModelsTool } from '@/server/mcp/tools/list-models';
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
};

export type MaxVideoAiMcpServerOptions = {
  paidGeneration?: boolean;
};

export function createDefaultMaxVideoAiMcpServices(
  config: McpConfig,
  accountStatusDeps?: AgentAccountStatusWalletDeps
): MaxVideoAiMcpServices {
  return {
    getAccountStatus: createAgentAccountStatusService(config.accountUrl, accountStatusDeps),
    listModels: (filter) => listAgentModels(filter),
    recommendModels: (input) => recommendAgentModels(input),
    prepareGeneration: createPrepareGenerationService(config.accountUrl),
    confirmGeneration: createConfirmGenerationService(config.accountUrl),
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
  if (options.paidGeneration ?? mcpPublication.paidGeneration) {
    registerPrepareGenerationTool(server, principal, services);
    registerConfirmGenerationTool(server, principal, services);
  }
  return server;
}
