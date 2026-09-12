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

type ParsedRegistry = {
  schemaVersion: 1;
  integrations: Readonly<Record<string, Readonly<McpIntegrationRecord>>>;
  hosts: Readonly<Record<string, Readonly<McpHostRecord>>>;
};

function record(value: unknown, context: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${context} must be an object`);
  }
  return value as Record<string, unknown>;
}

function string(value: unknown, context: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${context} must be a non-empty string`);
  return value;
}

function boolean(value: unknown, context: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${context} must be a boolean`);
  return value;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], context: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new Error(`${context} must be one of ${allowed.join(', ')}`);
  }
  return value as T;
}

function freezeDeep<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) freezeDeep(nested);
  }
  return value;
}

export function parseMcpIntegrationRegistry(value: unknown): ParsedRegistry {
  const root = record(value, 'MCP integration registry');
  if (root.schemaVersion !== 1) throw new Error('Unsupported MCP integration registry schema version');

  const rawIntegrations = record(root.integrations, 'integrations');
  const rawHosts = record(root.hosts, 'hosts');
  const integrationEntries = Object.entries(rawIntegrations);
  if (integrationEntries.length === 0) throw new Error('MCP integration registry must contain integrations');

  const orders = new Set<number>();
  const paths = new Set<string>();
  const referencedHosts = new Set<string>();
  const integrations: Record<string, McpIntegrationRecord> = {};

  for (const [id, rawValue] of integrationEntries) {
    const raw = record(rawValue, `integration ${id}`);
    const site = record(raw.site, `integration ${id}.site`);
    const acquisition = record(raw.acquisition, `integration ${id}.acquisition`);
    const installation = record(raw.installation, `integration ${id}.installation`);
    const store = record(raw.store, `integration ${id}.store`);
    const displayOrder = raw.displayOrder;
    if (typeof displayOrder !== 'number' || !Number.isFinite(displayOrder)) {
      throw new Error(`integration ${id}.displayOrder must be a finite number`);
    }
    if (orders.has(displayOrder)) throw new Error(`Duplicate displayOrder ${displayOrder}`);
    orders.add(displayOrder);

    const englishPath = string(raw.englishPath, `integration ${id}.englishPath`);
    if (!/^\/integrations\/[a-z0-9-]+$/.test(englishPath)) {
      throw new Error(`integration ${id}.englishPath must be an integration path`);
    }
    if (paths.has(englishPath)) throw new Error(`Duplicate englishPath ${englishPath}`);
    paths.add(englishPath);

    const publication = oneOf(site.publication, ['live', 'preview_noindex', 'hidden'] as const, `integration ${id}.site.publication`);
    const indexable = boolean(site.indexable, `integration ${id}.site.indexable`);
    if (publication !== 'live' && indexable) {
      throw new Error(`integration ${id} cannot be indexable unless publication is live`);
    }

    const acquisitionKey = string(acquisition.key, `integration ${id}.acquisition.key`);
    if (acquisitionKey !== id) throw new Error(`integration ${id} acquisition key must match its registry key`);

    const deepLinkEnabled = boolean(installation.deepLinkEnabled, `integration ${id}.installation.deepLinkEnabled`);
    const deepLink = installation.deepLink;
    if (deepLink !== null && typeof deepLink !== 'string') {
      throw new Error(`integration ${id}.installation.deepLink must be a string or null`);
    }
    if (deepLinkEnabled) {
      try {
        if (!deepLink || new URL(deepLink).protocol !== 'https:') throw new Error('not HTTPS');
      } catch {
        throw new Error(`integration ${id} enabled deep link must be an absolute HTTPS URL`);
      }
    }

    if (!Array.isArray(raw.hosts) || raw.hosts.length === 0) {
      throw new Error(`integration ${id}.hosts must be a non-empty array`);
    }
    const hosts = raw.hosts.map((hostId, index) => string(hostId, `integration ${id}.hosts[${index}]`));
    if (new Set(hosts).size !== hosts.length) throw new Error(`integration ${id} contains duplicate host references`);
    hosts.forEach((hostId) => referencedHosts.add(hostId));

    integrations[id] = {
      id: id as McpIntegrationId,
      label: string(raw.label, `integration ${id}.label`),
      category: oneOf(raw.category, ['assistant', 'autonomous-agent', 'development', 'automation', 'enterprise'] as const, `integration ${id}.category`),
      displayOrder,
      englishPath: englishPath as `/integrations/${string}`,
      site: { publication, indexable },
      acquisition: {
        enabled: boolean(acquisition.enabled, `integration ${id}.acquisition.enabled`),
        key: acquisitionKey,
      },
      installation: {
        directMcp: oneOf(installation.directMcp, ['available', 'unavailable'] as const, `integration ${id}.installation.directMcp`),
        package: oneOf(installation.package, ['available', 'unavailable'] as const, `integration ${id}.installation.package`),
        deepLinkEnabled,
        deepLink,
      },
      store: {
        target: string(store.target, `integration ${id}.store.target`),
        status: oneOf(store.status, ['not_applicable', 'eligible', 'preparing', 'submitted', 'listed', 'policy_blocked'] as const, `integration ${id}.store.status`),
      },
      hosts: hosts as McpHostId[],
    };
  }

  const hosts: Record<string, McpHostRecord> = {};
  for (const [id, rawValue] of Object.entries(rawHosts)) {
    const raw = record(rawValue, `host ${id}`);
    const evidence = record(raw.evidence, `host ${id}.evidence`);
    const integration = string(raw.integration, `host ${id}.integration`);
    if (!integrations[integration]) throw new Error(`host ${id} references missing integration ${integration}`);
    if (!integrations[integration].hosts.includes(id as McpHostId)) {
      throw new Error(`orphan host ${id} is not referenced by integration ${integration}`);
    }
    hosts[id] = {
      id: id as McpHostId,
      integration: integration as McpIntegrationId,
      label: string(raw.label, `host ${id}.label`),
      evidence: {
        kind: oneOf(evidence.kind, ['hosted-checkpoint'] as const, `host ${id}.evidence.kind`),
        status: oneOf(evidence.status, ['verified', 'tested_with_limits', 'not-run'] as const, `host ${id}.evidence.status`),
        lastChecked: string(evidence.lastChecked, `host ${id}.evidence.lastChecked`),
        source: string(evidence.source, `host ${id}.evidence.source`),
      },
    };
  }

  for (const [integrationId, integration] of Object.entries(integrations)) {
    for (const hostId of integration.hosts) {
      const host = hosts[hostId];
      if (!host) throw new Error(`integration ${integrationId} references missing host ${hostId}`);
      if (host.integration !== integrationId) {
        throw new Error(`host ${hostId} is owned by ${host.integration}, not ${integrationId}`);
      }
    }
  }
  for (const hostId of Object.keys(hosts)) {
    if (!referencedHosts.has(hostId)) throw new Error(`orphan host ${hostId}`);
  }

  return freezeDeep({ schemaVersion: 1, integrations, hosts });
}

const registry = parseMcpIntegrationRegistry(registryJson);

export function getMcpIntegrationIds(): McpIntegrationId[] {
  return Object.values(registry.integrations)
    .sort((left, right) => left.displayOrder - right.displayOrder)
    .map((integration) => integration.id);
}

export function getMcpVisibleIntegrationIds(): McpIntegrationId[] {
  return getMcpIntegrationIds().filter((id) => getMcpIntegration(id).site.publication !== 'hidden');
}

export function getMcpIntegration(id: McpIntegrationId): McpIntegrationRecord {
  return registry.integrations[id] as McpIntegrationRecord;
}

export function getMcpIntegrationLabel(id: McpIntegrationId): string {
  return getMcpIntegration(id).label;
}

export function getMcpHost(id: McpHostId): McpHostRecord {
  return registry.hosts[id] as McpHostRecord;
}

export function getMcpPublicIntegrationPaths(): Array<`/integrations/${string}`> {
  return getMcpIntegrationIds()
    .map(getMcpIntegration)
    .filter((integration) => integration.site.publication === 'live' && integration.site.indexable)
    .map((integration) => integration.englishPath);
}

export function getMcpClientActionConfig(id: McpIntegrationId): {
  deepLinkEnabled: boolean;
  deepLink: string | null;
} {
  const { deepLinkEnabled, deepLink } = getMcpIntegration(id).installation;
  return { deepLinkEnabled, deepLink };
}

export function isEnabledMcpAcquisitionClient(value: unknown): value is McpIntegrationId {
  return typeof value === 'string'
    && Object.prototype.hasOwnProperty.call(registry.integrations, value)
    && getMcpIntegration(value as McpIntegrationId).acquisition.enabled;
}
