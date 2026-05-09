import { parseCursorParam } from './cursor';
import { buildOutcomeSqlCondition, normalizeOutcomeFilter } from './outcomes';
import type { FetchJobAuditFilters } from './types';

export function buildJobAuditWhereClause(filters: FetchJobAuditFilters & { cursor?: string | null }): {
  whereClause: string;
  params: Array<string | number | Date>;
} {
  const cursorInfo = parseCursorParam(filters.cursor ?? null);
  const params: Array<string | number | Date> = [];
  const conditions: string[] = [];

  if (filters.jobId && filters.jobId.trim().length) {
    params.push(`%${filters.jobId.trim()}%`);
    const index = params.length;
    conditions.push(`j.job_id ILIKE $${index}`);
  }

  if (filters.userId && filters.userId.trim().length) {
    params.push(`%${filters.userId.trim()}%`);
    const index = params.length;
    conditions.push(`j.user_id::text ILIKE $${index}`);
  }

  if (filters.engineId && filters.engineId.trim().length) {
    params.push(`%${filters.engineId.trim()}%`);
    const index = params.length;
    conditions.push(`(j.engine_id ILIKE $${index} OR j.engine_label ILIKE $${index})`);
  }

  if (filters.status && filters.status.trim().length) {
    params.push(filters.status.trim().toLowerCase());
    const index = params.length;
    conditions.push(`LOWER(j.status) = $${index}`);
  }

  const outcomeFilter = normalizeOutcomeFilter(filters.outcome);
  if (outcomeFilter) {
    conditions.push(buildOutcomeSqlCondition(outcomeFilter));
  }

  if (filters.from instanceof Date && !Number.isNaN(filters.from.getTime())) {
    params.push(filters.from);
    const index = params.length;
    conditions.push(`j.created_at >= $${index}`);
  }

  if (filters.to instanceof Date && !Number.isNaN(filters.to.getTime())) {
    params.push(filters.to);
    const index = params.length;
    conditions.push(`j.created_at <= $${index}`);
  }

  if (cursorInfo.createdAt) {
    params.push(cursorInfo.createdAt);
    const createdAtIndex = params.length;
    params.push(cursorInfo.id ?? Number.MAX_SAFE_INTEGER);
    const idIndex = params.length;
    conditions.push(`(j.created_at, j.id) < ($${createdAtIndex}, $${idIndex})`);
  } else if (typeof cursorInfo.id === 'number' && Number.isFinite(cursorInfo.id)) {
    params.push(cursorInfo.id);
    const idIndex = params.length;
    conditions.push(`j.id < $${idIndex}`);
  }

  return {
    whereClause: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
}
