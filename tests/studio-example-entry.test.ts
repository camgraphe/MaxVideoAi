import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { loadStudioExampleEntry } from '../frontend/server/studio-example-entry';
import { detail } from './fixtures/example-continuation';

test('Studio example entry only resolves a bounded public example id and returns an explicit public draft projection', async () => {
  const ids: string[] = [];
  const load = async (id: string) => { ids.push(id); return detail; };
  for (const invalid of [undefined, ['public-example'], '../admin', 'https://other.test']) assert.equal(await loadStudioExampleEntry(invalid, load), null);
  assert.deepEqual(ids, []);
  const example = await loadStudioExampleEntry('public-example', load);
  assert.equal(example?.id, detail.id);
  assert.equal(example?.prompt, detail.prompt);
  assert.ok(!('historicalCost' in example!));
  assert.ok(!('quotes' in example!));
  assert.equal(await loadStudioExampleEntry('missing', async () => null), null);
});

test('example identity survives Studio entry, project creation and guest login without auto-sending a message', () => {
  const base = 'frontend/app/(core)/(workspace)/app/studio/';
  const page = readFileSync(base + 'page.tsx', 'utf8');
  const start = readFileSync(base + '_components/StudioStart.client.tsx', 'utf8');
  const guest = readFileSync(base + '_components/StudioGuestDemo.client.tsx', 'utf8');
  const conversation = readFileSync(base + 'conversation/[projectId]/page.tsx', 'utf8');
  assert.match(page, /loadStudioExampleEntry/);
  assert.match(page, /!example/);
  assert.match(start, /query\.set\('example',exampleId\)/);
  assert.match(guest, /example\.id/);
  assert.match(conversation, /loadStudioExampleEntry/);
});
