import { readFile, writeFile } from 'node:fs/promises';

const sourcePath = new URL('../frontend/config/model-registry.json', import.meta.url);
const outputPath = new URL('../frontend/config/model-runtime.json', import.meta.url);
const source = JSON.parse(await readFile(sourcePath, 'utf8'));
const runtime = {
  schemaVersion: source.schemaVersion,
  models: source.models.map(({ replacement, ...model }) => model),
};
const expected = `${JSON.stringify(runtime, null, 2)}\n`;
const write = process.argv.includes('--write');

if (write) {
  await writeFile(outputPath, expected);
  console.log(`[model-runtime] wrote ${runtime.models.length} models`);
} else {
  const current = await readFile(outputPath, 'utf8').catch(() => '');
  if (current !== expected) {
    console.error('[model-runtime] drift detected; run pnpm model:registry:generate');
    process.exitCode = 1;
  } else {
    console.log(`[model-runtime] projection current (${runtime.models.length} models)`);
  }
}
