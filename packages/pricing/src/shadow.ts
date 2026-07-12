export type PricingComparableOutput = {
  currency: string;
  vendorSubtotalCents: number;
  marginCents: number;
  surchargeCents: number;
  customerTotalCents: number;
  unit: string;
  quantity: number;
  displayedAmount?: string;
  structuredDataAmount?: string;
};

export type PricingShadowComparison = {
  scenarioId: string;
  status: 'match' | 'mismatch';
  deltaCents: number;
  fieldDeltas: Record<
    string,
    { current: string | number | undefined; canonical: string | number | undefined }
  >;
};

const COMPARABLE_FIELDS = [
  'currency',
  'vendorSubtotalCents',
  'marginCents',
  'surchargeCents',
  'customerTotalCents',
  'unit',
  'quantity',
  'displayedAmount',
  'structuredDataAmount',
] as const satisfies readonly (keyof PricingComparableOutput)[];

export function comparePricingOutputs(
  scenarioId: string,
  current: PricingComparableOutput,
  canonical: PricingComparableOutput
): PricingShadowComparison {
  const fieldDeltas: PricingShadowComparison['fieldDeltas'] = {};
  for (const field of COMPARABLE_FIELDS) {
    if (current[field] !== canonical[field]) {
      fieldDeltas[field] = { current: current[field], canonical: canonical[field] };
    }
  }
  return {
    scenarioId,
    status: Object.keys(fieldDeltas).length ? 'mismatch' : 'match',
    deltaCents: canonical.customerTotalCents - current.customerTotalCents,
    fieldDeltas,
  };
}
