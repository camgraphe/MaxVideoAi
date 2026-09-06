import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HOME_LCP_POSTER_SRC, HOME_LCP_MOBILE_POSTER_SRC } from '../components/marketing/home/home-lcp-image';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = join(root, 'public');
const prepared = join(publicDir, 'hero/prepared');
const manifestPath = join(root, 'config/home-posters.generated.json');
const write = process.argv.includes('--write');
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const profiles = { desktop: HOME_LCP_POSTER_SRC, mobile: HOME_LCP_MOBILE_POSTER_SRC };
const manifest = Object.fromEntries(Object.entries(profiles).map(([profile, source]) => {
  assert.match(source, /^\/hero\/[a-z0-9-]+\.webp$/);
  const bytes = readFileSync(join(publicDir, source));
  const sha256 = digest(bytes);
  const filename = `${sha256}.webp`;
  const destination = join(prepared, filename);
  if (write && !existsSync(destination)) {
    mkdirSync(prepared, { recursive: true });
    writeFileSync(destination, bytes, { flag: 'wx' });
  }
  assert.ok(existsSync(destination), 'Run pnpm media:home-posters:prepare after changing the critical poster.');
  assert.equal(digest(readFileSync(destination)), sha256, 'Never overwrite an immutable poster.');
  return [profile, { source, url: `/hero/prepared/${filename}`, sha256, bytes: bytes.length }];
}));

// Older versioned URLs can still be referenced by cached HTML. Retain them, and
// enforce the same byte identity for every file served with immutable caching.
for (const filename of readdirSync(prepared)) {
  assert.match(filename, /^[a-f0-9]{64}\.webp$/);
  assert.equal(digest(readFileSync(join(prepared, filename))), filename.slice(0, -5));
}
const expected = JSON.stringify(manifest, null, 2) + '\n';
if (write) writeFileSync(manifestPath, expected);
else assert.equal(readFileSync(manifestPath, 'utf8'), expected, 'Regenerate home-posters.generated.json; never hand-edit it.');
console.log(`[home-posters] ${write ? 'prepared' : 'verified'} two immutable, byte-identical display posters`);
