# MCP Integration Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish an extensible MCP integration registry and migrate the live ChatGPT, Claude, and Codex marketing surfaces to it without changing their public behavior.

**Architecture:** Add one validated, browser-safe registry for integration, host-evidence, installation, publication, and store facts. Preserve the current public helper shapes while migrating compatibility, client actions, acquisition allowlisting, route construction, sitemap ownership, and localized copy behind focused adapters. Lock the migration to the current fifteen localized public surfaces with semantic anti-regression contracts before moving any owner.

**Tech Stack:** Next.js App Router, React Server Components, TypeScript, JSON configuration, Node test runner through `tsx`, next-intl routing, next-sitemap, JSON-LD.

**Spec:** `docs/superpowers/specs/2026-09-12-mcp-integration-ecosystem-design.md`

## Global Constraints

- `/mcp`, `/docs/mcp`, `/integrations/chatgpt`, `/integrations/claude`, and `/integrations/codex` keep their public routes.
- All existing English, French, and Spanish localized owners remain public and indexable while the current global MCP publication flags are live.
- Existing canonical URLs, reciprocal hreflang, JSON-LD, sitemap inclusion, `llms.txt`, public-path recognition, internal links, and installation actions do not regress.
- Claude Desktop and Codex CLI retain `verified`; Claude Code and ChatGPT web retain their current evidence state.
- All three existing deep links remain disabled and `null` in this plan.
- The direct production MCP connection remains independent from external-store state.
- Do not add OpenClaw, n8n, new routes, new marketing copy, new logos, or external submissions in this plan.
- Do not change the current integration copy strings; this plan may only move them behind focused owners.
- Do not change `frontend/config/mcp-publication.json` or any production capability flag.
- Do not change MCP tools, OAuth scopes, billing, quote confirmation, generation execution, or reference-upload behavior.
- Preserve the existing `McpClientId` and `McpCompatibilityHostId` names as compatibility aliases while their values become registry-derived.
- Every task runs its focused tests before commit. Final verification runs all current MCP marketing, SEO, publication, and acquisition contracts.

---

### Task 1: Freeze the Live Public Baseline

**Files:**
- Create: `tests/fixtures/mcp-integration-public-baseline.json`
- Create: `tests/mcp-integration-public-baseline.test.ts`
- Test: `tests/mcp-integration-public-baseline.test.ts`

**Interfaces:**
- Consumes: current `getIntegrationCopy`, `getMcpCompatibilityEvidence`, `isMcpPublicSourcePath`, `getMcpPublicationState`, and current client-action configuration.
- Produces: an immutable semantic baseline used unchanged by every later task in this plan.

- [ ] **Step 1: Add the exact baseline fixture**

Create `tests/fixtures/mcp-integration-public-baseline.json` with this structure and exact values:

```json
{
  "schemaVersion": 1,
  "publicConcepts": [
    "/mcp",
    "/docs/mcp",
    "/integrations/chatgpt",
    "/integrations/claude",
    "/integrations/codex"
  ],
  "localizedUrls": {
    "/mcp": {
      "en": "https://maxvideoai.com/mcp",
      "fr": "https://maxvideoai.com/fr/mcp",
      "es": "https://maxvideoai.com/es/mcp"
    },
    "/docs/mcp": {
      "en": "https://maxvideoai.com/docs/mcp",
      "fr": "https://maxvideoai.com/fr/docs/mcp",
      "es": "https://maxvideoai.com/es/docs/mcp"
    },
    "/integrations/chatgpt": {
      "en": "https://maxvideoai.com/integrations/chatgpt",
      "fr": "https://maxvideoai.com/fr/integrations/chatgpt",
      "es": "https://maxvideoai.com/es/integraciones/chatgpt"
    },
    "/integrations/claude": {
      "en": "https://maxvideoai.com/integrations/claude",
      "fr": "https://maxvideoai.com/fr/integrations/claude",
      "es": "https://maxvideoai.com/es/integraciones/claude"
    },
    "/integrations/codex": {
      "en": "https://maxvideoai.com/integrations/codex",
      "fr": "https://maxvideoai.com/fr/integrations/codex",
      "es": "https://maxvideoai.com/es/integraciones/codex"
    }
  },
  "clients": ["claude", "chatgpt", "codex"],
  "hosts": {
    "claudeDesktop": { "client": "claude", "status": "verified" },
    "claudeCode": { "client": "claude", "status": "not-run" },
    "chatgptWeb": { "client": "chatgpt", "status": "not-run" },
    "codexCli": { "client": "codex", "status": "verified" }
  },
  "deepLinks": {
    "claude": { "deepLinkEnabled": false, "deepLink": null },
    "chatgpt": { "deepLinkEnabled": false, "deepLink": null },
    "codex": { "deepLinkEnabled": false, "deepLink": null }
  },
  "integrationCopy": {
    "en": {
      "claude": { "label": "Claude", "backHref": "/mcp" },
      "chatgpt": { "label": "ChatGPT", "backHref": "/mcp" },
      "codex": { "label": "Codex", "backHref": "/mcp" }
    },
    "fr": {
      "claude": { "label": "Claude", "backHref": "/fr/mcp" },
      "chatgpt": { "label": "ChatGPT", "backHref": "/fr/mcp" },
      "codex": { "label": "Codex", "backHref": "/fr/mcp" }
    },
    "es": {
      "claude": { "label": "Claude", "backHref": "/es/mcp" },
      "chatgpt": { "label": "ChatGPT", "backHref": "/es/mcp" },
      "codex": { "label": "Codex", "backHref": "/es/mcp" }
    }
  }
}
```

- [ ] **Step 2: Write the failing cross-surface contract**

