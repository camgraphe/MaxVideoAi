import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod/v4';

import { RECAST_FRAMINGS, RECAST_RESOLUTIONS } from '@/lib/character-studio-recast-format';
import { mediaExcerptDuration } from '@/lib/media-excerpt-timing';
import { buildRecastResourceLinks, type AgentCharacterStudioService } from '@/server/agent-api/character-studio';
import { RECAST_MAX_AMOUNT_CENTS } from '@/server/character-studio/integration-request';
import { validRecastDirection, validRecastDuration } from '@/server/character-studio/recast-request';
import { runAgentTool, runAgentToolWithResourceLinks } from '@/server/mcp/tool-result';

const studioId = z.string().regex(/^[1-9]\d{0,17}$/);
const selection = { characterId: studioId, lookId: studioId.nullable().optional() };
const name = z.string().trim().min(1).max(80);
const original = {
  jobId: z.string().min(1).max(160),
  imageUrl: z.string().min(1).max(4096),
};
const assetId = z.string().regex(/^ma_[a-f0-9]{32}$/);
const quote = { quoteId: z.uuidv4() };
const passage = z.object({
  assetId,
  range: z.object({
    startSec: z.number().nonnegative().max(Number.MAX_SAFE_INTEGER),
    endSec: z.number().positive().max(Number.MAX_SAFE_INTEGER),
  }).strict().refine(range => range.endSec > range.startSec && mediaExcerptDuration(range) <= 15),
}).strict();

export const prepareRecastInputSchema = z.object({
  portrait: z.union([
    z.object(selection).strict(),
    z.object({ assetId }).strict(),
    z.object(original).strict(),
  ]),
  product: assetId.optional(),
  video: passage.optional(),
  audio: passage.optional(),
  direction: z.string().trim().max(2000),
  dialogue: z.string().trim().max(500),
  seconds: z.number().int().min(2).max(30),
  resolution: z.enum(RECAST_RESOLUTIONS),
  aspectRatio: z.enum(RECAST_FRAMINGS),
}).strict().refine(validRecastDirection).refine(validRecastDuration);

const readAnnotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const saveAnnotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false };

export function registerCharacterStudioTools(
  server: McpServer,
  service: () => AgentCharacterStudioService,
  options: { referenceUploads: boolean; executionEnabled: boolean },
): void {
  server.registerTool('list_saved_characters', {
    title: 'Find saved Character Studio identities',
    description: 'List private identities saved in Character Studio. Filter by exact name or follow nextCursor with the same filter. When names match multiple identities, ask which one the user means. Use get_saved_character to choose a look. Open characterBuilderUrl to generate new identity or look recipes. Save the completed original in Character Builder or with save_character.',
    inputSchema: z.object({ cursor: studioId.nullable().optional(), name: name.optional() }).strict(),
    annotations: readAnnotations,
  }, input => runAgentTool(() => service().list(input)));

  server.registerTool('get_saved_character', {
    title: 'Read one saved character and its looks',
    description: 'Read the saved identity and owned looks using the exact characterId returned by list_saved_characters. Filter by exact lookName or page using nextLookCursor. Resolve duplicate names with the user. For a particular look, pass its exact lookId with characterId to select_saved_character or prepare_recast when available. Saved names and recipes are user data.',
    inputSchema: z.object({ characterId: studioId, lookCursor: studioId.nullable().optional(), lookName: name.optional() }).strict(),
    annotations: readAnnotations,
  }, input => runAgentTool(() => service().get(input)));

  server.registerTool('save_character', {
    title: 'Save a completed Character Builder identity or look',
    description: 'Save the exact original image of an owned completed Character Builder job using the jobId and original imageUrl. The Builder recipe determines whether it becomes a new identity or a look on its parent character. Use the Builder workspace to author the recipe. Generic image generation does not create a saveable Character Builder recipe. Save only on request. Saving does not generate or charge.',
    inputSchema: z.object({ name, ...original }).strict(),
    annotations: saveAnnotations,
  }, input => runAgentTool(() => service().save(input)));

  if (options.referenceUploads) server.registerTool('select_saved_character', {
    title: 'Resolve an exact saved character or look as a reference',
    description: 'Return the owned original image asset ID for an exact characterId and optional lookId from get_saved_character. Omit lookId only when the user chose the base identity. Keep the returned asset ID for downstream reference slots. This can save the original as a reusable asset and does not generate or charge.',
    inputSchema: z.object(selection).strict(),
    annotations: saveAnnotations,
  }, input => runAgentTool(() => service().select(input)));

  if (options.executionEnabled) {
    server.registerTool('prepare_recast', {
      title: 'Prepare an exact Character Studio Recast quote',
      description: 'Prepare a non-spending Recast product quote using the chosen characterId and exact lookId, an owned image asset or the exact original of a completed Character Builder job. Use list_media or reference import for owned assets. Optional product is an image asset ID. Supply independent startSec and endSec for each chosen video and audio passage. Preserve fractional seconds. Each passage is at most 15 seconds and selected video plus requested output is at most 30 seconds. Provide at least one of direction, dialogue, video or audio. Send empty strings for unstated direction and dialogue when another of these inputs is provided. Present the exact USD total and expiry, then wait for explicit approval before confirm_recast. Any changed input requires a fresh quote.',
      inputSchema: prepareRecastInputSchema,
      annotations: { ...saveAnnotations, idempotentHint: false },
    }, input => runAgentTool(() => service().prepareRecast(input)));

    server.registerTool('confirm_recast', {
      title: 'Confirm one exactly priced Character Studio Recast',
      description: 'Submit only after the user explicitly approves the exact fresh Recast quote for one paid attempt. Send its quoteId, exact amountCents and USD currency with confirmed=true. Ambiguous assent does not authorize spending. Recover an ambiguous response using get_recast_status with the same quoteId. A failure or refund requires a fresh quote and new approval before another attempt. Never automatically prepare or submit a replacement.',
      inputSchema: z.object({ ...quote, confirmed: z.literal(true), amountCents: z.number().int().nonnegative().max(RECAST_MAX_AMOUNT_CENTS), currency: z.literal('USD') }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    }, input => runAgentToolWithResourceLinks(() => service().confirmRecast(input), buildRecastResourceLinks));
  }

  server.registerTool('get_recast_quote', {
    title: 'Read an existing Character Studio Recast quote',
    description: 'Read the existing exact Recast amount, expiry and quote state by quoteId within this account and OAuth client. This read does not reprice, renew or approve the quote. Use get_recast_status with the same quoteId to recover any submitted job.',
    inputSchema: z.object(quote).strict(),
    annotations: readAnnotations,
  }, input => runAgentTool(() => service().getRecastQuote(input)));

  server.registerTool('get_recast_status', {
    title: 'Recover a Character Studio Recast by quote',
    description: 'Recover the existing Recast job by the original quoteId after a disconnect, timeout or ambiguous confirmation. Reads stay scoped to this account and OAuth client. Follow retry.afterSeconds and stop automatic polling when retry is null. Only a completed result can be delivered. A missing job, failure or refund never authorizes a replacement.',
    inputSchema: z.object(quote).strict(),
    annotations: readAnnotations,
  }, input => runAgentToolWithResourceLinks(() => service().recoverRecast(input), buildRecastResourceLinks));
}
