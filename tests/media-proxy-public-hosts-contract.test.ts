import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import path from 'node:path';

const repoRoot = process.cwd();
const mediaProxyRoutePath = path.join(repoRoot, 'frontend/app/api/media-proxy/route.ts');

test('visitor media proxy allows MaxVideoAI CDN assets used by public tool demos', () => {
  const source = readFileSync(mediaProxyRoutePath, 'utf8');

  assert.match(source, /PUBLIC_MEDIA_PROXY_HOSTS[\s\S]*'media\.maxvideoai\.com'/);
});
