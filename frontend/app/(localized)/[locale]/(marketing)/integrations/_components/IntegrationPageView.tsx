import '@/styles/marketing-mcp.css';
import { McpIntegrationCards } from '@/components/marketing/mcp/McpIntegrationCards';
import { McpCreationStories, McpCreationHostBridge } from '@/components/marketing/mcp/McpCreationStories';
import type { AppLocale } from '@/i18n/locales';
import '@/styles/marketing-integration-guides.css';
import { guideMedia, type GuideHost } from '../_content/guide-presentation';
import { IntegrationResultSection } from './IntegrationResultSection';
import type { McpPublicationState } from '@/lib/mcp-publication';
import { getMcpClientActionConfig } from '@/lib/mcp-integration-registry';
import type { McpCompatibilityClientEvidence } from '../../mcp/_lib/mcp-compatibility';
import type { McpHostProof } from '../../mcp/_lib/mcp-host-proof';
import type { IntegrationPageCopy } from '../_lib/integration-copy';
import { IntegrationHeroSection } from './IntegrationHeroSection';
import { IntegrationSetupSection } from './IntegrationSetupSection';
import { IntegrationTroubleshootingSection } from './IntegrationTroubleshootingSection';
import { IntegrationWorkflowSection } from './IntegrationWorkflowSection';
import { IntegrationEntrySection } from './IntegrationEntrySection';
import { IntegrationConnectorSetup } from './IntegrationConnectorSetup';
import { IntegrationDirectorySetup } from './IntegrationDirectorySetup';

export function IntegrationPageView({
  compatibility,
  copy,
  locale,
  publication,
  hostProof = null,
}: {
  compatibility: McpCompatibilityClientEvidence;
  copy: IntegrationPageCopy;
  locale: AppLocale;
  publication: McpPublicationState;
  hostProof?: McpHostProof | null;
}) {
  if (!(copy.client in guideMedia)) throw new Error(`Missing guide for ${copy.client}`);
  const host = copy.client as GuideHost;
  const directoryClient = copy.client === 'chatgpt' || copy.client === 'codex' ? copy.client : null;
  const { deepLinkEnabled, deepLink } = getMcpClientActionConfig('chatgpt');
  const directoryHref = directoryClient && publication.connectionAvailable && deepLinkEnabled ? deepLink : null;
  const showCreation = publication.connectionAvailable && publication.showPaidGenerationClaim;
  const directHost = publication.connectionAvailable && (host === 'claude' || host === 'n8n' || host === 'openclaw') ? host : null;
  const hasQuickSetup = Boolean(directoryHref || directHost);
  const setup = <IntegrationSetupSection compatibility={compatibility} copy={copy} locale={locale} advanced={hasQuickSetup} />;
  return (
    <div className="mcp-redesign mcp-guide">
      <IntegrationHeroSection copy={copy} publication={publication} locale={locale} host={host} />
      {directoryClient && directoryHref ? <IntegrationDirectorySetup client={directoryClient} href={directoryHref} locale={locale} showPaidGeneration={showCreation} /> : null}
      {directHost && <IntegrationConnectorSetup host={directHost} locale={locale} commands={copy.setup.hostGuides[0].commands} />}
      {!hasQuickSetup && setup}
      <IntegrationWorkflowSection copy={copy} host={host} locale={locale} publication={publication} />
      {showCreation && <IntegrationResultSection host={host} locale={locale} proof={hostProof} />}
      {showCreation && <IntegrationEntrySection locale={locale} client={copy.client} />}
      {showCreation ? (
        copy.client === 'codex' ? <McpCreationStories locale={locale} /> :
          copy.client === 'chatgpt' || copy.client === 'claude' ? <McpCreationHostBridge locale={locale} /> : null
      ) : null}
      {hasQuickSetup && setup}
      {copy.client === 'chatgpt' && publication.connectionAvailable ? <aside data-mcp-connection-scope className="container-page py-6 text-sm text-text-secondary"><p>{copy.compatibility.statuses.chatgptWeb}</p></aside> : null}
      <IntegrationTroubleshootingSection copy={copy} locale={locale} publication={publication} />
      <McpIntegrationCards locale={locale} compact />
    </div>
  );
}
