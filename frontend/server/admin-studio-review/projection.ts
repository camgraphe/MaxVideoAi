import type { ReviewTurn, ReviewAction, ReviewUsage, ReviewAssistance } from './contracts';

/** Display-only projection. Do not reuse it as a promise of anonymization or an export policy. */
export function redactReviewText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  return value
    .replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?(?:-----END [^-]*PRIVATE KEY-----|$)/gi, '[credential removed]')
    .replace(/(?:https?:\/\/|www\.)[^\s<>"']+/gi, '[link removed]')
    .replace(/\b(?:data|blob|file):[^\s<>"']+/gi, '[link removed]')
    .replace(/(?:\/[\w/%.~-]+\?|\b[a-z0-9.-]+\.[a-z]{2,}\/)[^\s<>"']+/gi, '[link removed]')
    .replace(/\b(?:bearer|basic)\s+[A-Za-z0-9+/_=.-]+/gi, '[credential removed]')
    .replace(/\b(?:[a-z0-9_-]*(?:token|secret|password|credential|api[_-]?key|signature)[a-z0-9_-]*|authorization)["']?\s*[:=]\s*(?:"[^"]*(?:"|$)|'[^']*(?:'|$)|[^\s,;}]+)/gi, '[credential removed]')
    .replace(/\b(?:sk-[A-Za-z0-9_-]{8,}|gh[pousr]_[A-Za-z0-9_]+|eyJ[A-Za-z0-9_.-]{15,})\b/g, '[credential removed]')
    .replace(/\b[A-Za-z0-9_-]{40,}\b/g, '[opaque value removed]')
    .slice(0, maxLength);
}
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
export function reviewToken(value: unknown): string | null {
  return typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,128}$/.test(value) && redactReviewText(value, 128) === value ? value : null;
}
export function reviewNumber(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (value === '') return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}
const money = (value: unknown) => typeof value === 'string' && /^\d{1,24}$/.test(value) ? value : typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? String(value) : null;
const date = (value: unknown) => value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
export function projectTurn(row: Record<string, unknown>): ReviewTurn {
  return { userId: String(row.user_id), projectId: String(row.project_id), requestId: String(row.request_id), state: reviewToken(row.state) ?? 'unknown', attempts: reviewNumber(row.model_attempts) ?? 0, createdAt: date(row.created_at), quoteId: reviewToken(row.quote_id) };
}
const actions = new Set(['project.read', 'catalog.read', 'pricing.read', 'model.details', 'project.remember', 'image.prepare', 'generation.read', 'quote.discard', 'media.read', 'video.prepare', 'voice.prepare', 'music.prepare', 'timeline.read', 'timeline.edit', 'export.prepare', 'export.read']);
export function projectAction(row: Record<string, unknown>): ReviewAction {
  return { action: typeof row.action === 'string' && actions.has(row.action) ? row.action : null, state: reviewToken(row.state), ok: row.ok === 'true' ? true : row.ok === 'false' ? false : null, observedRevision: reviewNumber(row.observed_revision), modelId: reviewToken(row.model_id), errorCode: reviewToken(row.error_code), createdAt: date(row.created_at) };
}
export function projectUsage(row: Record<string, unknown>, source: ReviewUsage['source']): ReviewUsage {
  const usage = record(row.usage);
  return { source, state: reviewToken(row.state), model: reviewToken(row.model), inputTokens: reviewNumber(usage.input_tokens), cachedTokens: reviewNumber(record(usage.input_tokens_details).cached_tokens), outputTokens: reviewNumber(usage.output_tokens), reasoningTokens: reviewNumber(record(usage.output_tokens_details).reasoning_tokens), elapsedMs: reviewNumber(row.elapsed_ms), createdAt: date(row.created_at) };
}
export function projectAssistance(row: Record<string, unknown>): ReviewAssistance {
  return { state: reviewToken(row.state), model: reviewToken(row.model), returnedModel: reviewToken(row.returned_model), mode: reviewToken(row.mode), policyVersion: reviewToken(row.policy_version), rateVersion: reviewToken(row.rate_version), tariffVersion: reviewToken(row.tariff_version), reservedNanoUsd: money(row.reserved_nano_usd), providerMinNanoUsd: money(row.provider_min_nano_usd), providerMaxNanoUsd: money(row.provider_max_nano_usd), reservedCents: reviewNumber(row.reserved_cents), chargedCents: row.state === 'settled' ? reviewNumber(row.charged_cents) : null, createdAt: date(row.created_at) };
}
