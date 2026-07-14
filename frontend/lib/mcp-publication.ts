export type McpPublicationState = {
  renderPublicPage: boolean;
  connectionAvailable: boolean;
  indexable: boolean;
  showTrialClaim: boolean;
  showPaidGenerationClaim: boolean;
  showReferenceClaim: boolean;
};

type McpPublicationInputs = {
  publicMarketing: boolean;
  publicIndexing: boolean;
  transport: boolean;
  oauth: boolean;
  discovery: boolean;
  paidGeneration: boolean;
  trial: boolean;
  referenceUploads: boolean;
};

export function getMcpPublicationState({
  publicMarketing,
  publicIndexing,
  transport,
  oauth,
  discovery,
  paidGeneration,
  trial,
  referenceUploads,
}: McpPublicationInputs): McpPublicationState {
  return {
    renderPublicPage: publicMarketing,
    connectionAvailable: publicMarketing && transport && oauth && discovery,
    indexable:
      publicIndexing &&
      transport &&
      oauth &&
      discovery &&
      paidGeneration &&
      trial &&
      referenceUploads,
    showTrialClaim: trial,
    showPaidGenerationClaim: paidGeneration,
    showReferenceClaim: referenceUploads,
  };
}
