import OpenAI from "openai";
import {
  imageDraftSchema,
  type ImageDraft,
  type ImageTurnInput,
} from "@/lib/studio/image-conversation-contract";
import { AgentApiError } from "@/server/agent-api/errors";
import type { ResolvedReference } from "@/server/agent-api/reference-types";

export type ImageDirector = (
  input: ImageTurnInput,
  history: { message: string; reply: string | null }[],
  references: ResolvedReference[],
) => Promise<ImageDraft>;
const format = {
  type: "json_schema" as const,
  name: "studio_image_direction",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["reply", "image"],
    properties: {
      reply: { type: "string" },
      image: {
        anyOf: [
          { type: "null" },
          {
            type: "object",
            additionalProperties: false,
            required: ["prompt", "aspectRatio"],
            properties: {
              prompt: { type: "string" },
              aspectRatio: { type: "string", enum: ["16:9", "9:16", "1:1"] },
            },
          },
        ],
      },
    },
  },
};
export const draftStudioImage: ImageDirector = async (
  input,
  history,
  references,
) => {
  if (!process.env.OPENAI_API_KEY)
    throw new AgentApiError(
      "ENGINE_UNAVAILABLE",
      "Studio conversation is not configured.",
    );
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    maxRetries: 0,
    timeout: 65000,
  });
  try {
    const response = await client.responses.create({
      model: "gpt-6.1-sol",
      store: false,
      max_output_tokens: 1600,
      reasoning: { effort: "medium" },
      instructions: `Tu es le réalisateur de Studio MaxVideoAI. Réponds brièvement en français. Ce pilote sait uniquement préparer UNE image ou retoucher les références image jointes. La génération est exécutée seulement après le bouton de confirmation client. Ne prétends jamais qu'une image, vidéo ou un son est déjà créé. Aucun prix inventé. Si le brief suffit et demande de créer, image contient un prompt précis et un format ; sinon pose la seule question utile et image vaut null. Une référence jointe appartient au client : décris son rôle sans inventer des détails non visibles. Avec références le prompt sera exécuté en retouche, sans références en création. Privilégie une direction artistique fine, lumière, composition, matière. Les modes complet/par étapes restent des détails de conversation. N'exécute et ne confirme aucune dépense.`,
      input: [
        ...history
          .slice(-8)
          .flatMap((turn) => [
            { role: "user" as const, content: turn.message.slice(0, 2000) },
            ...(turn.reply
              ? [
                  {
                    role: "assistant" as const,
                    content: turn.reply.slice(0, 2400),
                  },
                ]
              : []),
          ]),
        {
          role: "user",
          content: [
            { type: "input_text", text: input.message },
            ...references.map((ref) => ({
              type: "input_image" as const,
              image_url: ref.storageUrl,
              detail: "low" as const,
            })),
          ],
        },
      ],
      text: { format },
    });
    if (response.status !== "completed" || !response.output_text)
      throw new Error("INCOMPLETE");
    return imageDraftSchema.parse(JSON.parse(response.output_text));
  } catch (error) {
    if (error instanceof AgentApiError) throw error;
    throw new AgentApiError(
      "INTERNAL_ERROR",
      "Studio could not prepare this message. Retry the same message.",
      true,
    );
  }
};