Create `tests/mcp-integration-public-baseline.test.ts`. Import the fixture and assert:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import baseline from './fixtures/mcp-integration-public-baseline.json';
import actionFlags from '../frontend/config/mcp-client-actions.json';
import { getMcpPublicationState, isMcpPublicSourcePath } from '../frontend/lib/mcp-publication';

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
```

- [ ] **Step 3: Run the new test against the current implementation**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-integration-public-baseline.test.ts
```

Expected: 3 tests pass. If this fails before migration, correct the fixture or assertion to match the current public implementation; do not change production code.

- [ ] **Step 4: Run the existing baseline suite**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/mcp-host-proof.test.ts \
  tests/mcp-marketing-copy.test.ts \
  tests/mcp-marketing-visual-contract.test.ts \
  tests/mcp-seo-review-remediation.test.ts \
  tests/mcp-marketing-route-architecture.test.ts \
  tests/mcp-acquisition-attribution.test.ts \
  tests/mcp-acquisition-strategy.test.ts \
  tests/mcp-seo-signals.test.ts \
  tests/mcp-publication.test.ts \
  tests/mcp-integration-public-baseline.test.ts
```

Expected: the existing 82 tests plus the 3 new baseline tests pass.

- [ ] **Step 5: Commit the immutable baseline**

```bash
git add tests/fixtures/mcp-integration-public-baseline.json tests/mcp-integration-public-baseline.test.ts
git commit -m "test: freeze MCP integration public baseline"
```

### Task 2: Add the Validated Integration Registry

**Files:**
- Create: `frontend/config/mcp-integrations.json`
- Create: `frontend/lib/mcp-integration-registry.ts`
- Create: `tests/mcp-integration-registry.test.ts`
- Test: `tests/mcp-integration-registry.test.ts`

**Interfaces:**
- Consumes: no application modules; the parser consumes only the authored JSON document.
- Produces: `McpIntegrationId`, `McpHostId`, `McpIntegrationRecord`, `McpHostRecord`, `getMcpIntegration`, `getMcpHost`, `getMcpIntegrationIds`, `getMcpVisibleIntegrationIds`, `getMcpIntegrationLabel`, `getMcpPublicIntegrationPaths`, `getMcpClientActionConfig`, and `isEnabledMcpAcquisitionClient`.

- [ ] **Step 1: Write registry validation tests first**

Create `tests/mcp-integration-registry.test.ts` with tests that require:

```ts
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
        hosts: ['missingHost']
      }
    },
    hosts: {}
  }), /missingHost/);
});
```

- [ ] **Step 2: Run the test and confirm the registry module is missing**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-integration-registry.test.ts
```

Expected: FAIL because `frontend/lib/mcp-integration-registry.ts` does not exist.

- [ ] **Step 3: Add the authored registry with exact existing facts**

Create `frontend/config/mcp-integrations.json` with schema version `1`, integrations ordered Claude, ChatGPT, Codex, and hosts ordered Claude Desktop, Claude Code, ChatGPT web, Codex CLI. Use these exact records:

```json
{
  "schemaVersion": 1,
  "integrations": {
    "claude": {
      "label": "Claude",
      "category": "assistant",
      "displayOrder": 10,
      "englishPath": "/integrations/claude",
      "site": { "publication": "live", "indexable": true },
      "acquisition": { "enabled": true, "key": "claude" },
      "installation": {
        "directMcp": "available",
        "package": "unavailable",
        "deepLinkEnabled": false,
        "deepLink": null
      },
      "store": {
        "target": "anthropic-connectors-directory",
        "status": "policy_blocked"
      },
      "hosts": ["claudeDesktop", "claudeCode"]
    },
    "chatgpt": {
      "label": "ChatGPT",
      "category": "assistant",
      "displayOrder": 20,
      "englishPath": "/integrations/chatgpt",
      "site": { "publication": "live", "indexable": true },
      "acquisition": { "enabled": true, "key": "chatgpt" },
      "installation": {
        "directMcp": "available",
        "package": "unavailable",
        "deepLinkEnabled": false,
        "deepLink": null
      },
      "store": {
        "target": "openai-plugin-directory",
        "status": "policy_blocked"
      },
      "hosts": ["chatgptWeb"]
    },
    "codex": {
      "label": "Codex",
      "category": "autonomous-agent",
      "displayOrder": 30,
      "englishPath": "/integrations/codex",
      "site": { "publication": "live", "indexable": true },
      "acquisition": { "enabled": true, "key": "codex" },
      "installation": {
        "directMcp": "available",
        "package": "available",
        "deepLinkEnabled": false,
        "deepLink": null
      },
      "store": {
        "target": "openai-plugin-directory",
        "status": "policy_blocked"
      },
      "hosts": ["codexCli"]
    }
  },
  "hosts": {
    "claudeDesktop": {
      "integration": "claude",
      "label": "Claude Desktop",
      "evidence": {
        "kind": "hosted-checkpoint",
        "status": "verified",
        "lastChecked": "2026-08-27",
        "source": "docs/operations/mcp-host-compatibility-matrix.md"
      }
    },
    "claudeCode": {
      "integration": "claude",
      "label": "Claude Code",
      "evidence": {
        "kind": "hosted-checkpoint",
        "status": "not-run",
        "lastChecked": "2026-08-27",
        "source": "docs/operations/mcp-host-compatibility-matrix.md"
      }
    },
    "chatgptWeb": {
      "integration": "chatgpt",
      "label": "ChatGPT",
      "evidence": {
        "kind": "hosted-checkpoint",
        "status": "not-run",
        "lastChecked": "2026-08-27",
        "source": "docs/operations/mcp-host-compatibility-matrix.md"
      }
    },
    "codexCli": {
      "integration": "codex",
      "label": "Codex CLI",
      "evidence": {
        "kind": "hosted-checkpoint",
        "status": "verified",
        "lastChecked": "2026-08-27",
        "source": "docs/operations/mcp-host-compatibility-matrix.md"
      }
    }
  }
}
```

