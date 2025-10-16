#!/usr/bin/env ts-node

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function parseEnv(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    if (!line) continue;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_\.-]*)\s*=\s*(.*)$/);
    if (!match) continue;

    const key = match[1];
    let value = match[2];

    // Remove optional surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    // Replace escaped newlines so multi-line secrets work
    value = value.replace(/\\n/g, '\n').replace(/\\r/g, '\r');

    result[key] = value;
  }

  return result;
}

function mergeEnv(target: NodeJS.ProcessEnv, source: Record<string, string>): void {
  for (const [key, value] of Object.entries(source)) {
    if (key in target && typeof target[key] === 'string' && target[key]) {
      continue;
    }
    target[key] = value;
  }
}

function resolveEnvPath(argPath: string | undefined): string {
  const candidate = argPath && argPath.trim().length ? argPath : 'frontend/.env.local';
  return resolve(process.cwd(), candidate);
}

async function run(): Promise<void> {
  const envPath = resolveEnvPath(process.argv[2]);

  if (!existsSync(envPath)) {
    console.error(`⚠️  Env file not found at ${envPath}`);
    process.exit(1);
  }

  const fileContent = readFileSync(envPath, 'utf8');
  const parsed = parseEnv(fileContent);

  if (Object.keys(parsed).length === 0) {
    console.warn(`⚠️  No variables were parsed from ${envPath}. Running healthcheck with existing environment.`);
  } else {
    mergeEnv(process.env, parsed);
    console.log(`Loaded ${Object.keys(parsed).length} variable(s) from ${envPath}`);
  }

  // @ts-ignore allow .ts extension import for ts-node runtime
  await import('./healthcheck.ts');
}

run().catch((error) => {
  console.error('❌ Healthcheck (with env) failed to start', error);
  process.exit(1);
});
