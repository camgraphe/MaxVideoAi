import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

type PackageManifest = {
  dependencies?: Record<string, string>;
};

const manifest = JSON.parse(
  readFileSync(join(process.cwd(), 'frontend/package.json'), 'utf8')
) as PackageManifest;

test('MCP and Supabase OAuth dependencies stay pinned to reviewed versions', () => {
  assert.equal(manifest.dependencies?.['@modelcontextprotocol/sdk'], '1.29.0');
  assert.equal(manifest.dependencies?.['@supabase/supabase-js'], '2.110.2');
});
