import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { AgentApiError } from "@/server/agent-api/errors";
import { CANONICAL_GENERATION_MODES } from "@/server/agent-api/generation-types";
import type { AgentPrincipal } from "@/server/agent-api/principal";
import type { MaxVideoAiMcpServices } from "@/server/mcp/server";
import { omitNullishToolInput } from "@/server/mcp/optional-tool-input";
import { runAgentTool } from "@/server/mcp/tool-result";
import { canonicalSettingsSchema } from "./prepare-generation";

export const compareGenerationPricesInputSchema = z
  .object({
    surface: z.enum(["video", "image"]),
    mode: z.enum(CANONICAL_GENERATION_MODES),
    prompt: z.string().trim().min(1).max(3000),
    settings: canonicalSettingsSchema
      .omit({ multiPrompt: true })
      .extend({
        audio: z
          .boolean()
          .nullable()
          .default(null)
          .describe(
            "Sound requirement: true requires generated sound, false requires silent output. Fixed-audio models are checked without inventing a toggle.",
          ),
      })
      .nullable()
      .default(null)
      .describe(
        "Explicit constraints only. Include durationSec for video. Leave unspecified resolution/framing null for disclosed supported presets. Never relax a requested value to get more models.",
      ),
    references: z
      .array(
        z
          .object({
            kind: z.literal("asset"),
            assetId: z.string().trim().min(1).max(128),
            role: z.enum([
              "source",
              "reference",
              "first_frame",
              "last_frame",
              "mask",
            ]),
            slot: z.number().int().min(0).max(31).nullable().default(null),
          })
          .strict(),
      )
      .max(32)
      .nullable()
      .default(null),
    baselineModelId: z
      .string()
      .trim()
      .min(1)
      .max(128)
      .nullable()
      .default(null)
      .describe(
        "Reprice this exact model to calculate current savings. Never pass a remembered price.",
      ),
    baselineSettings: canonicalSettingsSchema
      .omit({ multiPrompt: true })
      .nullable()
      .default(null)
      .describe(
        "When changing resolution or duration, supply the original quote settings to reprice that configuration. Null uses the current scenario. Never pass an old price.",
      ),
    candidateModelIds: z
      .array(z.string().trim().min(1).max(128))
      .min(1)
      .max(32)
      .nullable()
      .default(null)
      .describe(
        "Only explicitly requested alternatives; null compares the live eligible catalog. Never replace a named model without approval.",
      ),
  })
  .strict();

export function registerCompareGenerationPricesTool(
  server: McpServer,
  principal: AgentPrincipal,
  services: MaxVideoAiMcpServices,
): void {
  server.registerTool(
    "compare_generation_prices",
    {
      title: "Compare compatible MaxVideoAI generation prices",
      description:
        "Use this when an open image/video model choice or requested alternatives need prices for a simple single-output brief. One read returns up to three compatible models with current customer prices, favoring different prices; fewer if fewer meet every constraint. Use actual imported owned assets, exact mode, reference roles/combinations and explicit duration/resolution/audio requirements. Unspecified presets are disclosed; do not silently change requirements. Include a baseline model for freshly calculated savings; disclose configurationDiffers and never compare currencies. Keep labels/explanations brief, with no routine lip-sync caveats; price alone does not prove quality. Do not use to substitute an explicitly chosen model. No quotes, wallet reads, reservations, spending or media generation. After choice inspect get_model_details and prepare_generation for a fresh exact quote, then wait for approval. Invite a different model, resolution, duration or budget for a new quote and price comparison. For multi-shot production/attempt allowances use calculate_project_budget.",
      inputSchema: compareGenerationPricesInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (input) =>
      runAgentTool(() => {
        if (!services.compareGenerationPrices)
          throw new AgentApiError(
            "INTERNAL_ERROR",
            "Current model price comparison is unavailable.",
          );
        return services.compareGenerationPrices(
          {
            surface: input.surface,
            mode: input.mode,
            prompt: input.prompt,
            settings: input.settings
              ? omitNullishToolInput(input.settings)
              : {},
            references: (input.references ?? []).map((ref) => ({
              kind: ref.kind,
              assetId: ref.assetId,
              role: ref.role,
              ...(ref.slot === null ? {} : { slot: ref.slot }),
            })),
            ...(input.baselineModelId
              ? { baselineModelId: input.baselineModelId }
              : {}),
            ...(input.candidateModelIds
              ? { candidateModelIds: input.candidateModelIds }
              : {}),
            ...(input.baselineSettings
              ? {
                  baselineSettings: omitNullishToolInput(
                    input.baselineSettings,
                  ),
                }
              : {}),
          },
          principal,
        );
      }),
  );
}
