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

const MCP_PUBLIC_SOURCE_PATHS = new Set([
  '/mcp',
  '/docs/mcp',
  '/integrations/chatgpt',
  '/integrations/claude',
  '/integrations/codex',
  '/integraciones/chatgpt',
  '/integraciones/claude',
  '/integraciones/codex',
]);

export function isMcpPublicSourcePath(pathname: string): boolean {
  const normalized = `/${pathname}`.replace(/\/{2,}/g, '/').replace(/\/$/, '').toLowerCase() || '/';
  const segments = normalized.split('/').filter(Boolean);
  if (segments[0] === 'fr' || segments[0] === 'es') segments.shift();
  return MCP_PUBLIC_SOURCE_PATHS.has(`/${segments.join('/')}`);
}

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
      referenceUploads,
    showTrialClaim: trial,
    showPaidGenerationClaim: paidGeneration,
    showReferenceClaim: referenceUploads,
  };
}
