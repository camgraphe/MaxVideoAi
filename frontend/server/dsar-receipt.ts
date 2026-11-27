import { customerPricingSnapshot } from '@/lib/customer-pricing-snapshot';

// Receipt metadata also carries the account's payment references, consents and refund links.
// Strip procurement evidence at every nesting level, including on historical receipts.
function privateReceiptField(field: string) {
  const key = field.replace(/[^a-z0-9]/gi, '').toLowerCase();
  return key === 'pricingauditsnapshot' || key === 'auditpricingsnapshot'
    || key === 'canonicalpricing' || key === 'purchaserouting' || key === 'purchaseceiling'
    || key === 'videopurchase' || key === 'routeplan' || key === 'executionroute' || key.startsWith('routing')
    || key.startsWith('provider') || key.startsWith('vendor') || key.startsWith('supplier')
    || key.startsWith('procurement') || key.startsWith('costbreakdown') || key.startsWith('margin')
    || key === 'platformrevenuecents' || key === 'applicationfeecents' || key === 'destinationacct';
}

function exportMetadata(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(exportMetadata);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !privateReceiptField(key))
    .map(([key, item]) => [key, key.replaceAll('_', '').toLowerCase() === 'pricingsnapshot' ? exportPrice(item) : exportMetadata(item)]));
}

function exportPrice(value: unknown) {
  const standard = customerPricingSnapshot(value);
  if (standard || !value || typeof value !== 'object' || Array.isArray(value)) return standard ?? null;
  // Older Studio receipts describe a reservation or settlement instead of using totalCents.
  const saved = value as Record<string, unknown>;
  const tariff = saved.tariff && typeof saved.tariff === 'object' ? saved.tariff as Record<string, unknown> : null;
  const legacy = {
    ...(saved.phase === 'reservation' ? { phase: saved.phase } : {}),
    ...(typeof saved.chargedCents === 'number' && Number.isSafeInteger(saved.chargedCents) && saved.chargedCents >= 0
      ? { chargedCents: saved.chargedCents } : {}),
    ...(typeof saved.tariffVersion === 'string' ? { tariffVersion: saved.tariffVersion }
      : typeof tariff?.version === 'string' ? { tariffVersion: tariff.version } : {}),
  };
  return Object.keys(legacy).length ? legacy : null;
}

export function exportCustomerReceipt<Row extends { metadata: unknown; pricing_snapshot: unknown }>(row: Row) {
  return { ...row, metadata: exportMetadata(row.metadata), pricing_snapshot: exportPrice(row.pricing_snapshot) };
}
