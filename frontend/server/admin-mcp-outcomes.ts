import { isDatabaseConfigured, query, type QueryExecutor } from '@/lib/db';
import { readMcpAuthMetadata, type McpAuthMetadata } from './admin-mcp-auth-metadata';
import type { AdminMcpRange } from '@/server/admin-mcp-metrics';
import { buildMcpOutcomesSql, MCP_OUTCOME_RELATIONS_SQL, type McpOutcomeRelations } from './admin-mcp-outcomes-queries';

export const MCP_CLIENT_LABELS = { chatgpt: 'ChatGPT', claude: 'Claude', codex: 'Codex', other: 'Other / unidentified' } as const;
export type McpClientFamily = keyof typeof MCP_CLIENT_LABELS;
export type McpOutcomeCounts = {
  accounts: number;
  newSignups: number | null;
  generators: number;
  submitted: number;
  videos: number;
  failed: number;
  pending: number;
};
export type AdminMcpOutcomes = {
  totals: McpOutcomeCounts | null;
  clients: Array<McpOutcomeCounts & { client: McpClientFamily }>;
  notices: string[];
};
type OutcomeRow = Record<'accounts' | 'new_signups' | 'missing_profiles' | 'generators' | 'submitted' | 'videos' | 'failed' | 'pending', string | number> & { client: string; missing_user_ids?: string[] | null; unknown_client_ids?: string[] | null };

function count(value: string | number): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 0) throw new Error('Invalid MCP outcome count.');
  return result;
}

function counts(row: OutcomeRow, registrationsAvailable: boolean): McpOutcomeCounts {
  const result = {
    accounts: count(row.accounts),
    newSignups: registrationsAvailable ? count(row.new_signups) : null,
    generators: count(row.generators),
    submitted: count(row.submitted),
    videos: count(row.videos),
    failed: count(row.failed),
    pending: count(row.pending),
  };
  if (result.videos + result.failed + result.pending !== result.submitted || result.generators > result.videos) {
    throw new Error('Inconsistent MCP outcome totals.');
  }
  return result;
}

export async function loadAdminMcpOutcomes(
  range: AdminMcpRange,
  deps: { executor: QueryExecutor; configured(): boolean; readAuthMetadata?: typeof readMcpAuthMetadata } = { executor: { query }, configured: isDatabaseConfigured, readAuthMetadata: readMcpAuthMetadata },
): Promise<AdminMcpOutcomes> {
  if (range.timeZone !== 'UTC' || !Number.isFinite(range.from.getTime()) || !Number.isFinite(range.to.getTime()) || range.from >= range.to) {
    throw new Error('Invalid MCP outcomes UTC window.');
  }
  const unavailable = (reason: string): AdminMcpOutcomes => ({ totals: null, clients: [], notices: [reason] });
  if (!deps.configured()) return unavailable('MCP account and video statistics are unavailable: database is not configured.');
  try {
    const relations = (await deps.executor.query<McpOutcomeRelations>(MCP_OUTCOME_RELATIONS_SQL))[0];
    if (!relations?.audit || !relations.quotes || !relations.jobs) {
      return unavailable('MCP account and video statistics require the audit, generation quote and job tables.');
    }
    const sql = buildMcpOutcomesSql(relations);
    const emptyMetadata: McpAuthMetadata = { profiles: [], clients: [] };
    let rows = await deps.executor.query<OutcomeRow>(sql, [range.from, range.to, JSON.stringify(emptyMetadata)]);
    let total = rows.find((row) => row.client === 'all');
    if (total && deps.readAuthMetadata && (total.missing_user_ids?.length || total.unknown_client_ids?.length)) {
      const metadata = await deps.readAuthMetadata(total.missing_user_ids ?? [], total.unknown_client_ids ?? []).catch(() => emptyMetadata);
      if (metadata.profiles.length || metadata.clients.length) {
        rows = await deps.executor.query<OutcomeRow>(sql, [range.from, range.to, JSON.stringify(metadata)]);
        total = rows.find((row) => row.client === 'all');
      }
    }
    if (!total) throw new Error('Missing MCP outcome totals.');
    const registrationsAvailable = count(total.missing_profiles) === 0;
    const empty: OutcomeRow = { client: '', accounts: 0, missing_profiles: 0, new_signups: 0, generators: 0, submitted: 0, videos: 0, failed: 0, pending: 0 };
    return {
      totals: counts(total, registrationsAvailable),
      clients: (Object.keys(MCP_CLIENT_LABELS) as McpClientFamily[]).map((client) => ({
        client,
        ...counts(rows.find((row) => row.client === client) ?? empty, registrationsAvailable),
      })),
      notices: [
        ...(!registrationsAvailable ? ['New signup counts are unavailable because some registration dates could not be read from synchronized profiles or account records.'] : []),
        ...(!relations.clientFamily ? ['Per-connection application recording starts after the client-family audit schema is installed. Historical attribution uses connection links and current registered OAuth application names where available.'] : []),
      ],
    };
  } catch {
    return unavailable('MCP account and video statistics could not be loaded. Unavailable data is not counted as zero.');
  }
}
