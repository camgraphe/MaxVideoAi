import { isDatabaseConfigured, query, type QueryExecutor } from '@/lib/db';
import { readMcpAuthMetadata, type McpAuthMetadata } from './admin-mcp-auth-metadata';
import type { AdminMcpRange } from '@/server/admin-mcp-metrics';
import type { McpClientFamily } from '@/server/mcp/client-family';
import {
  buildMcpOutcomesSql,
  buildMcpGenerationItemsSql,
  MCP_OUTCOME_RELATIONS_SQL,
  type McpOutcomeRelations,
} from './admin-mcp-outcomes-queries';

export const MCP_CLIENT_LABELS = {
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  codex: 'Codex',
  openclaw: 'OpenClaw',
  n8n: 'n8n',
  glama: 'Glama',
  cursor: 'Cursor',
  githubCopilot: 'GitHub Copilot',
  geminiCli: 'Gemini CLI',
  microsoftCopilot: 'Microsoft Copilot',
  other: 'Other / unidentified',
} as const satisfies Record<McpClientFamily, string>;
export type { McpClientFamily } from '@/server/mcp/client-family';
export type McpOutcomeCounts = {
  accounts: number;
  newSignups: number | null;
  generators: number;
  submitted: number;
  videos: number;
  failed: number;
  pending: number;
  imageGenerators: number;
  imagesSubmitted: number;
  images: number;
  imageFailed: number;
  imagePending: number;
};
export type McpGenerationItem = {
  jobId: string;
  surface: 'video' | 'image';
  engineId: string | null;
  engineLabel: string | null;
  status: string | null;
  createdAt: string;
  client: McpClientFamily;
};
export type AdminMcpOutcomes = {
  totals: McpOutcomeCounts | null;
  clients: Array<McpOutcomeCounts & { client: McpClientFamily }>;
  generations: McpGenerationItem[] | null;
  notices: string[];
};
type OutcomeRow = {
  client: string;
  accounts: string | number | null;
  new_signups: string | number | null;
  missing_profiles: string | number | null;
  generators: string | number | null;
  submitted: string | number | null;
  videos: string | number | null;
  failed: string | number | null;
  pending: string | number | null;
  image_generators: string | number | null;
  images_submitted: string | number | null;
  images: string | number | null;
  image_failed: string | number | null;
  image_pending: string | number | null;
  missing_user_ids?: string[] | null;
  unknown_client_ids?: string[] | null;
};
type GenerationItemRow = {
  job_id: string | null;
  surface: string | null;
  engine_id: string | null;
  engine_label: string | null;
  status: string | null;
  created_at: string | null;
  client: string | null;
};

function count(value: string | number | null): number {
  if (value == null) throw new Error('Missing MCP outcome count.');
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
    imageGenerators: count(row.image_generators),
    imagesSubmitted: count(row.images_submitted),
    images: count(row.images),
    imageFailed: count(row.image_failed),
    imagePending: count(row.image_pending),
  };
  if (
    result.videos + result.failed + result.pending !== result.submitted
    || result.images + result.imageFailed + result.imagePending !== result.imagesSubmitted
    || result.generators > result.videos
    || result.imageGenerators > result.images
  ) {
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
  const unavailable = (reason: string): AdminMcpOutcomes => ({ totals: null, clients: [], generations: [], notices: [reason] });
  if (!deps.configured()) return unavailable('MCP account and video statistics are unavailable: database is not configured.');
  try {
    const relations = (await deps.executor.query<McpOutcomeRelations>(MCP_OUTCOME_RELATIONS_SQL))[0];
    if (!relations?.audit || !relations.quotes || !relations.jobs) {
      return unavailable('MCP account and video statistics require the audit, generation quote and job tables.');
    }
    const sql = buildMcpOutcomesSql(relations);
    const emptyMetadata: McpAuthMetadata = { profiles: [], clients: [] };
    let metadata = emptyMetadata;
    let rows = await deps.executor.query<OutcomeRow>(sql, [range.from, range.to, JSON.stringify(emptyMetadata)]);
    let total = rows.find((row) => row.client === 'all');
    if (total && deps.readAuthMetadata && (total.missing_user_ids?.length || total.unknown_client_ids?.length)) {
      metadata = await deps.readAuthMetadata(total.missing_user_ids ?? [], total.unknown_client_ids ?? []).catch(() => emptyMetadata);
      if (metadata.profiles.length || metadata.clients.length) {
        rows = await deps.executor.query<OutcomeRow>(sql, [range.from, range.to, JSON.stringify(metadata)]);
        total = rows.find((row) => row.client === 'all');
      }
    }
    if (!total) throw new Error('Missing MCP outcome totals.');
    const registrationsAvailable = count(total.missing_profiles) === 0;
    const metadataJson = JSON.stringify(metadata);
    const empty: OutcomeRow = {
      client: '', accounts: 0, missing_profiles: 0, new_signups: 0,
      generators: 0, submitted: 0, videos: 0, failed: 0, pending: 0,
      image_generators: 0, images_submitted: 0, images: 0, image_failed: 0, image_pending: 0,
    };
    let generationRows: GenerationItemRow[] = [];
    let generationNotice: string | null = null;
    let generations: McpGenerationItem[] | null = null;
    try {
      generationRows = await deps.executor.query<GenerationItemRow>(buildMcpGenerationItemsSql(relations), [range.from, range.to, metadataJson, 30]);
      generations = generationRows.flatMap((row): McpGenerationItem[] => {
        if (!row.job_id || (row.surface !== 'video' && row.surface !== 'image') || !row.created_at) return [];
        const client = (Object.hasOwn(MCP_CLIENT_LABELS, row.client ?? '') ? row.client : 'other') as McpClientFamily;
        return [{
          jobId: row.job_id,
          surface: row.surface,
          engineId: row.engine_id,
          engineLabel: row.engine_label,
          status: row.status,
          createdAt: row.created_at,
          client,
        }];
      });
    } catch {
      generationNotice = 'Recent MCP generations are unavailable for this reporting window; aggregate outcomes remain available.';
    }
    return {
      totals: counts(total, registrationsAvailable),
      clients: (Object.keys(MCP_CLIENT_LABELS) as McpClientFamily[]).map((client) => ({
        client,
        ...counts(rows.find((row) => row.client === client) ?? empty, registrationsAvailable),
      })),
      generations,
      notices: [
        ...(!registrationsAvailable ? ['New signup counts are unavailable because some registration dates could not be read from synchronized profiles or account records.'] : []),
        ...(!relations.clientFamily ? ['Per-connection application recording starts after the client-family audit schema is installed. Historical attribution uses connection links and current registered OAuth application names where available.'] : []),
        ...(generationNotice ? [generationNotice] : []),
      ],
    };
  } catch {
    return unavailable('MCP account and video statistics could not be loaded. Unavailable data is not counted as zero.');
  }
}
