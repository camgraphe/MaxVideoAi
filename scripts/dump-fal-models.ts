import fs from 'node:fs/promises';
import path from 'node:path';
import fsSync from 'node:fs';
import dotenv from 'dotenv';

const ENV_FILES = [
  path.join(process.cwd(), '.env.local'),
  path.join(process.cwd(), 'frontend', '.env.local'),
  path.join(process.cwd(), '.env'),
];

for (const envFile of ENV_FILES) {
  if (fsSync.existsSync(envFile)) {
    dotenv.config({ path: envFile, override: false });
  }
}

type FalModelPayload = {
  models?: unknown[];
  next_cursor?: string | null;
  has_more?: boolean;
};

async function fetchModels() {
  const falKey = process.env.FAL_KEY ?? process.env.FAL_API_KEY;
  if (!falKey) {
    throw new Error('Missing FAL key. Set FAL_KEY or FAL_API_KEY before dumping models.');
  }

  const models: unknown[] = [];
  let cursor: string | null = null;

  do {
    const url = new URL('https://api.fal.ai/v1/models');
    url.searchParams.set('limit', '200');
    if (cursor) {
      url.searchParams.set('cursor', cursor);
    }

    const res = await fetch(url, {
      headers: {
        Authorization: `Key ${falKey}`,
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to fetch FAL models (${res.status}): ${text}`);
    }

    const payload = (await res.json()) as FalModelPayload;
    if (Array.isArray(payload.models)) {
      models.push(...payload.models);
    }
    cursor = payload.has_more ? payload.next_cursor ?? null : null;
  } while (cursor);

  return { models };
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
