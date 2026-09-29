import type { ProviderCostComparisonRowView } from './pricing-cockpit-view-model';

const precise = (value: number) => Number(value.toFixed(9));
const amount = (value: number | null) => value != null && Number.isFinite(value) && value >= 0 ? value : null;

// Multiply the decimal values before half-up cent rounding; binary multiplication
// would turn a legitimate $1.425 tie into 142.49999999999997 cents.
function roundedScenarioCents(unitPriceUsd: number, quantity: number): number | null {
  const decimal = (value: number) => {
    const [mantissa, exponent = '0'] = value.toString().split('e');
    return { coefficient: BigInt(mantissa.replace('.', '')),
      scale: (mantissa.split('.')[1]?.length ?? 0) - Number(exponent) };
  };
  const price = decimal(unitPriceUsd);
  const units = decimal(quantity);
  const product = price.coefficient * units.coefficient;
  const scale = price.scale + units.scale - 2;
  const divisor = BigInt(10) ** BigInt(Math.abs(scale));
  const cents = scale > 0 ? (product + divisor / BigInt(2)) / divisor : product * divisor;
  return cents <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(cents) : null;
}

/** Decision arithmetic over already quoted amounts. Never resolves or writes a commercial tariff. */
export function pricingDecisionMetrics(row: ProviderCostComparisonRowView, customerCents?: number) {
  const unit = row.mediaType === 'image' ? 'image' as const : 'second' as const;
  const candidateQuantity = unit === 'image' ? row.outputQuantity ?? row.outputPixels?.length : row.durationSec;
  const quantity = candidateQuantity != null && Number.isFinite(candidateQuantity) && candidateQuantity > 0
    ? candidateQuantity : null;
  const contract = row.supplierEffective.status === 'confirmed' ? amount(row.supplierEffective.amountUsd) : null;
  const supplierTotalUsd = contract ?? amount(row.supplierList.amountUsd);
  const costBasis = contract != null ? 'contract' as const : supplierTotalUsd == null ? 'unknown' as const
    : row.supplierList.routeMatches === false ? 'other_provider' as const
      : row.supplierList.status === 'catalog_reference_estimate' ? 'catalogue' as const : 'list' as const;
  const cents = customerCents ?? row.customerQuote?.totalCents;
  const customerTotalUsd = row.customerQuote?.currency.toUpperCase() === 'USD' && cents != null
    && Number.isSafeInteger(cents) && cents >= 0 ? cents / 100 : null;
  const grossTotalUsd = customerTotalUsd != null && supplierTotalUsd != null
    ? precise(customerTotalUsd - supplierTotalUsd) : null;
  return {
    unit, quantity, costBasis, supplierTotalUsd, customerTotalUsd, grossTotalUsd,
    supplierUnitUsd: supplierTotalUsd != null && quantity ? precise(supplierTotalUsd / quantity) : null,
    customerUnitUsd: customerTotalUsd != null && quantity ? precise(customerTotalUsd / quantity) : null,
    grossUnitUsd: grossTotalUsd != null && quantity ? precise(grossTotalUsd / quantity) : null,
    marginPercent: grossTotalUsd != null && customerTotalUsd ? grossTotalUsd / customerTotalUsd * 100 : null,
    markupPercent: grossTotalUsd != null && supplierTotalUsd ? grossTotalUsd / supplierTotalUsd * 100 : null,
    resaleMultiple: customerTotalUsd != null && supplierTotalUsd ? customerTotalUsd / supplierTotalUsd : null,
  };
}

export function simulateCustomerUnitPrice(row: ProviderCostComparisonRowView, unitPriceUsd: number,
  extraCostPerUnitUsd: number, generationCount: number) {
  const current = pricingDecisionMetrics(row);
  if (!current.quantity || !Number.isFinite(unitPriceUsd) || unitPriceUsd < 0
    || !Number.isFinite(extraCostPerUnitUsd) || extraCostPerUnitUsd < 0
    || !Number.isSafeInteger(generationCount) || generationCount < 1 || generationCount > 1_000_000) return null;
  const customerCents = roundedScenarioCents(unitPriceUsd, current.quantity);
  if (customerCents == null) return null;
  const metrics = pricingDecisionMetrics(row, customerCents);
  const extraCostTotalUsd = precise(extraCostPerUnitUsd * current.quantity);
  const contributionTotalUsd = metrics.grossTotalUsd == null ? null : precise(metrics.grossTotalUsd - extraCostTotalUsd);
  const result = { customerCents, metrics, extraCostTotalUsd, contributionTotalUsd,
    contributionPercent: contributionTotalUsd != null && metrics.customerTotalUsd
      ? contributionTotalUsd / metrics.customerTotalUsd * 100 : null,
    breakEvenUnitUsd: current.supplierUnitUsd == null ? null : precise(current.supplierUnitUsd + extraCostPerUnitUsd),
    volumeContributionUsd: contributionTotalUsd == null ? null : precise(contributionTotalUsd * generationCount),
  };
  const derived = [extraCostTotalUsd, contributionTotalUsd, result.contributionPercent,
    result.breakEvenUnitUsd, result.volumeContributionUsd, ...Object.values(metrics).filter((value) => typeof value === 'number')];
  return derived.some((value) => value != null && !Number.isFinite(value)) ? null : result;
}

export function customerCentsForTargetMargin(row: ProviderCostComparisonRowView, targetPercent: number,
  extraCostPerUnitUsd: number): number | null {
  const current = pricingDecisionMetrics(row);
  if (!current.quantity || current.supplierTotalUsd == null || !Number.isFinite(targetPercent)
    || targetPercent < 0 || targetPercent >= 100 || !Number.isFinite(extraCostPerUnitUsd) || extraCostPerUnitUsd < 0) return null;
  const cents = Math.ceil((current.supplierTotalUsd + extraCostPerUnitUsd * current.quantity)
    / (1 - targetPercent / 100) * 100 - 1e-9);
  return Number.isSafeInteger(cents) ? cents : null;
}

export function decisionUsd(value: number | null) {
  return value == null || !Number.isFinite(value) ? 'Unavailable' : new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 6,
  }).format(value);
}

export function decisionPercent(value: number | null) {
  return value == null || !Number.isFinite(value) ? 'Unavailable' : `${value.toFixed(1)}%`;
}

export function decisionBasisLabel(basis: ReturnType<typeof pricingDecisionMetrics>['costBasis']) {
  return { contract: 'Account contract', list: 'LIST estimate', catalogue: 'Catalogue estimate',
    other_provider: 'Other provider reference', unknown: 'Cost unavailable' }[basis];
}
