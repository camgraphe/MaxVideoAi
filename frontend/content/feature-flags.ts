import mcpPublication from '../config/mcp-publication.json';

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
    toolsSection: true,
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
    apiPublicRefs: false,
  },
  mcp: {
    publicMarketing: mcpPublication.publicMarketing,
    publicIndexing: mcpPublication.publicIndexing,
    transport: false,
    oauth: false,
    discovery: false,
    paidGeneration: false,
    trial: false,
    referenceUploads: false,
  },
} as const;
