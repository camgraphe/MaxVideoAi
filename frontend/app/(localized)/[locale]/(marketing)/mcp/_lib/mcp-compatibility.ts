import compatibility from '@/config/mcp-compatibility.json';
import type { AppLocale } from '@/i18n/locales';
import type { McpClientId, McpCompatibilityHostId } from './mcp-page-types';

export type McpCompatibilityHostEvidence = {
  id: McpCompatibilityHostId;
  client: McpClientId;
  hostLabel: string;
  lastVerified: string;
  version: string;
};

export type McpCompatibilityClientEvidence = {
  client: McpClientId;
  hosts: McpCompatibilityHostEvidence[];
};

export type McpCompatibilityEvidence = {
  clients: Record<McpClientId, McpCompatibilityClientEvidence>;
  lastVerified: string;
  sourceEvidence: string;
};

export function getMcpCompatibilityEvidence(): McpCompatibilityEvidence {
  const host = (id: McpCompatibilityHostId): McpCompatibilityHostEvidence => ({
    id,
    client: compatibility.hosts[id].client as McpClientId,
    hostLabel: compatibility.hosts[id].hostLabel,
    lastVerified: compatibility.lastVerified,
    version: compatibility.hosts[id].version,
  });
  return {
    lastVerified: compatibility.lastVerified,
    sourceEvidence: compatibility.sourceEvidence,
    clients: {
      claude: {
        client: 'claude',
        hosts: [host('claudeDesktop'), host('claudeCode')],
      },
      codex: {
        client: 'codex',
        hosts: [host('codexCli')],
      },
    },
  };
}

export function formatMcpVerifiedDate(locale: AppLocale, isoDate: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(new Date(`${isoDate}T00:00:00.000Z`));
}