- [ ] **Step 4: Implement the browser-safe parser and accessors**

Create `frontend/lib/mcp-integration-registry.ts`. Derive identifiers from the JSON keys so adding a later registry entry does not require editing a separate union:

```ts
import registryJson from '@/config/mcp-integrations.json';

export type McpIntegrationId = keyof typeof registryJson.integrations;
export type McpHostId = keyof typeof registryJson.hosts;
export type McpSitePublication = 'live' | 'preview_noindex' | 'hidden';
export type McpHostEvidenceStatus = 'verified' | 'tested_with_limits' | 'not-run';
export type McpStoreStatus =
  | 'not_applicable'
  | 'eligible'
  | 'preparing'
  | 'submitted'
  | 'listed'
  | 'policy_blocked';

export type McpIntegrationRecord = {
  id: McpIntegrationId;
  label: string;
  category: 'assistant' | 'autonomous-agent' | 'development' | 'automation' | 'enterprise';
  displayOrder: number;
  englishPath: `/integrations/${string}`;
  site: { publication: McpSitePublication; indexable: boolean };
  acquisition: { enabled: boolean; key: string };
  installation: {
    directMcp: 'available' | 'unavailable';
    package: 'available' | 'unavailable';
    deepLinkEnabled: boolean;
    deepLink: string | null;
  };
  store: { target: string; status: McpStoreStatus };
  hosts: McpHostId[];
};

export type McpHostRecord = {
  id: McpHostId;
  integration: McpIntegrationId;
  label: string;
  evidence: {
    kind: 'hosted-checkpoint';
    status: McpHostEvidenceStatus;
    lastChecked: string;
    source: string;
  };
};
```

`parseMcpIntegrationRegistry(value)` must reject non-records, unsupported schema versions, empty integration sets, duplicate `displayOrder` values, duplicate `englishPath` values, invalid enums, `indexable: true` when publication is not `live`, enabled deep links without an absolute HTTPS URL, acquisition keys that differ from their registry key, missing host references, hosts owned by another integration, and orphan host records. Return frozen arrays/records or readonly projections so consumers cannot mutate module state.

Implement these exact accessors:

```ts
export function getMcpIntegrationIds(): McpIntegrationId[];
export function getMcpVisibleIntegrationIds(): McpIntegrationId[];
export function getMcpIntegration(id: McpIntegrationId): McpIntegrationRecord;
export function getMcpIntegrationLabel(id: McpIntegrationId): string;
export function getMcpHost(id: McpHostId): McpHostRecord;
export function getMcpPublicIntegrationPaths(): Array<`/integrations/${string}`>;
export function getMcpClientActionConfig(id: McpIntegrationId): {
  deepLinkEnabled: boolean;
  deepLink: string | null;
};
export function isEnabledMcpAcquisitionClient(value: unknown): value is McpIntegrationId;
```

`getMcpIntegrationIds()` sorts by `displayOrder`. `getMcpPublicIntegrationPaths()` returns only entries with `site.publication === 'live'` and `site.indexable === true`. `isEnabledMcpAcquisitionClient()` requires an exact string key whose record has `acquisition.enabled === true`.

`getMcpVisibleIntegrationIds()` returns only entries whose site publication is
not `hidden`. This prevents a future evidence-only registry entry from appearing
on the public hub before its own publication gate opens.

- [ ] **Step 5: Run registry and baseline tests**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/mcp-integration-registry.test.ts \
  tests/mcp-integration-public-baseline.test.ts
```

Expected: all tests pass without changing a current consumer.

- [ ] **Step 6: Commit the registry foundation**

```bash
git add frontend/config/mcp-integrations.json frontend/lib/mcp-integration-registry.ts tests/mcp-integration-registry.test.ts
git commit -m "feat: add MCP integration registry"
```

### Task 3: Migrate Compatibility, Actions, and Acquisition Allowlists

**Files:**
- Modify: `frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-page-types.ts:1-12`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-compatibility.ts:1-61`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/mcp/_components/McpConnectActions.client.tsx:5-33`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/mcp/_components/McpClientActions.tsx:1-70`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/integrations/_components/IntegrationConversationPreview.tsx:63-90`
- Modify: `frontend/lib/mcp-acquisition.ts:26-80`
- Delete: `frontend/config/mcp-compatibility.json`
- Delete: `frontend/config/mcp-client-actions.json`
- Modify: `tests/mcp-integration-public-baseline.test.ts`
- Modify: `tests/mcp-marketing-route-architecture.test.ts:381-427`
- Modify: `tests/mcp-acquisition-attribution.test.ts:17-20,463-501`
- Test: `tests/mcp-integration-public-baseline.test.ts`
- Test: `tests/mcp-integration-registry.test.ts`
- Test: `tests/mcp-marketing-route-architecture.test.ts`
- Test: `tests/mcp-acquisition-attribution.test.ts`

**Interfaces:**
- Consumes: registry accessors from Task 2.
- Produces: the existing public compatibility and acquisition interfaces with registry-derived identifiers and facts, plus `getMcpCompatibilityClientEvidence(client)` for one exact page.

- [ ] **Step 1: Update tests to require registry ownership**

Change architecture tests so they require `frontend/config/mcp-integrations.json` and `frontend/lib/mcp-integration-registry.ts`, reject imports of the two retired JSON files, and assert that compatibility dates and states come from `getMcpHost`.

Change the deep-link test to use:

```ts
const { getMcpClientActionConfig, getMcpIntegrationIds } = await import(
  '../frontend/lib/mcp-integration-registry.ts'
);
assert.deepEqual(
  Object.fromEntries(getMcpIntegrationIds().map((id) => [id, getMcpClientActionConfig(id)])),
  baseline.deepLinks,
);
```

Make the same import replacement in
`tests/mcp-integration-public-baseline.test.ts`: remove its direct import of
`mcp-client-actions.json`, build the three-key object through
`getMcpIntegrationIds()` and `getMcpClientActionConfig()`, and compare that
projection with the unchanged baseline fixture.

Add acquisition assertions that `isEnabledMcpAcquisitionClient` accepts exactly `claude`, `chatgpt`, and `codex`, and rejects `openclaw`, `n8n`, `other`, empty strings, arrays, and objects.

- [ ] **Step 2: Run focused tests and verify they fail on old ownership**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/mcp-marketing-route-architecture.test.ts \
  tests/mcp-acquisition-attribution.test.ts
```

