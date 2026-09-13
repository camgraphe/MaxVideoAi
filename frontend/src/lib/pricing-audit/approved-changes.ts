export type ApprovedPricingAuditChange = {
  scenarioId: string;
  reason: string;
  fieldDeltas: Record<
    string,
    { current: string | number | undefined; canonical: string | number | undefined }
  >;
};

/**
 * Reviewed differences from the immutable pre-canonical baseline.
 * Exact field deltas are required so a later pricing drift cannot inherit an old approval.
 */
export const APPROVED_PRICING_AUDIT_CHANGES: readonly ApprovedPricingAuditChange[] = [
  {
    scenarioId: 'billing:gemini-omni-flash:t2v:10:720p:member',
    reason: 'Gemini Omni 1.1 replaced the former rounded $0.10/s provider fact with exact token pricing.',
    fieldDeltas: {
      vendorSubtotalCents: { current: 100, canonical: 101 },
      marginCents: { current: 30, canonical: 31 },
      customerTotalCents: { current: 130, canonical: 132 },
    },
  },
  {
    scenarioId: 'billing:gemini-omni-flash:t2v:10:720p:plus',
    reason: 'Gemini Omni 1.1 replaced the former rounded $0.10/s provider fact with exact token pricing.',
    fieldDeltas: {
      vendorSubtotalCents: { current: 100, canonical: 101 },
      marginCents: { current: 30, canonical: 31 },
      customerTotalCents: { current: 123, canonical: 125 },
    },
  },
  {
    scenarioId: 'billing:gemini-omni-flash:t2v:10:720p:pro',
    reason: 'Gemini Omni 1.1 replaced the former rounded $0.10/s provider fact with exact token pricing.',
    fieldDeltas: {
      vendorSubtotalCents: { current: 100, canonical: 101 },
      marginCents: { current: 30, canonical: 31 },
      customerTotalCents: { current: 117, canonical: 119 },
    },
  },
  {
    scenarioId: 'estimator:gemini-omni-flash:10:720p',
    reason: 'Gemini Omni 1.1 replaced the former rounded $0.10/s provider fact with exact token pricing.',
    fieldDeltas: {
      vendorSubtotalCents: { current: 100, canonical: 101 },
      marginCents: { current: 30, canonical: 31 },
      customerTotalCents: { current: 130, canonical: 132 },
      displayedAmount: { current: '$1.30', canonical: '$1.32' },
    },
  },
];
