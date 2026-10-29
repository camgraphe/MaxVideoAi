import assert from "node:assert/strict";
import test from "node:test";
import {
  projectAllowedAnalyticsPayload,
  projectAnalyticsLandingSurface,
} from "../frontend/lib/analytics/journey";
test("Milo acquisition keeps only approved placement facts and never example or customer content", () => {
  assert.deepEqual(
    projectAllowedAnalyticsPayload("cta_click", {
      cta_name: "milo_try",
      cta_location: "milo_hero",
      prompt: "private",
      reference_url: "https://private.example/asset",
      message: "private",
    }),
    { cta_name: "milo_try", cta_location: "milo_hero" },
  );
  assert.equal(
    projectAnalyticsLandingSurface("marketing", "/ai-video-prompt-generator"),
    "/ai-video-prompt-generator",
  );
});
