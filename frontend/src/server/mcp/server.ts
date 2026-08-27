import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import mcpPublication from '@/config/mcp-publication.json';
import { FEATURES } from '@/content/feature-flags';
import {
  createAgentAccountStatusService,
  type AgentAccountStatusWalletDeps,
} from '@/server/agent-api/account-status';
import {
  createAgentModelCatalogDeps,
  listAgentModels,
  listPublicAgentGenerationEngines,
  listPublicAgentGenerationEnginesInExecutor,
} from '@/server/agent-api/model-catalog';
import { getAgentModelDetails } from '@/server/agent-api/model-details';
import {
  listAgentMedia,
  type AgentMediaPage,
  type ListAgentMediaInput,
} from '@/server/agent-api/media-library';
import {
  createDefaultReferenceUploadLinkService,
  type ReferenceUploadLink,
} from '@/server/agent-api/create-reference-upload-link';
import { recommendAgentModels } from '@/server/agent-api/model-recommendations';
import {
  calculateAgentProjectBudget,
  createAgentProjectBudgetDependencies,
  type AgentProjectBudgetInput,
  type AgentProjectBudgetResult,
} from '@/server/agent-api/project-budget';
import {
  createConfirmGenerationService,
  type ConfirmGenerationInput,
} from '@/server/agent-api/confirm-generation';
import { submitReservedPaidGeneration } from '@/server/agent-api/paid-generation-execution';
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
  type AgentGenerationDownload,
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
  AgentModelDetails,
  AgentModelFilter,
  AgentModelRecommendationInput,
  AgentModelRecommendationResult,
} from '@/server/agent-api/types';
import type { McpConfig } from '@/server/mcp/config';
import { buildMaxVideoAiMcpInstructions } from '@/server/mcp/instructions';
import { registerGenerationResultApp } from '@/server/mcp/generation-result-app';
import type { McpRuntimeCapabilities } from '@/server/mcp/operational-access';
import { resolveMcpStagingCanaryGenerationEnvironment } from '@/server/mcp/provider-canary-access';
import { resolveAgentGenerationRequestExecutability } from '@/server/agent-runtime/model-executability';
import { registerGetAccountStatusTool } from '@/server/mcp/tools/get-account-status';
import { registerConfirmGenerationTool } from '@/server/mcp/tools/confirm-generation';
import { registerCreateTopupLinkTool } from '@/server/mcp/tools/create-topup-link';
import { registerCreateReferenceUploadLinkTool } from '@/server/mcp/tools/create-reference-upload-link';
import { registerGetGenerationStatusTool } from '@/server/mcp/tools/get-generation-status';
import { registerListModelsTool } from '@/server/mcp/tools/list-models';
import { registerGetModelDetailsTool } from '@/server/mcp/tools/get-model-details';
import { registerListMediaTool } from '@/server/mcp/tools/list-media';
import { registerListRecentGenerationsTool } from '@/server/mcp/tools/list-recent-generations';
import { registerPrepareGenerationTool } from '@/server/mcp/tools/prepare-generation';
import { registerPresentGenerationTool } from '@/server/mcp/tools/present-generation';
import { registerRecommendModelsTool } from '@/server/mcp/tools/recommend-models';
import { registerCalculateProjectBudgetTool } from '@/server/mcp/tools/calculate-project-budget';

export type MaxVideoAiMcpServices = {
  getAccountStatus(principal: AgentPrincipal): Promise<AgentAccountStatus>;
  listModels(filter: AgentModelFilter, principal: AgentPrincipal): Promise<AgentModel[]>;
  getModelDetails(engineId: string, principal: AgentPrincipal): Promise<AgentModelDetails>;
  recommendModels(
    input: AgentModelRecommendationInput,
    principal: AgentPrincipal
  ): Promise<AgentModelRecommendationResult>;
  calculateProjectBudget?(
    input: AgentProjectBudgetInput,
    principal: AgentPrincipal,
  ): Promise<AgentProjectBudgetResult>;
  prepareGeneration?(
    input: PrepareGenerationInput,
    principal: AgentPrincipal,
  ): Promise<PreparedGeneration>;
  confirmGeneration?(
    input: ConfirmGenerationInput,
    principal: AgentPrincipal,
  ): Promise<AgentGenerationRecovery>;
  getGenerationStatus?(
    input: GetAgentGenerationStatusInput,
    principal: AgentPrincipal,
  ): Promise<AgentGenerationRecovery>;
  createGenerationDownload?(
    recovery: AgentGenerationRecovery,
    principal: AgentPrincipal,
  ): Promise<AgentGenerationDownload | null>;
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
  createReferenceUploadLink?(
    input: import('@/server/agent-api/create-reference-upload-link').CreateReferenceUploadLinkInput,
    principal: AgentPrincipal,
  ): Promise<ReferenceUploadLink>;
};

export type MaxVideoAiMcpServerOptions = {
  paidGeneration?: boolean;
  referenceUploads?: boolean;
};

