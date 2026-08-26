import { calculateProjectBudgetInputSchema } from '@/server/mcp/tools/calculate-project-budget';
import { confirmGenerationInputSchema } from '@/server/mcp/tools/confirm-generation';
import { createReferenceUploadLinkInputSchema } from '@/server/mcp/tools/create-reference-upload-link';
import { createTopupLinkInputSchema } from '@/server/mcp/tools/create-topup-link';
import { getAccountStatusInputSchema } from '@/server/mcp/tools/get-account-status';
import { getGenerationStatusInputSchema } from '@/server/mcp/tools/get-generation-status';
import { getModelDetailsInputSchema } from '@/server/mcp/tools/get-model-details';
import { listMediaInputSchema } from '@/server/mcp/tools/list-media';
import { listModelsInputSchema } from '@/server/mcp/tools/list-models';
import { listRecentGenerationsInputSchema } from '@/server/mcp/tools/list-recent-generations';
import { prepareGenerationInputSchema } from '@/server/mcp/tools/prepare-generation';
import { recommendModelsInputSchema } from '@/server/mcp/tools/recommend-models';

export const MCP_TOOL_INPUT_SCHEMAS = {
  get_account_status: getAccountStatusInputSchema,
  list_models: listModelsInputSchema,
  get_model_details: getModelDetailsInputSchema,
  recommend_models: recommendModelsInputSchema,
  calculate_project_budget: calculateProjectBudgetInputSchema,
  list_media: listMediaInputSchema,
  create_reference_upload_link: createReferenceUploadLinkInputSchema,
  prepare_generation: prepareGenerationInputSchema,
  confirm_generation: confirmGenerationInputSchema,
  get_generation_status: getGenerationStatusInputSchema,
  list_recent_generations: listRecentGenerationsInputSchema,
  present_generation: getGenerationStatusInputSchema,
  create_topup_link: createTopupLinkInputSchema,
} as const;

export type McpToolInputSchemaName = keyof typeof MCP_TOOL_INPUT_SCHEMAS;
