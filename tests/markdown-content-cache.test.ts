import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rename, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const requireFrontend = createRequire(new URL('../frontend/package.json', import.meta.url));
requireFrontend('next/dist/server/node-environment');
const { getContentEntries, getEntryBySlug }: typeof import('../frontend/lib/content/markdown') =
  createRequire(import.meta.url)('../frontend/lib/content/markdown');
const { IncrementalCache } = requireFrontend('next/dist/server/lib/incremental-cache');
const { nodeFs } = requireFrontend('next/dist/server/lib/node-fs-methods');

function createDiskCache(directory: string) {
  return new IncrementalCache({
    fs: nodeFs,
    dev: false,
    flushToDisk: true,
    maxMemoryCacheSize: 0,
    serverDistDir: path.join(directory, 'server'),
    requestHeaders: {},
    getPrerenderManifest: () => ({
      version: 4, routes: {}, dynamicRoutes: {}, notFoundRoutes: [],
      preview: { previewModeId: 'markdown-fixture', previewModeSigningKey: '', previewModeEncryptionKey: '' },
    }),
  });
}

function markdown(title: string, body: string, date = '2026-09-21') {
  return `---\ntitle: ${title}\ndescription: ${title}\ndate: ${date}\n---\n\n${body}\n`;
}

test('production Markdown serves changed source after a warm persistent Next cache without waiting or clearing it', async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), 'markdown-cache-'));
  const root = path.join(temporary, 'docs');
  const cacheDirectory = path.join(temporary, 'cache');
  const globalCache = globalThis as typeof globalThis & { __incrementalCache?: unknown };
  const previousCache = globalCache.__incrementalCache;
  const previousEnvironment = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    globalCache.__incrementalCache = createDiskCache(cacheDirectory);
    await mkdir(root);
    const file = path.join(root, 'brand-safety.mdx');
    const relativeRoot = path.relative(process.cwd(), root);
    await writeFile(file, markdown('Old policy', 'Human review is required.'));
    const before = await stat(file);
    const initial = await getEntryBySlug(relativeRoot, 'brand-safety');
    assert.equal(initial?.title, 'Old policy');
    assert.match(initial?.content ?? '', /Human review is required/);
    const diskEntries = await readdir(path.join(cacheDirectory, 'cache', 'fetch-cache'));
    assert.ok(diskEntries.length > 0, 'The first read must warm the real persistent Next Data Cache');
    const cacheFile = path.join(cacheDirectory, 'cache', 'fetch-cache', diskEntries[0]);
    const warmBytes = await readFile(cacheFile, 'utf8');
    assert.match(warmBytes, /Human review is required/);

    // Same byte length and preserved mtime: timestamps and Git HEAD alone cannot identify this edit.
    await writeFile(file, markdown('New policy', 'Human review is optional.'));
    await utimes(file, before.atime, before.mtime);
    assert.equal((await stat(file)).size, before.size);
    globalCache.__incrementalCache = createDiskCache(cacheDirectory);
    const updated = await getEntryBySlug(relativeRoot, 'brand-safety');
    assert.equal(updated?.title, 'New policy');
    assert.equal(updated?.description, 'New policy');
    assert.equal(updated?.excerpt, 'Human review is optional.');
    assert.match(updated?.content ?? '', /Human review is optional/);
    assert.doesNotMatch(updated?.content ?? '', /Human review is required/);
    assert.equal(await readFile(cacheFile, 'utf8'), warmBytes, 'Old cached evidence remains intact; this is not a purge');
  } finally {
    if (previousEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment;
    globalCache.__incrementalCache = previousCache;
    await rm(temporary, { recursive: true, force: true });
  }
});

test('production Markdown cache follows added, renamed and removed files and separates localized roots', async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), 'markdown-tree-'));
  const globalCache = globalThis as typeof globalThis & { __incrementalCache?: unknown };
  const previousCache = globalCache.__incrementalCache;
  const previousEnvironment = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    globalCache.__incrementalCache = createDiskCache(path.join(temporary, 'cache'));
    const root = path.join(temporary, 'docs');
    const frenchRoot = path.join(temporary, 'fr-docs');
    const relativeRoot = path.relative(process.cwd(), root);
    assert.deepEqual(await getContentEntries(relativeRoot), []);
    await mkdir(root);
    await mkdir(frenchRoot);
    await writeFile(path.join(root, 'one.md'), markdown('First', 'English body', '2026-09-01'));
    await writeFile(path.join(frenchRoot, 'one.md'), markdown('Premier', 'Texte français'));
    assert.equal((await getContentEntries(relativeRoot))[0]?.title, 'First');
    assert.equal((await getContentEntries(path.relative(process.cwd(), frenchRoot)))[0].title, 'Premier');
    await writeFile(path.join(root, 'two.mdx'), markdown('Second', 'Newer body'));
    assert.deepEqual((await getContentEntries(relativeRoot)).map(({ slug }) => slug), ['two', 'one']);
    await rename(path.join(root, 'two.mdx'), path.join(root, 'renamed.mdx'));
    assert.equal(await getEntryBySlug(relativeRoot, 'two'), null);
    assert.equal((await getEntryBySlug(relativeRoot, 'renamed'))?.title, 'Second');
    await rm(path.join(root, 'one.md'));
    assert.deepEqual((await getContentEntries(relativeRoot)).map(({ slug }) => slug), ['renamed']);
    await rm(path.join(root, 'renamed.mdx'));
    assert.deepEqual(await getContentEntries(relativeRoot), []);
  } finally {
    if (previousEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment;
    globalCache.__incrementalCache = previousCache;
    await rm(temporary, { recursive: true, force: true });
  }
});
