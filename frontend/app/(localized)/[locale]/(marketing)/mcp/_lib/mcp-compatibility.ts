import compatibility from '@/config/mcp-compatibility.json';
import type { AppLocale } from '@/i18n/locales';
import type { McpClientId } from './mcp-page-types';

export type McpCompatibilityClientEvidence = {
  client: McpClientId;
  hostLabel: string;
  lastVerified: string;
  version: string;
};

export type McpCompatibilityEvidence = {
  clients: Record<McpClientId, McpCompatibilityClientEvidence>;
  lastVerified: string;
  sourceEvidence: string;
};

export function getMcpCompatibilityEvidence(): McpCompatibilityEvidence {
  return {
    lastVerified: compatibility.lastVerified,
    sourceEvidence: compatibility.sourceEvidence,
    clients: {
      claude: {
        client: 'claude',
        hostLabel: compatibility.clients.claude.hostLabel,
        lastVerified: compatibility.lastVerified,
        version: compatibility.clients.claude.version,
      },
      codex: {
        client: 'codex',
        hostLabel: compatibility.clients.codex.hostLabel,
        lastVerified: compatibility.lastVerified,
        version: compatibility.clients.codex.version,
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
