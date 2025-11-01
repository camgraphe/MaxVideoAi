export const FEATURES = {
  delivery: {
    drive: true,
    onedrive: true,
    s3: true,
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
  marketing: {
    nanoBananaImage: false,
  },
  pricing: {
    publicCalculator: true,
    refundsAuto: true,
    itemisedReceipts: true,
    multiApproverTopups: true,
    memberTiers: true,
    teams: false,
  },
  notifications: {
    center: false,
    emailDigests: false,
    webPush: false,
  },
  docs: {
    libraryDocs: false,
    apiPublicRefs: true,
  },
} as const;
