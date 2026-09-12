import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getMcpClientActionConfig,
  getMcpHost,
  getMcpIntegration,
  getMcpIntegrationIds,
  getMcpIntegrationLabel,
  getMcpPublicIntegrationPaths,
  getMcpVisibleIntegrationIds,
  isEnabledMcpAcquisitionClient,
  parseMcpIntegrationRegistry,
} from '../frontend/lib/mcp-integration-registry';

test('the initial registry contains the three existing integrations in public order', () => {
  assert.deepEqual(getMcpIntegrationIds(), ['claude', 'chatgpt', 'codex']);
  assert.deepEqual(getMcpVisibleIntegrationIds(), ['claude', 'chatgpt', 'codex']);
  assert.equal(getMcpIntegrationLabel('chatgpt'), 'ChatGPT');
  assert.deepEqual(getMcpPublicIntegrationPaths(), [
    '/integrations/claude',
    '/integrations/chatgpt',
    '/integrations/codex',
  ]);
});

test('existing publication, evidence and action floors are preserved', () => {
  assert.deepEqual(getMcpIntegration('claude').hosts, ['claudeDesktop', 'claudeCode']);
  assert.equal(getMcpHost('claudeDesktop').evidence.status, 'verified');
  assert.equal(getMcpHost('claudeCode').evidence.status, 'not-run');
  assert.equal(getMcpHost('chatgptWeb').evidence.status, 'not-run');
  assert.equal(getMcpHost('codexCli').evidence.status, 'verified');
  for (const id of getMcpIntegrationIds()) {
    assert.equal(getMcpIntegration(id).site.publication, 'live');
    assert.equal(getMcpIntegration(id).site.indexable, true);
    assert.deepEqual(getMcpClientActionConfig(id), {
      deepLinkEnabled: false,
      deepLink: null,
    });
    assert.equal(isEnabledMcpAcquisitionClient(id), true);
  }
});

test('invalid registries fail closed', () => {
  assert.throws(() => parseMcpIntegrationRegistry({ schemaVersion: 1, integrations: {}, hosts: {} }));
  assert.throws(() => parseMcpIntegrationRegistry({
    schemaVersion: 1,
    integrations: {
      claude: {
        label: 'Claude',
        category: 'assistant',
        displayOrder: 10,
        englishPath: '/integrations/claude',
        site: { publication: 'live', indexable: true },
        acquisition: { enabled: true, key: 'claude' },
        installation: { directMcp: 'available', package: 'unavailable', deepLinkEnabled: false, deepLink: null },
        store: { target: 'anthropic-connectors-directory', status: 'policy_blocked' },
        hosts: ['missingHost'],
      },
    },
    hosts: {},
  }), /missingHost/);
});
