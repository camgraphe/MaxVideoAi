import { McpIntegrationCards } from '@/components/marketing/mcp/McpIntegrationCards';
import { McpHostProofCard } from '../../mcp/_components/McpHostProofCard';
import { getMcpEditorialCopy } from '@/components/marketing/mcp/mcp-editorial-copy';
import type { AppLocale } from '@/i18n/locales';
import { AssistantFirstRequest } from '@/components/marketing/AssistantFirstRequest';
import type { McpPublicationState } from '@/lib/mcp-publication';
import type { McpCompatibilityClientEvidence } from '../../mcp/_lib/mcp-compatibility';
import type { McpHostProof } from '../../mcp/_lib/mcp-host-proof';
import type { IntegrationPageCopy } from '../_lib/integration-copy';
import { IntegrationHeroSection } from './IntegrationHeroSection';
import { IntegrationSetupSection } from './IntegrationSetupSection';
import { IntegrationTroubleshootingSection } from './IntegrationTroubleshootingSection';
import { IntegrationWorkflowSection } from './IntegrationWorkflowSection';

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
  return (
    <div className="mcp-redesign">
      <IntegrationHeroSection copy={copy} publication={publication} locale={locale} />
      {hostProof && publication.showPaidGenerationClaim ? <section id="real-result" className="mcp-integration-proof mcp-section"><div className="container-page mcp-proof-grid"><div><p className="mcp-eyebrow">{getMcpEditorialCopy(locale).proofEyebrow}</p><h2>{getMcpEditorialCopy(locale).proofTitle}</h2><p className="mcp-lead">{getMcpEditorialCopy(locale).proofBody}</p></div><McpHostProofCard proof={hostProof}/></div></section> : null}
      <IntegrationSetupSection compatibility={compatibility} copy={copy} locale={locale} />
      {publication.connectionAvailable && publication.showPaidGenerationClaim ? (
        <AssistantFirstRequest locale={locale} />
      ) : null}
      <IntegrationWorkflowSection copy={copy} publication={publication} />
      <IntegrationTroubleshootingSection copy={copy} locale={locale} publication={publication} />
      <McpIntegrationCards locale={locale} compact />
    </div>
  );
}