export function createDefaultMaxVideoAiMcpServices(
  config: McpConfig,
  trialRiskContext: TrialRiskRequestContext,
  capabilities: McpRuntimeCapabilities,
  accountStatusDeps?: AgentAccountStatusWalletDeps,
  topupHandoffDeps?: Partial<Omit<McpTopupHandoffDependencies, 'billingBaseUrl'>>,
  runtimeEnv: NodeJS.ProcessEnv = process.env,
): MaxVideoAiMcpServices {
  const generationEnvironmentFor = (principal: AgentPrincipal) =>
    resolveMcpStagingCanaryGenerationEnvironment(principal, config.accountUrl, runtimeEnv);
  const catalogDepsFor = (principal: AgentPrincipal) =>
    createAgentModelCatalogDeps(generationEnvironmentFor(principal));
  return {
    getAccountStatus: createAgentAccountStatusService(config.accountUrl, accountStatusDeps),
    listModels: (filter, principal) => listAgentModels(filter, catalogDepsFor(principal)),
    getModelDetails: (engineId, principal) => getAgentModelDetails(engineId, catalogDepsFor(principal)),
    recommendModels: (input, principal) => recommendAgentModels(input, catalogDepsFor(principal)),
    calculateProjectBudget: (input, principal) => calculateAgentProjectBudget(
      input,
      principal,
      createAgentProjectBudgetDependencies(catalogDepsFor(principal)),
    ),
    prepareGeneration: (input, principal) => createPrepareGenerationService(
      config.accountUrl,
      trialRiskContext,
      {
        paidGenerationEnabled: () => capabilities.paidGeneration,
        listPublicEngines: () => listPublicAgentGenerationEngines(catalogDepsFor(principal)),
        resolveRequestExecutability: (request, candidate, resolvedReferences) =>
          resolveAgentGenerationRequestExecutability(
            request,
            candidate.engine,
            resolvedReferences,
            generationEnvironmentFor(principal),
          ),
      },
    )(input, principal),
    confirmGeneration: (input, principal) => createConfirmGenerationService(
      config.accountUrl,
      trialRiskContext,
      {
        paidGenerationEnabled: () => capabilities.paidGeneration,
        listPublicEngines: ({ executor }) => listPublicAgentGenerationEnginesInExecutor(
          executor,
          generationEnvironmentFor(principal),
        ),
        resolveRequestExecutability: (request, candidate, resolvedReferences) =>
          resolveAgentGenerationRequestExecutability(
            request,
            candidate.engine,
            resolvedReferences,
            generationEnvironmentFor(principal),
          ),
        submitPaidGeneration: (execution) => submitReservedPaidGeneration(
          execution,
          undefined,
          { providerEnv: generationEnvironmentFor(principal).providerEnv },
        ),
      },
    )(input, principal),
    getGenerationStatus: (input, principal) => getAgentGenerationStatus(input, principal, {
      accountUrl: config.accountUrl,
    }),
    listRecentGenerations: (input, principal) => listAgentRecentGenerations(input, principal, {
      accountUrl: config.accountUrl,
    }),
    createTopupLink: createMcpTopupHandoffService({
      billingBaseUrl: new URL(config.accountUrl).origin,
      ...topupHandoffDeps,
    }),
    listMedia: (input, principal) => listAgentMedia(input, principal),
    createReferenceUploadLink: createDefaultReferenceUploadLinkService(config.accountUrl),
  };
}

export function createMaxVideoAiMcpServer(
  principal: AgentPrincipal,
  services: MaxVideoAiMcpServices,
  options: MaxVideoAiMcpServerOptions = {},
): McpServer {
  const referenceUploads = options.referenceUploads ?? FEATURES.mcp.referenceUploads;
  const paidGeneration = options.paidGeneration ?? mcpPublication.paidGeneration;
  const server = new McpServer(
    {
      name: 'maxvideoai',
      version: '0.1.0',
      websiteUrl: 'https://maxvideoai.com/mcp',
    },
    {
      instructions: buildMaxVideoAiMcpInstructions({ paidGeneration, referenceUploads }),
      capabilities: { tools: {} },
    }
  );

  registerGetAccountStatusTool(server, principal, services);
  registerListModelsTool(server, principal, services);
  registerGetModelDetailsTool(server, principal, services);
  registerRecommendModelsTool(server, principal, services);
  registerCalculateProjectBudgetTool(server, principal, services);
  if (referenceUploads) {
    registerListMediaTool(server, principal, services);
    registerCreateReferenceUploadLinkTool(server, principal, services);
  }
  if (paidGeneration) {
    registerGenerationResultApp(server);
    registerPrepareGenerationTool(server, principal, services);
    registerConfirmGenerationTool(server, principal, services);
    registerGetGenerationStatusTool(server, principal, services);
    registerListRecentGenerationsTool(server, principal, services);
    registerPresentGenerationTool(server, principal, services);
    registerCreateTopupLinkTool(server, principal, services);
  }
  return server;
}
