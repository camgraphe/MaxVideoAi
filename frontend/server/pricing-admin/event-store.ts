import { query, type QueryExecutor } from '@/lib/db';
import type {
  InsertPricingChangeEventInput,
  ListPricingChangeEventsInput,
  PricingChangeDomain,
  PricingChangeEvent,
  PricingChangeJsonObject,
  PricingChangeJsonValue,
  PricingChangeOperation,
} from '../../lib/admin/pricing-change-contract';

type RawPricingChangeEvent = {
  id: string;
  domain: PricingChangeDomain;
  operation: PricingChangeOperation;
  target_id: string;
  actor_id: string;
  previous_state: unknown;
  next_state: unknown;
  preview_summary: unknown;
  affected_scenario_ids: unknown;
  created_at: Date | string;
};

const DEFAULT_HISTORY_LIMIT = 50;
const MAX_HISTORY_LIMIT = 200;

function isJsonValue(value: unknown): value is PricingChangeJsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (!value || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  return Object.values(value).every(isJsonValue);
}

function parseJsonValue(value: unknown): PricingChangeJsonValue | null {
  let parsed = value;
  if (typeof value === 'string' && /^[\[{]/.test(value.trimStart())) {
    try {
      parsed = JSON.parse(value);
    } catch {
      return null;
    }
  }
  return isJsonValue(parsed) ? parsed : null;
}

function parseJsonObject(value: unknown): PricingChangeJsonObject {
  const parsed = parseJsonValue(value);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
}

function parseScenarioIds(value: unknown): string[] {
  const parsed = parseJsonValue(value);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((scenarioId): scenarioId is string => typeof scenarioId === 'string')
    .map((scenarioId) => scenarioId.trim())
    .filter(Boolean);
}

function toIsoTimestamp(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : value;
}

function mapPricingChangeEventRow(row: RawPricingChangeEvent): PricingChangeEvent {
  return {
    id: row.id,
    domain: row.domain,
    operation: row.operation,
    targetId: row.target_id,
    actorId: row.actor_id,
    previousState: parseJsonValue(row.previous_state),
    nextState: parseJsonValue(row.next_state),
    previewSummary: parseJsonObject(row.preview_summary),
    affectedScenarioIds: parseScenarioIds(row.affected_scenario_ids),
    createdAt: toIsoTimestamp(row.created_at),
  };
}

function nullableJsonParam(value: PricingChangeJsonValue | null): string | null {
  return value === null ? null : JSON.stringify(value);
}

export async function insertPricingChangeEvent(
  executor: QueryExecutor,
  input: InsertPricingChangeEventInput
): Promise<PricingChangeEvent> {
  const rows = await executor.query<RawPricingChangeEvent>(
    `INSERT INTO app_pricing_change_events (
       domain,
       operation,
       target_id,
       actor_id,
       previous_state,
       next_state,
       preview_summary,
       affected_scenario_ids
     )
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb)
     RETURNING id, domain, operation, target_id, actor_id, previous_state, next_state,
               preview_summary, affected_scenario_ids, created_at`,
    [
      input.domain,
      input.operation,
      input.targetId,
      input.actorId,
      nullableJsonParam(input.previousState),
      nullableJsonParam(input.nextState),
      JSON.stringify(input.previewSummary),
      JSON.stringify(input.affectedScenarioIds),
    ]
  );
  const [row] = rows;
  if (!row) {
    throw new Error('Failed to persist pricing change event');
  }
  return mapPricingChangeEventRow(row);
}

function normaliseLimit(limit: number | undefined): number {
  if (typeof limit !== 'number' || !Number.isFinite(limit)) return DEFAULT_HISTORY_LIMIT;
  return Math.max(1, Math.min(Math.trunc(limit), MAX_HISTORY_LIMIT));
}

export async function listPricingChangeEvents(
  input: ListPricingChangeEventsInput = {},
  executor: QueryExecutor = { query }
): Promise<PricingChangeEvent[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (input.domain) {
    params.push(input.domain);
    conditions.push(`domain = $${params.length}`);
  }
  const targetId = input.targetId?.trim();
  if (targetId) {
    params.push(targetId);
    conditions.push(`target_id = $${params.length}`);
  }
  params.push(normaliseLimit(input.limit));
  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = await executor.query<RawPricingChangeEvent>(
    `SELECT id, domain, operation, target_id, actor_id, previous_state, next_state,
            preview_summary, affected_scenario_ids, created_at
       FROM app_pricing_change_events
       ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${params.length}`,
    params
  );
  return rows.map(mapPricingChangeEventRow);
}

export async function getPricingChangeEventById(
  id: string,
  domain: PricingChangeDomain,
  executor: QueryExecutor = { query }
): Promise<PricingChangeEvent | null> {
  const eventId = id.trim();
  if (!eventId) return null;
  const rows = await executor.query<RawPricingChangeEvent>(
    `SELECT id, domain, operation, target_id, actor_id, previous_state, next_state,
            preview_summary, affected_scenario_ids, created_at
       FROM app_pricing_change_events
      WHERE id = $1 AND domain = $2`,
    [eventId, domain]
  );
  return rows[0] ? mapPricingChangeEventRow(rows[0]) : null;
}

export async function listLatestPricingChangeEventsByTargets(
  domain: PricingChangeDomain,
  targetIds: string[],
  executor: QueryExecutor = { query }
): Promise<PricingChangeEvent[]> {
  const normalizedTargetIds = [...new Set(targetIds.map((targetId) => targetId.trim()).filter(Boolean))];
  if (!normalizedTargetIds.length) return [];
  const rows = await executor.query<RawPricingChangeEvent>(
    `SELECT DISTINCT ON (target_id)
            id, domain, operation, target_id, actor_id, previous_state, next_state,
            preview_summary, affected_scenario_ids, created_at
       FROM app_pricing_change_events
      WHERE domain = $1 AND target_id = ANY($2::text[])
      ORDER BY target_id, created_at DESC, id DESC`,
    [domain, normalizedTargetIds]
  );
  return rows.map(mapPricingChangeEventRow);
}
