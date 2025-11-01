export const FEATURES = {
  delivery: {
    drive: true,
    onedrive: true,
    s3: true,
    dropbox: false,
  },
  workflows: {
    brandKits: true,
    approvals: true,
    deliveryExports: {
      fcxpxml: false,
      aejson: false,
    },
    budgetControls: true,
  },
  pricing: {
    publicCalculator: true,
    refundsAuto: true,
    itemisedReceipts: true,
    multiApproverTopups: true,
    memberTiers: true,
  },
} as const;