Expected: FAIL because current modules still import `mcp-compatibility.json` and `mcp-client-actions.json`.

- [ ] **Step 3: Make page types registry-derived without breaking names**

At the top of `mcp-page-types.ts`, replace the authored unions with aliases:

```ts
import type { McpHostId, McpIntegrationId } from '@/lib/mcp-integration-registry';

export type McpClientId = McpIntegrationId;
export type McpCompatibilityHostId = McpHostId;
```

Do not rename existing component props in this task. Change the hub's
`trust.compatibility.statuses` field to
`Partial<Record<McpCompatibilityHostId, string>>`; all four current host keys
remain required by tests, but a future hidden host no longer forces unrelated
hub copy to change before publication.

- [ ] **Step 4: Project compatibility from the registry**

Refactor `mcp-compatibility.ts` to call `getMcpIntegrationIds`, `getMcpIntegration`, and `getMcpHost`. Preserve the exported types and returned shape:

```ts
export function getMcpCompatibilityEvidence(): McpCompatibilityEvidence {
  const clients = Object.fromEntries(
    getMcpVisibleIntegrationIds().map((client) => {
      const integration = getMcpIntegration(client);
      return [
        client,
        {
          client,
          hosts: integration.hosts.map((id) => {
            const host = getMcpHost(id);
            return {
              id,
              client,
              hostLabel: host.label,
              lastChecked: host.evidence.lastChecked,
              status: host.evidence.status,
            };
          }),
        },
      ];
    }),
  ) as McpCompatibilityEvidence['clients'];

  const hosts = Object.values(clients)
    .filter((client): client is McpCompatibilityClientEvidence => Boolean(client))
    .flatMap((client) => client.hosts);
  return {
    clients,
    evidenceKind: 'hosted-checkpoint',
    lastChecked: hosts.map((host) => host.lastChecked).sort().at(-1) ?? '',
    sourceEvidence: getMcpHost(hosts[0]!.id).evidence.source,
  };
}
```

Type `clients` as `Partial<Record<McpClientId,
McpCompatibilityClientEvidence>>`, keep `formatMcpCheckpointDate` unchanged,
and allow `tested_with_limits` in the host status type even though no current
record uses it. Add this exact page accessor so an explicit preview route can
read its evidence without publishing the integration on the hub:

```ts
export function getMcpCompatibilityClientEvidence(
  client: McpClientId,
): McpCompatibilityClientEvidence;
```

- [ ] **Step 5: Read client action flags through the registry**

In `McpConnectActions.client.tsx`, remove the JSON import and local cast. Replace it with:

```ts
import { getMcpClientActionConfig } from '@/lib/mcp-integration-registry';

function resolvedActions(actions: McpClientActionCopy[]): McpClientActionCopy[] {
  return actions.map((action) => {
    const flag = getMcpClientActionConfig(action.client);
    return flag.deepLinkEnabled && flag.deepLink
      ? { ...action, href: flag.deepLink }
      : action;
  });
}
```

Use the same accessor in `trackConnectAction`. Do not change the navigation timeout, GA event names, signed acquisition request, clipboard behavior, or fallback guide hrefs.

Replace the closed `clientLabel` conditionals in
`McpConnectActions.client.tsx` and `IntegrationConversationPreview.tsx` with
`getMcpIntegrationLabel(client)`. In `McpClientActions.tsx`, change
`CLIENT_MARKS` to a `Partial<Record<McpClientId, ...>>` and return `null` from
the individual action renderer when no reviewed mark exists. Retain tests that
all three currently rendered hub actions have their existing marks; this makes
a future hidden registry entry compile without fabricating or publishing a
brand asset.

- [ ] **Step 6: Derive the signed acquisition allowlist from explicitly enabled registry entries**

In `frontend/lib/mcp-acquisition.ts`, import `isEnabledMcpAcquisitionClient` and `McpIntegrationId`, alias `McpAcquisitionClient = McpIntegrationId`, and replace the three-value condition inside `isLandingAcquisition` with:

```ts
isEnabledMcpAcquisitionClient(record.client)
```

Do not relax exact-key validation, request byte limits, HMAC validation, cookie scope, version checks, or direct-MCP fallback classification.

- [ ] **Step 7: Remove the retired configuration files and run focused tests**

Delete `frontend/config/mcp-compatibility.json` and `frontend/config/mcp-client-actions.json`, then run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/mcp-integration-registry.test.ts \
  tests/mcp-integration-public-baseline.test.ts \
  tests/mcp-marketing-route-architecture.test.ts \
  tests/mcp-acquisition-attribution.test.ts
```

Expected: all tests pass; the baseline fixture still reports the exact existing states.

- [ ] **Step 8: Commit the factual-owner migration**

```bash
git add frontend/config/mcp-integrations.json \
  frontend/lib/mcp-integration-registry.ts \
  frontend/lib/mcp-acquisition.ts \
  'frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-page-types.ts' \
  'frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-compatibility.ts' \
  'frontend/app/(localized)/[locale]/(marketing)/mcp/_components/McpConnectActions.client.tsx' \
  'frontend/app/(localized)/[locale]/(marketing)/mcp/_components/McpClientActions.tsx' \
  'frontend/app/(localized)/[locale]/(marketing)/integrations/_components/IntegrationConversationPreview.tsx' \
  tests/mcp-marketing-route-architecture.test.ts \
  tests/mcp-acquisition-attribution.test.ts \
  frontend/config/mcp-compatibility.json \
  frontend/config/mcp-client-actions.json
