import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, writeFile, rm, mkdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { JSDOM } from 'jsdom';
import { buildNano21PrivateReview, assertPrivateReviewPath } from '../scripts/lib/nano21-editorial-review';
import { nano21EditorialFixture } from './helpers/nano21-editorial-fixture';

test('private draft review measures supplied bytes and response membership without leaking file paths or response data', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'nano21-private-review-'));
  try {
    const bytes = await sharp({ create: { width: 64, height: 36, channels: 3, background: '#123456' } }).png().toBuffer();
    const originalFile = join(directory, 'original.png'), displayFile = join(directory, 'display.png'), responseFile = join(directory, 'response.json');
    await Promise.all([writeFile(originalFile, bytes), writeFile(displayFile, bytes), writeFile(responseFile,
      JSON.stringify({ privateToken: 'must-never-appear', candidates: [{ content: { parts: [{ inlineData: { data: bytes.toString('base64') } }] } }] }))]);
    const fixture = nano21EditorialFixture();
    const draft = { ...fixture, status: 'draft', media: { originalFile, displayFile }, provenance: {
      kind: 'external_vertex', location: 'global', generatedAt: fixture.provenance.generatedAt, responseFile } };
    for (const explicitCap of [4096, 32768] as const) {
      const html = await buildNano21PrivateReview({ ...draft, settings: { ...draft.settings, maxOutputTokens: explicitCap } });
      const dom = new JSDOM(html);
      const declared = JSON.parse(dom.window.document.querySelector('[data-declared-facts]')!.textContent!);
      assert.equal(declared.settings.maxOutputTokens, explicitCap);
      assert.match(html, /Private Nano21 draft review/); assert.match(html, /data:image\/png;base64,/);
      assert.match(html, /responseSha256/); assert.match(html, /&quot;width&quot;: 64/);
      assert.equal(html.includes(directory), false); assert.equal(html.includes('must-never-appear'), false);
      dom.window.close();
    }
    await assert.rejects(() => buildNano21PrivateReview({ ...draft, status: 'accepted' }));
    await writeFile(responseFile, JSON.stringify({ candidates: [] }));
    await assert.rejects(() => buildNano21PrivateReview(draft), /selected original/);
    const publicDir = join(directory, 'public'); await mkdir(publicDir);
    await assert.rejects(() => assertPrivateReviewPath(join(publicDir, 'review.html')), /publicly served/);
    const alias = join(directory, 'looks-private'); await symlink(publicDir, alias);
    await assert.rejects(() => assertPrivateReviewPath(join(alias, 'review.html')), /publicly served/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
