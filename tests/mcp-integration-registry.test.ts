import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  getMcpClientActionConfig,
  getMcpHost,
  getMcpIntegration,
  getMcpIntegrationIds,
  getMcpIntegrationLabel,
  getMcpPublicIntegrationIds,
  getMcpPublicIntegrationPaths,
  getMcpVisibleIntegrationIds,
  isEnabledMcpAcquisitionClient,
  parseMcpIntegrationRegistry,
} from '../frontend/lib/mcp-integration-registry';

test('the registry contains five live integrations and the hidden roadmap in order', () => {
  assert.deepEqual(getMcpIntegrationIds(), [
    'claude',
    'chatgpt',
    'codex',
    'openclaw',
    'n8n',
    'cursor',
    'githubCopilot',
    'geminiCli',
    'microsoftCopilot',
  ]);
  assert.deepEqual(getMcpVisibleIntegrationIds(), [
    'claude',
    'chatgpt',
    'codex',
    'openclaw',
    'n8n',
  ]);
  assert.equal(getMcpIntegrationLabel('chatgpt'), 'ChatGPT');
  assert.deepEqual(getMcpPublicIntegrationPaths(), [
    '/integrations/claude',
    '/integrations/chatgpt',
    '/integrations/codex',
    '/integrations/openclaw',
    '/integrations/n8n',
  ]);
});

test('public integration ids fail closed when a registry entry is withdrawn', () => {
  const fixture = JSON.parse(readFileSync('frontend/config/mcp-integrations.json', 'utf8')) as {
    integrations: Record<string, { site: { publication: string; indexable: boolean } }>;
  };
  fixture.integrations.openclaw.site = { publication: 'hidden', indexable: false };

  const withdrawnRegistry = parseMcpIntegrationRegistry(fixture);
  assert.deepEqual(getMcpPublicIntegrationIds(withdrawnRegistry), [
    'claude',
    'chatgpt',
    'codex',
    'n8n',
  ]);
});

test('existing publication, evidence and action floors are preserved', () => {
  assert.deepEqual(getMcpIntegration('claude').hosts, ['claudeDesktop', 'claudeCode']);
  assert.equal(getMcpHost('claudeDesktop').evidence.status, 'verified');
  assert.equal(getMcpHost('claudeCode').evidence.status, 'not-run');
  assert.equal(getMcpHost('chatgptWeb').evidence.status, 'not-run');
  assert.equal(getMcpHost('claudeCode').evidence.lastChecked, '2026-08-27');
  assert.equal(getMcpHost('chatgptWeb').evidence.lastChecked, '2026-08-27');
  assert.equal(getMcpHost('chatgptWeb').label, 'ChatGPT');
  assert.equal(getMcpHost('codexCli').evidence.status, 'verified');
  for (const id of ['claude', 'chatgpt', 'codex'] as const) {
    assert.equal(getMcpIntegration(id).site.publication, 'live');
    assert.equal(getMcpIntegration(id).site.indexable, true);
    assert.deepEqual(getMcpClientActionConfig(id), {
      deepLinkEnabled: false,
      deepLink: null,
    });
    assert.equal(isEnabledMcpAcquisitionClient(id), true);
  }
});

test('OpenClaw and n8n publish without upgrading their independent host evidence', () => {
  for (const id of ['openclaw', 'n8n'] as const) {
    assert.equal(getMcpIntegration(id).site.publication, 'live');
    assert.equal(getMcpIntegration(id).site.indexable, true);
    assert.equal(getMcpIntegration(id).acquisition.enabled, true);
    assert.equal(isEnabledMcpAcquisitionClient(id), true);
  }

  assert.equal(getMcpHost('openclawGateway').evidence.status, 'tested_with_limits');
  assert.equal(getMcpHost('openclawGateway').evidence.lastChecked, '2026-09-13');

  assert.equal(getMcpHost('n8nMcpClient').evidence.status, 'tested_with_limits');
  assert.equal(getMcpHost('n8nMcpClient').evidence.lastChecked, '2026-09-14');
  assert.equal(getMcpHost('n8nMcpClientTool').evidence.status, 'not-run');
  assert.equal(getMcpHost('n8nMcpClientTool').evidence.lastChecked, '2026-09-14');

  assert.equal(getMcpIntegration('openclaw').store.status, 'listed');
  assert.equal(getMcpIntegration('n8n').store.status, 'preparing');

  for (const id of ['cursor', 'githubCopilot', 'geminiCli', 'microsoftCopilot'] as const) {
    assert.equal(getMcpIntegration(id).site.publication, 'hidden');
    assert.equal(getMcpIntegration(id).site.indexable, false);
    assert.equal(getMcpIntegration(id).acquisition.enabled, false);
    assert.equal(isEnabledMcpAcquisitionClient(id), false);
  }

  assert.equal(getMcpHost('cursorDesktop').evidence.status, 'tested_with_limits');
  assert.equal(getMcpHost('cursorDesktop').evidence.lastChecked, '2026-09-14');

  for (const id of [
    'githubCopilotIde',
    'githubCopilotCli',
    'githubCopilotCloudAgent',
  ] as const) {
    assert.equal(getMcpHost(id).evidence.status, 'not-run');
    assert.equal(getMcpHost(id).evidence.lastChecked, '2026-09-14');
  }

  for (const id of [
    'microsoftCopilotStudio',
    'microsoftAgents365',
  ] as const) {
    assert.equal(getMcpHost(id).evidence.status, 'not-run');
    assert.equal(getMcpHost(id).evidence.lastChecked, '2026-09-14');
  }

  assert.equal(getMcpHost('geminiCliHost').evidence.status, 'not-run');
  assert.equal(getMcpHost('geminiCliHost').evidence.lastChecked, '2026-09-14');
  assert.equal(getMcpHost('microsoftAgents365').label, 'Microsoft Agent 365');
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