git commit -m "refactor: centralize MCP integration facts"
```

### Task 4: Split Localized Integration Copy into Focused Owners

**Files:**
- Create: `frontend/app/(localized)/[locale]/(marketing)/integrations/_content/types.ts`
- Create: `frontend/app/(localized)/[locale]/(marketing)/integrations/_content/shared.ts`
- Create: `frontend/app/(localized)/[locale]/(marketing)/integrations/_content/en.ts`
- Create: `frontend/app/(localized)/[locale]/(marketing)/integrations/_content/fr.ts`
- Create: `frontend/app/(localized)/[locale]/(marketing)/integrations/_content/es.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/integrations/_lib/integration-copy.ts:1-726`
- Modify: `tests/mcp-marketing-route-architecture.test.ts:88-121`
- Modify: `tests/mcp-marketing-copy.test.ts:170-572`
- Test: `tests/mcp-integration-public-baseline.test.ts`
- Test: `tests/mcp-marketing-copy.test.ts`
- Test: `tests/mcp-marketing-route-architecture.test.ts`

**Interfaces:**
- Consumes: registry-derived `McpClientId` and `McpCompatibilityHostId`, existing plugin release constants, MCP production resource URL, and locale pathnames.
- Produces: the unchanged `IntegrationPageCopy` type and `getIntegrationCopy(locale, client)` facade.

- [ ] **Step 1: Strengthen architecture and locale-parity tests before moving code**

Add assertions that:

- `integration-copy.ts` is a dispatcher below 80 lines;
- all five `_content` modules exist;
- `en.ts`, `fr.ts`, and `es.ts` each export a builder for every current client;
- no route imports an `_content` module directly;
- `getIntegrationCopy` rejects no supported locale/client pair;
- all nine results retain the existing client, label, metadata, hero, compatibility, host guide, OAuth, workflow, reference, troubleshooting, disconnect, and support fields;
- French and Spanish results contain no empty editorial strings and use their localized MCP/support destinations.

Keep the existing detailed marketing-copy assertions; do not replace them with weaker shape checks.

- [ ] **Step 2: Run copy and architecture tests to verify the line-cap assertion fails**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/mcp-marketing-copy.test.ts \
  tests/mcp-marketing-route-architecture.test.ts \
  tests/mcp-integration-public-baseline.test.ts
```

Expected: FAIL because `integration-copy.ts` is 726 lines and `_content` does not exist.

- [ ] **Step 3: Move types without changing their shapes**

Move `IntegrationSetupValue`, `IntegrationStepProof`, `IntegrationHostGuide`, and `IntegrationPageCopy` to `_content/types.ts`. Export all four types. Keep `client: McpClientId` and `hostId: McpCompatibilityHostId`. Widen `clientLabel` from the closed three-label union to `string`, and change `compatibility.statuses` to `Partial<Record<McpCompatibilityHostId, string>>`. These are type-only scalability changes; all current returned labels and four host-status strings remain byte-identical and required by tests.

Make `integration-copy.ts` re-export `IntegrationPageCopy` so existing imports continue to compile:

```ts
export type { IntegrationPageCopy } from '../_content/types';
```

- [ ] **Step 4: Move structural helpers to the shared module**

Move the current `localized`, `installInstruction`, and `installAction`
implementations byte-for-byte into `_content/shared.ts`. Replace the closed
`label` conditional with `getMcpIntegrationLabel(client)` from the registry.
Export the helpers as:

```ts
export function localizedIntegrationPath(locale: AppLocale, path: string): string;
export function getIntegrationLabel(client: McpClientId): IntegrationPageCopy['clientLabel'];
export function getIntegrationInstallInstruction(
  locale: AppLocale,
  hostId: McpCompatibilityHostId,
): string;
export function getIntegrationInstallAction(
  locale: AppLocale,
  clientLabel: IntegrationPageCopy['clientLabel'],
): IntegrationPageCopy['setup']['installAction'];
```

Renaming occurs only at the function boundary. Returned strings and branching stay unchanged.

- [ ] **Step 5: Move English copy to its locale owner**

Move `englishGuides` and `englishCopy` into `_content/en.ts`. Rename and export them as:

```ts
export function buildEnglishIntegrationCopy(client: McpClientId): IntegrationPageCopy;
```

Keep every string, command, setup value, array order, and conditional branch unchanged. Use the shared helpers from Step 4.

- [ ] **Step 6: Move French and Spanish copy to locale owners**

Move `frenchGuides` plus `frenchCopy` into `_content/fr.ts`, and `spanishGuides` plus `spanishCopy` into `_content/es.ts`. Export:

```ts
export function buildFrenchIntegrationCopy(client: McpClientId): IntegrationPageCopy;
export function buildSpanishIntegrationCopy(client: McpClientId): IntegrationPageCopy;
```

Preserve the current calls to the English builder as structural bases during this parity-only extraction. Do not rewrite or translate copy in this task. The tests continue to require complete French and Spanish output, so an omitted override cannot silently pass as empty content.

- [ ] **Step 7: Reduce the original module to a stable dispatcher**

Replace `integration-copy.ts` with:

