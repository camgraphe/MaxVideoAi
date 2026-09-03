import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { MODEL_LAUNCH_WAVES } from '../frontend/config/model-launch-waves';
import { buildModelLaunchProjectionsFromSources } from '../frontend/server/model-launch-assets-validation';

const FULL_PROJECTION = 'frontend/server/model-launch-assets.generated.json';
const READINESS_PROJECTION = 'frontend/config/model-launch-readiness.generated.json';
const sources = Object.fromEntries(MODEL_LAUNCH_WAVES.map((wave) => {
  const sourcePath = resolve(process.cwd(), wave.sourceManifest);
  return [wave.id, existsSync(sourcePath) ? readFileSync(sourcePath, 'utf8') : null];
})) as Record<(typeof MODEL_LAUNCH_WAVES)[number]['id'], string | null>;

const projections = buildModelLaunchProjectionsFromSources(sources);
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
