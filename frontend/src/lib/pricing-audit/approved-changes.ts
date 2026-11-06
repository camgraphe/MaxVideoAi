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
    reason: 'Gemini Omni 1.2 uses the verified $12/M output-token supplier rate. These inactive-policy baseline projections do not change active authored customer tariffs.',
    fieldDeltas: {
      vendorSubtotalCents: { current: 100, canonical: 70 },
      marginCents: { current: 30, canonical: 21 },
      customerTotalCents: { current: 130, canonical: 91 },
    },
  },
  {
    scenarioId: 'billing:gemini-omni-flash:t2v:10:720p:plus',
    reason: 'Gemini Omni 1.2 uses the verified $12/M output-token supplier rate. These inactive-policy baseline projections do not change active authored customer tariffs.',
    fieldDeltas: {
      vendorSubtotalCents: { current: 100, canonical: 70 },
      marginCents: { current: 30, canonical: 21 },
      customerTotalCents: { current: 123, canonical: 86 },
    },
  },
  {
    scenarioId: 'billing:gemini-omni-flash:t2v:10:720p:pro',
    reason: 'Gemini Omni 1.2 uses the verified $12/M output-token supplier rate. These inactive-policy baseline projections do not change active authored customer tariffs.',
    fieldDeltas: {
      vendorSubtotalCents: { current: 100, canonical: 70 },
      marginCents: { current: 30, canonical: 21 },
      customerTotalCents: { current: 117, canonical: 82 },
    },
  },
  {
    scenarioId: 'estimator:gemini-omni-flash:10:720p',
    reason: 'Gemini Omni 1.2 uses the verified $12/M output-token supplier rate. These inactive-policy baseline projections do not change active authored customer tariffs.',
    fieldDeltas: {
      vendorSubtotalCents: { current: 100, canonical: 70 },
      marginCents: { current: 30, canonical: 21 },
      customerTotalCents: { current: 130, canonical: 91 },
      displayedAmount: { current: '$1.30', canonical: '$0.91' },
    },
  },
];
