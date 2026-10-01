import assert from "node:assert/strict";
import test from "node:test";
import { getFalEngineById } from "../frontend/src/config/falEngines";
import {
  imageDraftSchema,
  imageTurnInputSchema,
} from "../frontend/src/lib/studio/image-conversation-contract";
import { imageRequestFromDraft } from "../frontend/src/server/studio/image-conversation-service";
import { validateCanonicalGenerationCapabilities } from "../frontend/src/server/agent-api/generation-capability-validation";
import { normalizeGenerationRequest } from "../frontend/src/server/agent-api/generation-normalization";
import { isWorkspaceModelCertifiedForBlock } from "../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/workspace-model-certification";
import type { AgentPublicGenerationEngine } from "../frontend/src/server/agent-api/model-catalog";
test("Flare pilot selects a single certified image and maps each format to actual catalog settings", () => {
  const entry = getFalEngineById("gpt-image-2-5-flare");
  assert.ok(entry);
  const candidate: AgentPublicGenerationEngine = {
    engine: entry.engine,
    surface: "image",
    publicModes: ["t2i", "i2i"],
    modeCaps: Object.fromEntries(
      entry.modes.map((mode) => [mode.mode, mode.ui]),
    ),
  };
  for (const mode of ["t2i", "i2i"] as const) {
    assert.equal(
      isWorkspaceModelCertifiedForBlock({
        modelId: entry.id,
        presetId: mode === "t2i" ? "generate-image" : "modify-image",
        workflowType: mode === "t2i" ? "text_to_image" : "image_to_image",
      }),
      true,
    );
    for (const aspectRatio of ["16:9", "9:16", "1:1"] as const) {
      const refs = mode === "i2i" ? ["ma_" + "a".repeat(32)] : [];
      const request = imageRequestFromDraft(
        {
          reply: "Direction",
          image: { prompt: "Cinematic cobalt perfume", aspectRatio },
        },
        {
          requestId: "123e4567-e89b-42d3-a456-426614174000",
          message: "Crée cette image",
          references: refs,
        },
        [candidate],
      );
      assert.deepEqual(normalizeGenerationRequest(request), request);
      validateCanonicalGenerationCapabilities(request, candidate, {
        resolvedReferences: refs.map((assetId) => ({
          assetId,
          role: "reference",
          mediaKind: "image",
          storageUrl: "https://cdn.maxvideoai.com/owned-reference.png",
          mimeType: "image/png",
          width: 1024,
          height: 1024,
          durationSec: null,
        })),
      });
      assert.equal(request.outputCount, 1);
      assert.equal(request.mode, mode);
      assert.equal(request.engineId, "gpt-image-2-5-flare");
    }
  }
});
test("neither model output nor client input can authorize a payment or supply an account", () => {
  assert.throws(() =>
    imageDraftSchema.parse({ reply: "Do it", image: null, confirmed: true }),
  );
  assert.throws(() =>
    imageTurnInputSchema.parse({
      requestId: "123e4567-e89b-42d3-a456-426614174000",
      message: "Hi",
      references: [],
      userId: "foreign",
    }),
  );
});
