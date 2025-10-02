process.env.DATABASE_URL ??= "postgres://debug:debug@localhost:5432/debug";
process.env.FAL_KEY ??= "debug";
process.env.APP_URL ??= "https://example.com";

import {
  models,
  FAL_INIT_IMAGE_REQUIRED_ENGINES,
  FAL_REF_VIDEO_REQUIRED_ENGINES,
  type ModelSpec,
} from "../../src/data/models";

function checkModelConsistency(spec: ModelSpec) {
  const issues: string[] = [];

  const requiresInit = FAL_INIT_IMAGE_REQUIRED_ENGINES.has(spec.id);
  if (requiresInit && !spec.supports.imageInit) {
    issues.push("requires init image but supports.imageInit = false");
  }

  const requiresRef = FAL_REF_VIDEO_REQUIRED_ENGINES.has(spec.id);
  if (requiresRef && !spec.supports.refVideo) {
    issues.push("requires reference video but supports.refVideo = false");
  }

  if (spec.supports.mask && !spec.supports.imageInit) {
    issues.push("supports.mask true but imageInit false (mask only works with init image)");
  }

  return issues;
}

console.log(`Loaded ${Object.keys(models).length} models`);

const mismatches: Array<{ id: string; issue: string }> = [];

for (const spec of Object.values(models)) {
  if (spec.provider !== "fal") continue;
  const issues = checkModelConsistency(spec);
  for (const issue of issues) {
    mismatches.push({ id: spec.id, issue });
  }
}

if (mismatches.length === 0) {
  console.log("No mismatches detected.");
} else {
  console.log("Found mismatches:");
  for (const mismatch of mismatches) {
    console.log(`- ${mismatch.id}: ${mismatch.issue}`);
  }
}