```ts
import type { AppLocale } from '@/i18n/locales';
import type { McpClientId } from '../../mcp/_lib/mcp-page-types';
import { buildEnglishIntegrationCopy } from '../_content/en';
import { buildFrenchIntegrationCopy } from '../_content/fr';
import { buildSpanishIntegrationCopy } from '../_content/es';
import type { IntegrationPageCopy } from '../_content/types';

export type { IntegrationPageCopy } from '../_content/types';

export function getIntegrationCopy(
  locale: AppLocale,
  client: McpClientId,
): IntegrationPageCopy {
  if (locale === 'fr') return buildFrenchIntegrationCopy(client);
  if (locale === 'es') return buildSpanishIntegrationCopy(client);
  return buildEnglishIntegrationCopy(client);
}
```

- [ ] **Step 8: Run parity tests and inspect the diff for copy changes**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/mcp-integration-public-baseline.test.ts \
  tests/mcp-marketing-copy.test.ts \
  tests/mcp-marketing-visual-contract.test.ts \
  tests/mcp-marketing-route-architecture.test.ts
git diff --word-diff=porcelain -- \
  'frontend/app/(localized)/[locale]/(marketing)/integrations/_content' \
  'frontend/app/(localized)/[locale]/(marketing)/integrations/_lib/integration-copy.ts'
```

Expected: all tests pass. Review the word diff to confirm all editorial text was moved, not rewritten.

- [ ] **Step 9: Commit the copy ownership split**

```bash
git add 'frontend/app/(localized)/[locale]/(marketing)/integrations/_content' \
  'frontend/app/(localized)/[locale]/(marketing)/integrations/_lib/integration-copy.ts' \
  tests/mcp-marketing-copy.test.ts \
  tests/mcp-marketing-route-architecture.test.ts
git commit -m "refactor: split MCP integration copy by locale"
```

### Task 5: Add a Pure Integration Page-Data Builder

**Files:**
- Create: `frontend/app/(localized)/[locale]/(marketing)/integrations/_lib/integration-page-data.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/integrations/chatgpt/page.tsx:1-54`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/integrations/claude/page.tsx:1-62`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/integrations/codex/page.tsx:1-54`
- Modify: `tests/mcp-marketing-route-architecture.test.ts:57-121,259-318`
- Test: `tests/mcp-marketing-route-architecture.test.ts`
- Test: `tests/mcp-integration-public-baseline.test.ts`

**Interfaces:**
- Consumes: `getMcpIntegration`, `getIntegrationCopy`, `getMcpCompatibilityEvidence`, `getMcpHostProof`, metadata builders, JSON-LD builders, and the current global `McpPublicationState`.
- Produces: `buildIntegrationMetadata(args)` and `buildIntegrationPageData(args)` for explicit route owners.

- [ ] **Step 1: Add builder contract tests**

Add tests that call the builder for all nine locale/client pairs and assert:

```ts
const pageData = buildIntegrationPageData({ client: 'claude', locale: 'fr', publication });
assert.equal(pageData.copy.client, 'claude');
assert.equal(pageData.compatibility.client, 'claude');
assert.equal(pageData.canonicalUrl, 'https://maxvideoai.com/fr/integrations/claude');
assert.equal(pageData.hostProof?.host, 'claude');
assert.ok(pageData.application);
assert.equal(pageData.breadcrumb.itemListElement[1]?.item, pageData.canonicalUrl);
```

For ChatGPT, preserve the existing `application === null` JSON-LD boundary. For Codex and ChatGPT, preserve `hostProof === null`. Assert each route file declares only its client constant, publication helper, metadata export, and render orchestration, and stays below 45 lines after migration.

- [ ] **Step 2: Run the route architecture test and confirm the builder is missing**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-marketing-route-architecture.test.ts
```

Expected: FAIL because `integration-page-data.ts` does not exist.

- [ ] **Step 3: Implement the page-data interfaces**

Create `integration-page-data.ts` with these exports:

```ts
export type BuildIntegrationArgs = {
  client: McpClientId;
  locale: AppLocale;
  publication: McpPublicationState;
};

export function buildIntegrationMetadata({
  client,
  locale,
  publication,
}: BuildIntegrationArgs): Metadata;

export function buildIntegrationPageData({
  client,
  locale,
  publication,
}: BuildIntegrationArgs): {
  application: ReturnType<typeof buildIntegrationWebApplicationJsonLd>;
  breadcrumb: ReturnType<typeof buildIntegrationBreadcrumbJsonLd>;
  canonicalUrl: string;
  compatibility: McpCompatibilityClientEvidence;
  copy: IntegrationPageCopy;
  hostProof: McpHostProof | null;
};
```

Resolve `englishPath` from `getMcpIntegration(client)` rather than hard-coding
it in the builder. Resolve compatibility through
`getMcpCompatibilityClientEvidence(client)` rather than indexing the public hub
projection. Before returning, require a non-empty localized compatibility
status for every host guide in the page; throw an error naming the missing
`client`, `locale`, and `hostId` instead of rendering an empty status. Preserve
the current title, description, image alt, canonical builder, robots, and
JSON-LD behavior.

- [ ] **Step 4: Migrate the three explicit routes**

Each route keeps `revalidate = 3600`, the global publication helper, `notFound()` when `renderPublicPage` is false, and its named default export. Use this ChatGPT shape, substituting only the constant and component function name in the other routes:

```tsx
const CLIENT = 'chatgpt' as const;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildIntegrationMetadata({ client: CLIENT, locale, publication: publicationState() });
}

export default async function ChatGptIntegrationPage({ params }: PageProps) {
  const { locale } = await params;
  const publication = publicationState();
  if (!publication.renderPublicPage) notFound();
  const data = buildIntegrationPageData({ client: CLIENT, locale, publication });
  return (
    <>
      <IntegrationPageView
        compatibility={data.compatibility}
        copy={data.copy}
        hostProof={data.hostProof}
        locale={locale}
        publication={publication}
      />
      <IntegrationJsonLdScripts application={data.application} breadcrumb={data.breadcrumb} />
    </>
  );
}
```

