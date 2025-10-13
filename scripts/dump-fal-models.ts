import fs from 'node:fs/promises';
import path from 'node:path';
import { buildFalProxyUrl } from '../frontend/src/lib/fal-proxy';

async function fetchModels() {
  const url = buildFalProxyUrl('/models');
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch FAL models (${res.status}): ${text}`);
  }
  return res.json();
}

async function writeFixtures(payload: unknown) {
  const formatted = `${JSON.stringify(payload, null, 2)}\n`;
  const targets = [
    path.join(process.cwd(), 'frontend', 'fixtures', 'fal-models.json'),
    path.join(process.cwd(), 'fixtures', 'fal-models.json'),
  ];
  await Promise.all(
    targets.map(async (target) => {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, formatted, 'utf-8');
    })
  );
}

async function main() {
  const models = await fetchModels();
  await writeFixtures(models);
  // eslint-disable-next-line no-console
  console.log('Updated fal-models.json fixtures');
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to dump FAL models:', error);
  process.exitCode = 1;
});

