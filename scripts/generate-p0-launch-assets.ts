import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  createMissingModelLaunchAssetProjection,
  createMissingModelLaunchReadinessProjection,
  createModelLaunchReadinessProjection,
  validateP0VideoExamplePackDocument,
  type ModelLaunchAssetProjection,
} from '../frontend/server/model-launch-assets-validation';
import type { ModelLaunchReadinessProjection } from '../frontend/config/model-launch-readiness-schema';

const SOURCE_MANIFEST = 'docs/model-launch/p0-video-example-pack.json' as const;
const FULL_PROJECTION = 'frontend/server/model-launch-assets.generated.json';
const READINESS_PROJECTION = 'frontend/config/model-launch-readiness.generated.json';
const sourcePath = resolve(process.cwd(), SOURCE_MANIFEST);

function buildProjections(): {
  full: ModelLaunchAssetProjection;
  readiness: ModelLaunchReadinessProjection;
} {
  if (!existsSync(sourcePath)) {
    return {
      full: createMissingModelLaunchAssetProjection(),
      readiness: createMissingModelLaunchReadinessProjection(),
    };
  }

  const source = readFileSync(sourcePath, 'utf8');
  const validation = validateP0VideoExamplePackDocument(JSON.parse(source) as unknown);
  if (!validation.ok) {
    throw new Error(`Invalid Task 12 example pack:\n${validation.errors.join('\n')}`);
  }
  const sourceDigest = createHash('sha256').update(source).digest('hex');
  return {
    full: {
      schemaVersion: 1,
      generatedBy: 'scripts/generate-p0-launch-assets.ts',
      sourceManifest: SOURCE_MANIFEST,
      sourceStatus: 'validated',
      sourceDigest,
      assets: validation.assets,
    },
    readiness: createModelLaunchReadinessProjection({ sourceDigest, assets: validation.assets }),
  };
}

const projections = buildProjections();
const outputs = [
  { path: FULL_PROJECTION, value: projections.full },
  { path: READINESS_PROJECTION, value: projections.readiness },
] as const;
for (const output of outputs) {
  const outputPath = resolve(process.cwd(), output.path);
  const expected = `${JSON.stringify(output.value, null, 2)}\n`;
  if (process.argv.includes('--write')) {
    writeFileSync(outputPath, expected, 'utf8');
    process.stdout.write(`[model-launch-assets] wrote ${output.path}\n`);
  } else {
    const current = existsSync(outputPath) ? readFileSync(outputPath, 'utf8') : '';
    if (current !== expected) {
      throw new Error(`Generated launch projection is stale: ${output.path}. Run pnpm model:launch-assets:generate.`);
    }
  }
}
if (!process.argv.includes('--write')) process.stdout.write('[model-launch-assets] projections current\n');
