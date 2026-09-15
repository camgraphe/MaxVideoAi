import {
  getMcpIntegration,
  getMcpPublicIntegrationPaths,
  type McpIntegrationId,
} from '@/lib/mcp-integration-registry';

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
  ...getMcpPublicIntegrationPaths(),
  ...getMcpPublicIntegrationPaths().map((path) =>
    path.replace('/integrations/', '/integraciones/'),
  ),
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

export function getMcpIntegrationPublicationState(
  integrationId: McpIntegrationId,
  globalState: McpPublicationState,
): McpPublicationState {
  const integration = getMcpIntegration(integrationId);
  if (!globalState.renderPublicPage || integration.site.publication === 'hidden') {
    return {
      renderPublicPage: false,
      connectionAvailable: false,
      indexable: false,
      showTrialClaim: false,
      showPaidGenerationClaim: false,
      showReferenceClaim: false,
    };
  }
  if (integration.site.publication === 'preview_noindex') {
    return {
      ...globalState,
      renderPublicPage: true,
      connectionAvailable: false,
      indexable: false,
      showTrialClaim: false,
      showPaidGenerationClaim: false,
      showReferenceClaim: false,
    };
  }
  return {
    ...globalState,
    indexable: globalState.indexable && integration.site.indexable,
  };
}
