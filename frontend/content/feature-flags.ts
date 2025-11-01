export const FEATURES = {
  delivery: {
    drive: true,
    onedrive: true,
    s3: true,
    dropbox: false,
  },
  workflows: {
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