Do not replace the three explicit route files with a dynamic route.

- [ ] **Step 5: Run metadata, route, copy, and baseline tests**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/mcp-integration-public-baseline.test.ts \
  tests/mcp-marketing-route-architecture.test.ts \
  tests/mcp-marketing-copy.test.ts \
  tests/mcp-seo-signals.test.ts
```

Expected: all tests pass with the same canonical, robots, JSON-LD, and copy output.

- [ ] **Step 6: Commit the route orchestration migration**

```bash
git add 'frontend/app/(localized)/[locale]/(marketing)/integrations/_lib/integration-page-data.ts' \
  'frontend/app/(localized)/[locale]/(marketing)/integrations/chatgpt/page.tsx' \
  'frontend/app/(localized)/[locale]/(marketing)/integrations/claude/page.tsx' \
  'frontend/app/(localized)/[locale]/(marketing)/integrations/codex/page.tsx' \
  tests/mcp-marketing-route-architecture.test.ts
git commit -m "refactor: centralize MCP integration page data"
```

### Task 6: Make Public-Path and Sitemap Ownership Registry-Aware

**Files:**
- Modify: `frontend/lib/mcp-publication.ts:21-37`
- Modify: `frontend/lib/sitemap/route-discovery.ts:1-45`
- Modify: `frontend/next-sitemap.config.js:1-30,317-340`
- Modify: `frontend/lib/analytics/journey.ts:82-89`
- Modify: `tests/mcp-publication.test.ts:1-75`
- Modify: `tests/mcp-seo-signals.test.ts:103-174`
- Modify: `tests/mcp-seo-review-remediation.test.ts:1-135`
- Modify: `tests/mcp-acquisition-attribution.test.ts:463-501`
- Test: `tests/mcp-publication.test.ts`
- Test: `tests/mcp-seo-signals.test.ts`
- Test: `tests/mcp-seo-review-remediation.test.ts`

**Interfaces:**
- Consumes: `getMcpPublicIntegrationPaths()` in TypeScript and `mcp-integrations.json` in the CommonJS sitemap build.
- Produces: registry-derived integration path sets while preserving `/mcp`, `/docs/mcp`, all current localized routes, and exactly fifteen sitemap owners.

- [ ] **Step 1: Add path-derivation assertions**

Update publication and sitemap tests to assert:

```ts
assert.deepEqual(getMcpPublicIntegrationPaths(), [
  '/integrations/claude',
  '/integrations/chatgpt',
  '/integrations/codex',
]);
```

Retain the exact fifteen absolute localized URLs already asserted by the existing suites. Add a negative test proving a registry entry with `preview_noindex` would not join sitemap paths while the three live entries remain present.

- [ ] **Step 2: Run the focused tests before migration**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/mcp-publication.test.ts \
  tests/mcp-seo-signals.test.ts \
  tests/mcp-seo-review-remediation.test.ts
```

Expected: new source-ownership assertions fail because integration paths are still hard-coded.

- [ ] **Step 3: Derive TypeScript public-path sets**

In `mcp-publication.ts`, build the set from fixed hub/documentation paths plus registry paths:

```ts
const MCP_PUBLIC_SOURCE_PATHS = new Set([
  '/mcp',
  '/docs/mcp',
  ...getMcpPublicIntegrationPaths(),
  ...getMcpPublicIntegrationPaths().map((path) => path.replace('/integrations/', '/integraciones/')),
]);
```

Keep normalization and locale-prefix removal unchanged.

In `route-discovery.ts`, replace the three hard-coded integration entries with `...getMcpPublicIntegrationPaths()` while retaining `/mcp` and `/docs/mcp`.

- [ ] **Step 4: Derive next-sitemap paths from JSON without importing TypeScript**

In `frontend/next-sitemap.config.js`, require `./config/mcp-integrations.json` and define:

```js
const MCP_PUBLIC_INDEXABLE_PATHS = [
  '/mcp',
  ...Object.values(mcpIntegrations.integrations)
    .filter((integration) => integration.site.publication === 'live' && integration.site.indexable === true)
    .sort((left, right) => left.displayOrder - right.displayOrder)
    .map((integration) => integration.englishPath),
  '/docs/mcp',
];
```

Do not alter `mcpIndexable`, locale localization, alternate generation, API-host exclusion, or private-path exclusions.

- [ ] **Step 5: Make analytics landing sanitization consume current registry paths**

Import `getMcpPublicIntegrationPaths` into `frontend/lib/analytics/journey.ts` and replace its three integration literals inside `SAFE_MARKETING_LANDING_SURFACES` with the spread result. Do not change analytics event schemas or historical surface names.

- [ ] **Step 6: Run sitemap, SEO, acquisition, and baseline tests**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/mcp-integration-public-baseline.test.ts \
  tests/mcp-publication.test.ts \
  tests/mcp-seo-signals.test.ts \
  tests/mcp-seo-review-remediation.test.ts \
  tests/mcp-acquisition-attribution.test.ts
```

Expected: all tests pass; sitemap fixtures still contain exactly 15 current localized MCP owners.

- [ ] **Step 7: Commit registry-aware path ownership**

```bash
git add frontend/lib/mcp-publication.ts \
  frontend/lib/sitemap/route-discovery.ts \
  frontend/next-sitemap.config.js \
  frontend/lib/analytics/journey.ts \
  tests/mcp-publication.test.ts \
  tests/mcp-seo-signals.test.ts \
  tests/mcp-seo-review-remediation.test.ts \
  tests/mcp-acquisition-attribution.test.ts
