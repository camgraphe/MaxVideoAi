export const FEATURES = {
  delivery: {
    drive: false,
    onedrive: false,
    s3: false,
    dropbox: false,
  },
  workflows: {
    priceChip: true,
    nanoBananaImage: false,
    brandKits: false,
    approvals: false,
    deliveryExports: {
      fcxpxml: false,
      aejson: false,
    },
    budgetControls: false,
  },
  pricing: {
    publicCalculator: true,
    refundsAuto: true,
    itemisedReceipts: true,
    multiApproverTopups: true,
    memberTiers: true,
  },
} as const;
