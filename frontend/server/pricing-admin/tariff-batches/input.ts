import type { ManualTariffSelector } from '@maxvideoai/pricing';
import { isValidManualTariffPrice } from '@maxvideoai/pricing';
import { PricingAdminError } from '../errors';
import { TARIFF_BATCH_MAX_CLASSES, type TariffBatchPrice, type TariffBatchProposal } from './contract';

export function batchInvalid(message: string): never { throw new PricingAdminError('invalid_payload', message); }
export function batchRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return batchInvalid('Expected an object.');
  return value as Record<string, unknown>;
}
export function exactFields(record: Record<string, unknown>, allowed: readonly string[]): void {
  if (Object.keys(record).some(key => !allowed.includes(key))) batchInvalid('Unknown batch field.');
}
export function batchSelectorKey(selector: ManualTariffSelector): string {
  return JSON.stringify(Object.entries(selector).sort(([a], [b]) => a.localeCompare(b)));
}
function selector(value: unknown): ManualTariffSelector {
  const record = batchRecord(value);
  exactFields(record, ['engineId', 'mode', 'resolution', 'durationSec', 'billingInputType', 'inputVideoDurationSec']);
  if (record.engineId !== 'kling-v4' || Object.values(record).some(v => typeof v !== 'string' || !v || v.length > 80)) {
    batchInvalid('Unsupported exact batch selector.');
  }
  return { ...record } as ManualTariffSelector;
}
export function decimalRatio(value: string): { numerator: bigint; denominator: bigint } {
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,8})(\.\d{1,6})?$/.test(value)) batchInvalid('Invalid decimal multiplier or rate.');
  const [whole, fraction = ''] = value.split('.');
  return { numerator: BigInt(whole + fraction), denominator: BigInt(10) ** BigInt(fraction.length) };
}
function price(value: unknown): TariffBatchPrice {
  const p = batchRecord(value);
  if (p.kind === 'fixed') {
    exactFields(p, ['kind', 'customerCents']);
    if (Number(p.customerCents) > 100_000_000 || !isValidManualTariffPrice(p)) batchInvalid('Invalid fixed price.');
  } else if (p.kind === 'unit_terms') {
    exactFields(p, ['kind', 'rounding', 'terms']);
    if (p.rounding !== 'up' || !Array.isArray(p.terms) || p.terms.length !== 1) batchInvalid('Invalid continuous price.');
    const term = batchRecord(p.terms[0]);
    exactFields(term, ['unit', 'centsPerUnit']);
    if (term.unit !== 'billable_seconds' || typeof term.centsPerUnit !== 'number' || !Number.isFinite(term.centsPerUnit)
      || term.centsPerUnit < 0 || term.centsPerUnit > 1_000_000 || !isValidManualTariffPrice(p)) batchInvalid('Invalid continuous price.');
    decimalRatio(String(term.centsPerUnit));
  } else batchInvalid('Unsupported batch price.');
  return structuredClone(p) as TariffBatchPrice;
}
export function batchUuid(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value)) {
    batchInvalid('Invalid operation identifier.');
  }
  return value;
}
export function parseTariffBatchProposal(value: unknown): TariffBatchProposal {
  const p = batchRecord(value);
  const rollback = p.intent === 'rollback';
  exactFields(p, rollback ? ['schemaVersion', 'modelId', 'intent', 'reason', 'sourceOperationId', 'selectors']
    : ['schemaVersion', 'modelId', 'intent', 'reason', 'pricing', 'selections']);
  if (p.schemaVersion !== 1 || p.modelId !== 'kling-v4' || !['create_missing', 'replace_selected', 'rollback'].includes(String(p.intent))
    || typeof p.reason !== 'string' || p.reason.trim().length < 3 || p.reason.length > 500) batchInvalid('Invalid batch scope or reason.');
  const items = rollback ? p.selectors : p.selections;
  if (!Array.isArray(items) || !items.length || items.length > TARIFF_BATCH_MAX_CLASSES) batchInvalid(`Select 1–${TARIFF_BATCH_MAX_CLASSES} classes.`);
  const selectors = items.map(item => selector(rollback ? item : batchRecord(item).selector));
  if (new Set(selectors.map(batchSelectorKey)).size !== selectors.length) batchInvalid('Duplicate batch selector.');
  if (rollback) return { schemaVersion: 1, modelId: 'kling-v4', intent: 'rollback', reason: p.reason.trim(),
    sourceOperationId: batchUuid(p.sourceOperationId), selectors };
  const pricing = batchRecord(p.pricing);
  exactFields(pricing, pricing.kind === 'list_multiplier' ? ['kind', 'multiplier'] : ['kind']);
  if (pricing.kind === 'list_multiplier') {
    const ratio = decimalRatio(pricing.multiplier as string);
    if (ratio.numerator < ratio.denominator || ratio.numerator > ratio.denominator * BigInt(10)) batchInvalid('LIST multiplier must be between 1 and 10.');
  } else if (pricing.kind !== 'explicit') batchInvalid('Unknown pricing method.');
  const selections = items.map((item, i) => {
    const entry = batchRecord(item);
    exactFields(entry, pricing.kind === 'explicit' ? ['selector', 'price'] : ['selector']);
    return { selector: selectors[i], ...(pricing.kind === 'explicit' ? { price: price(entry.price) } : {}) };
  });
  return { schemaVersion: 1, modelId: 'kling-v4', intent: p.intent as 'create_missing' | 'replace_selected', reason: p.reason.trim(),
    pricing: pricing.kind === 'explicit' ? { kind: 'explicit' } : { kind: 'list_multiplier', multiplier: pricing.multiplier as string }, selections };
}