git commit -m "refactor: derive MCP public paths from registry"
```

### Task 7: Document Ownership and Run the Full Migration Gate

**Files:**
- Create: `docs/engineering/mcp-integration-registry.md`
- Modify: `AGENTS.md:14-28`
- Modify: `docs/engineering/llm-working-guide.md:5-20`
- Modify: `docs/operations/mcp-host-compatibility-matrix.md:1-70`
- Modify: `tests/mcp-marketing-route-architecture.test.ts`
- Test: all MCP marketing, SEO, publication, and acquisition contracts.

**Interfaces:**
- Consumes: the completed registry and migrated route/copy ownership.
- Produces: contributor instructions and final evidence that Lots A-B are complete without a public downgrade.

- [ ] **Step 1: Add an architecture test for documentation ownership**

Require `docs/engineering/mcp-integration-registry.md` and assert it contains the exact owners:

```text
frontend/config/mcp-integrations.json
frontend/lib/mcp-integration-registry.ts
docs/operations/mcp-host-compatibility-matrix.md
docs/marketing/mcp-directory-submissions.md
```

Also assert the guide states that external store state cannot disable the direct MCP endpoint and that existing `verified` evidence cannot be weakened without a newer recorded checkpoint.

- [ ] **Step 2: Run the architecture test and confirm the guide is missing**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-marketing-route-architecture.test.ts
```

Expected: FAIL because `docs/engineering/mcp-integration-registry.md` does not exist.

- [ ] **Step 3: Write the maintenance guide**

Create `docs/engineering/mcp-integration-registry.md` with these sections:

1. purpose and source-of-truth boundary;
2. registry field reference and independent state dimensions;
3. existing-public-surface non-regression floor;
4. how to add a hidden host record for evidence work;
5. how to enable acquisition explicitly;
6. how `live`, `preview_noindex`, and `hidden` affect routes and sitemap;
7. evidence update procedure tied to the operations matrix;
8. store update procedure tied to the directory-submission record;
9. strict EN/FR/ES content requirement;
10. focused and full verification commands;
11. rollback procedure that leaves the global MCP endpoint untouched.

State explicitly that the registry does not own model lists, prices, OAuth scopes, billing behavior, tool schemas, screenshots, or editorial copy.

- [ ] **Step 4: Link the guide from contributor entry points**

Add `docs/engineering/mcp-integration-registry.md` to the `AGENTS.md` guide map and to the LLM working guide's architecture references. Do not change unrelated contributor rules.

Add a short ownership note near the compatibility matrix introduction: facts rendered on marketing pages are projected from the registry, while detailed tested-host evidence remains owned by this matrix.

- [ ] **Step 5: Run the complete focused MCP suite**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/mcp-host-proof.test.ts \
  tests/mcp-marketing-copy.test.ts \
  tests/mcp-marketing-visual-contract.test.ts \
  tests/mcp-seo-review-remediation.test.ts \
  tests/mcp-marketing-route-architecture.test.ts \
  tests/mcp-acquisition-attribution.test.ts \
  tests/mcp-acquisition-strategy.test.ts \
  tests/mcp-seo-signals.test.ts \
  tests/mcp-publication.test.ts \
  tests/mcp-integration-public-baseline.test.ts \
  tests/mcp-integration-registry.test.ts
```

Expected: all current 82 tests and all newly added tests pass with 0 failures.

- [ ] **Step 6: Run repository verification gates**

Run:

```bash
npm --prefix frontend run lint
npm run lint:exposure
git diff --check
```

Expected: all commands exit 0. The repository currently requests Node 22.x; if the executing environment uses another Node major, record the engine warning separately and do not misreport it as a product regression.

- [ ] **Step 7: Build and smoke-test the fifteen public owners**

Run:

```bash
npm --prefix frontend run build
```

Then start the built app and request these representative route families in EN/FR/ES:

```text
/mcp
/fr/mcp
/es/mcp
/docs/mcp
/fr/docs/mcp
/es/docs/mcp
/integrations/chatgpt
/fr/integrations/chatgpt
/es/integraciones/chatgpt
/integrations/claude
/fr/integrations/claude
/es/integraciones/claude
/integrations/codex
/fr/integrations/codex
/es/integraciones/codex
```

For each response verify HTTP 200, indexable robots metadata, the expected canonical, three reciprocal alternates plus `x-default`, one marketing-layout main landmark, and no gated rewrite. Inspect the three integration families for unchanged installation actions and evidence labels.

- [ ] **Step 8: Confirm the Task 7 working diff is limited to documentation ownership**

Run:

```bash
git status --short
git diff --stat
git diff --check
```

Expected: only the Task 7 guide, contributor-document, compatibility-matrix,
and architecture-test changes are uncommitted, with no whitespace errors.

- [ ] **Step 9: Commit documentation and final verification ownership**

```bash
git add AGENTS.md \
  docs/engineering/llm-working-guide.md \
  docs/engineering/mcp-integration-registry.md \
  docs/operations/mcp-host-compatibility-matrix.md \
  tests/mcp-marketing-route-architecture.test.ts
git commit -m "docs: define MCP integration registry ownership"
```

- [ ] **Step 10: Confirm the completed implementation is clean and limited to Lots A-B**

Run:

```bash
git status --short
git diff --stat HEAD~7..HEAD
git diff --check HEAD~7..HEAD
rg -n "openclaw|n8n" frontend/config/mcp-integrations.json \
  'frontend/app/(localized)/[locale]/(marketing)/integrations' \
  frontend/lib/mcp-integration-registry.ts
```

Expected: no uncommitted files, no whitespace errors, and no OpenClaw or n8n
implementation in product code. References to those future lots are allowed
only in the approved spec or maintenance guide.

## Completion Boundary

Completing this plan proves only that the current ChatGPT, Claude, and Codex
surfaces were migrated without regression and that future integrations have a
safe factual registry boundary. It does not claim OpenClaw or n8n compatibility,
publish new pages, change store status, submit external packages, or authorize a
paid host-validation generation.
