import type { WebhookIdentifiers } from './fal-webhook-mapping-types';
import { extractStringField } from './fal-webhook-payload-search';

export function extractIdentifiersFromPayload(payload: unknown): WebhookIdentifiers {
  const identifiers: WebhookIdentifiers = {};
  const visited = new Set<unknown>();
  const stack: unknown[] = [payload];

  while (stack.length && (!identifiers.jobId || !identifiers.localKey)) {
    const current = stack.pop();
    if (!current || typeof current !== 'object') continue;
    if (visited.has(current)) continue;
    visited.add(current);

    const record = current as Record<string, unknown>;
    if (!identifiers.jobId) {
      const explicitJobId = extractStringField(record, ['app_job_id', 'job_id', 'jobId']);
      const candidate = explicitJobId ?? extractStringField(record, ['id']);
      // Authenticated webhook correlation carries MCP UUIDs in an explicit job
      // field. Generic id/request_id UUIDs identify the provider request instead.
      const explicitCanonicalId = explicitJobId && (/^tool_upscale_[a-zA-Z0-9_-]+$/.test(explicitJobId)
        || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(explicitJobId));
      if (candidate && (candidate.startsWith('job_') || explicitCanonicalId)) {
        identifiers.jobId = candidate;
      } else if (!identifiers.jobId && record === current) {
        const requestIdCandidate = extractStringField(record, ['request_id']);
        if (requestIdCandidate && requestIdCandidate.startsWith('job_')) {
          identifiers.jobId = requestIdCandidate;
        }
      }
    }
    if (!identifiers.localKey) {
      const candidate = extractStringField(record, ['app_local_key', 'local_key', 'localKey']);
      if (candidate) {
        identifiers.localKey = candidate;
      }
    }

    const metadata = record.metadata;
    if (metadata && typeof metadata === 'object') {
      stack.push(metadata);
    }
    for (const value of Object.values(record)) {
      if (value && typeof value === 'object') {
        stack.push(value);
      }
    }
  }

  return identifiers;
}
