import assert from 'node:assert/strict';
import test from 'node:test';

import actionFlags from '../frontend/config/mcp-client-actions.json';
import { getMcpPublicationState, isMcpPublicSourcePath } from '../frontend/lib/mcp-publication';
import baseline from './fixtures/mcp-integration-public-baseline.json';

const clients = ['claude', 'chatgpt', 'codex'] as const;
const locales = ['en', 'fr', 'es'] as const;

test('the published MCP integration floor contains fifteen localized owners', () => {
  const urls = Object.values(baseline.localizedUrls).flatMap((entry) => Object.values(entry));
  assert.equal(new Set(urls).size, 15);
  assert.deepEqual(baseline.publicConcepts, [
    '/mcp',
    '/docs/mcp',
    '/integrations/chatgpt',
    '/integrations/claude',
    '/integrations/codex',
  ]);
});

test('the existing public paths, evidence floor, deep links and localized copy stay unchanged', async () => {
  const { getIntegrationCopy } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/integrations/_lib/integration-copy.ts'
  );
  const { getMcpCompatibilityEvidence } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-compatibility.ts'
  );

  for (const url of Object.values(baseline.localizedUrls).flatMap((entry) => Object.values(entry))) {
    assert.equal(isMcpPublicSourcePath(new URL(url).pathname), true, `${url} should remain public`);
  }

  const evidence = getMcpCompatibilityEvidence();
  const hosts = Object.fromEntries(
    Object.values(evidence.clients)
      .filter((client): client is NonNullable<typeof client> => Boolean(client))
      .flatMap((client) =>
        client.hosts.map((host) => [host.id, { client: host.client, status: host.status }]),
      ),
  );
  assert.deepEqual(hosts, baseline.hosts);
  assert.deepEqual(actionFlags, baseline.deepLinks);

  for (const locale of locales) {
    for (const client of clients) {
      const copy = getIntegrationCopy(locale, client);
      assert.equal(copy.client, client);
      assert.equal(copy.clientLabel, baseline.integrationCopy[locale][client].label);
      assert.equal(copy.hero.backHref, baseline.integrationCopy[locale][client].backHref);
      assert.ok(copy.meta.title.length > 0);
      assert.ok(copy.meta.description.length > 0);
      assert.ok(copy.setup.hostGuides.length > 0);
    }
  }
});

test('the live global MCP state remains connected and indexable', () => {
  const state = getMcpPublicationState({
    publicMarketing: true,
    publicIndexing: true,
    transport: true,
    oauth: true,
    discovery: true,
    paidGeneration: true,
    trial: false,
    referenceUploads: true,
  });
  assert.equal(state.renderPublicPage, true);
  assert.equal(state.connectionAvailable, true);
  assert.equal(state.indexable, true);
});
