import { calculateProjectBudgetInputSchema } from '@/server/mcp/tools/calculate-project-budget';
import {compareGenerationPricesInputSchema} from '@/server/mcp/tools/compare-generation-prices';
import { confirmGenerationInputSchema } from '@/server/mcp/tools/confirm-generation';
import { createReferenceUploadLinkInputSchema } from '@/server/mcp/tools/create-reference-upload-link';
import { createTopupLinkInputSchema } from '@/server/mcp/tools/create-topup-link';
import { createStudioMontageToolInputSchema } from '@/server/mcp/tools/create-studio-montage';
import { getAccountStatusInputSchema } from '@/server/mcp/tools/get-account-status';
import { getGenerationStatusInputSchema } from '@/server/mcp/tools/get-generation-status';
import { getModelDetailsInputSchema } from '@/server/mcp/tools/get-model-details';
import { importReferenceFilesInputSchema } from '@/server/mcp/tools/import-reference-files';
import { listMediaInputSchema } from '@/server/mcp/tools/list-media';
import { listModelsInputSchema } from '@/server/mcp/tools/list-models';
import { listRecentGenerationsInputSchema } from '@/server/mcp/tools/list-recent-generations';
import { prepareGenerationInputSchema } from '@/server/mcp/tools/prepare-generation';
import { prepareMontageInputSchema } from '@/server/mcp/tools/prepare-montage';
import { listAudioCapabilitiesInputSchema } from '@/server/mcp/tools/list-audio-capabilities';
import { prepareAudioGenerationInputSchema } from '@/server/mcp/tools/prepare-audio-generation';
import { confirmAudioGenerationInputSchema } from '@/server/mcp/tools/confirm-audio-generation';
import { recommendModelsInputSchema } from '@/server/mcp/tools/recommend-models';
import {getStudioTimelineToolInputSchema,editStudioTimelineToolInputSchema} from '@/server/mcp/tools/studio-timeline';
import {prepareStudioExportInputSchema,confirmStudioExportInputSchema,getStudioExportInputSchema} from '@/server/mcp/tools/studio-export';

export const MCP_TOOL_INPUT_SCHEMAS = {
  get_account_status: getAccountStatusInputSchema,
  list_models: listModelsInputSchema,
  get_model_details: getModelDetailsInputSchema,
  recommend_models: recommendModelsInputSchema,
  calculate_project_budget: calculateProjectBudgetInputSchema,
  compare_generation_prices:compareGenerationPricesInputSchema,
  list_media: listMediaInputSchema,
  create_reference_upload_link: createReferenceUploadLinkInputSchema,
  import_reference_files: importReferenceFilesInputSchema,
  prepare_montage: prepareMontageInputSchema,
  create_studio_montage: createStudioMontageToolInputSchema,
  get_studio_timeline: getStudioTimelineToolInputSchema,
  edit_studio_timeline: editStudioTimelineToolInputSchema,
  prepare_studio_export: prepareStudioExportInputSchema,
  confirm_studio_export: confirmStudioExportInputSchema,
  get_studio_export: getStudioExportInputSchema,
  list_audio_capabilities: listAudioCapabilitiesInputSchema,
  prepare_audio_generation: prepareAudioGenerationInputSchema,
  confirm_audio_generation: confirmAudioGenerationInputSchema,
  prepare_generation: prepareGenerationInputSchema,
  confirm_generation: confirmGenerationInputSchema,
  get_generation_status: getGenerationStatusInputSchema,
  get_generation_download: getGenerationStatusInputSchema,
  list_recent_generations: listRecentGenerationsInputSchema,
  present_generation: getGenerationStatusInputSchema,
  create_topup_link: createTopupLinkInputSchema,
} as const;

export type McpToolInputSchemaName = keyof typeof MCP_TOOL_INPUT_SCHEMAS;
