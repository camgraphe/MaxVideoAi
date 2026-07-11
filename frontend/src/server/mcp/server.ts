import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import {
  createAgentAccountStatusService,
  type AgentAccountStatusWalletDeps,
} from '@/server/agent-api/account-status';
import { listAgentModels } from '@/server/agent-api/model-catalog';
import { recommendAgentModels } from '@/server/agent-api/model-recommendations';
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
import { registerListModelsTool } from '@/server/mcp/tools/list-models';
import { registerRecommendModelsTool } from '@/server/mcp/tools/recommend-models';

export type MaxVideoAiMcpServices = {
  getAccountStatus(principal: AgentPrincipal): Promise<AgentAccountStatus>;
  listModels(filter: AgentModelFilter, principal: AgentPrincipal): Promise<AgentModel[]>;
  recommendModels(
    input: AgentModelRecommendationInput,
    principal: AgentPrincipal
  ): Promise<AgentModelRecommendationResult>;
};

export function createDefaultMaxVideoAiMcpServices(
  config: McpConfig,
  accountStatusDeps?: AgentAccountStatusWalletDeps
): MaxVideoAiMcpServices {
  return {
    getAccountStatus: createAgentAccountStatusService(config.accountUrl, accountStatusDeps),
    listModels: (filter) => listAgentModels(filter),
    recommendModels: (input) => recommendAgentModels(input),
  };
}

export function createMaxVideoAiMcpServer(
  principal: AgentPrincipal,
  services: MaxVideoAiMcpServices
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
  return server;
}
