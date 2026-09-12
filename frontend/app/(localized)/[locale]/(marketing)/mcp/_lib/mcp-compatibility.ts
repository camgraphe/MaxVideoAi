import type { AppLocale } from '@/i18n/locales';
import {
  getMcpHost,
  getMcpIntegration,
  getMcpVisibleIntegrationIds,
} from '@/lib/mcp-integration-registry';
import type { McpClientId, McpCompatibilityHostId } from './mcp-page-types';

export type McpCompatibilityHostEvidence = {
  id: McpCompatibilityHostId;
  client: McpClientId;
  hostLabel: string;
  lastChecked: string;
  status: 'verified' | 'tested_with_limits' | 'not-run';
};

export type McpCompatibilityClientEvidence = {
  client: McpClientId;
  hosts: McpCompatibilityHostEvidence[];
};

export type McpCompatibilityEvidence = {
  clients: Partial<Record<McpClientId, McpCompatibilityClientEvidence>>;
  evidenceKind: 'hosted-checkpoint';
  lastChecked: string;
  sourceEvidence: string;
};

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
    sourceEvidence: hosts[0] ? getMcpHost(hosts[0].id).evidence.source : '',
  };
}

export function getMcpCompatibilityClientEvidence(
  client: McpClientId,
): McpCompatibilityClientEvidence {
  const integration = getMcpIntegration(client);
  return {
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
  };
}

export function formatMcpCheckpointDate(locale: AppLocale, isoDate: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(new Date(`${isoDate}T00:00:00.000Z`));
}
