import type { AppLocale } from '@/i18n/locales';
import type { McpPublicationState } from '@/lib/mcp-publication';
import type { McpCompatibilityClientEvidence } from '../../mcp/_lib/mcp-compatibility';
import type { McpHostProof } from '../../mcp/_lib/mcp-host-proof';
import type { IntegrationPageCopy } from '../_lib/integration-copy';
import { McpHostProofCard } from '../../mcp/_components/McpHostProofCard';
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
    <div className="border-t border-hairline bg-bg text-text-primary dark:border-white/[0.08] dark:bg-bg dark:text-white">
      <IntegrationHeroSection copy={copy} publication={publication} />
      <IntegrationSetupSection compatibility={compatibility} copy={copy} locale={locale} />
      {hostProof ? (
        <section className="border-b border-hairline bg-surface py-12 dark:border-white/[0.08] dark:bg-surface">
          <div className="container-page max-w-[1040px]">
            <McpHostProofCard proof={hostProof} />
          </div>
        </section>
      ) : null}
      <IntegrationWorkflowSection copy={copy} publication={publication} />
      <IntegrationTroubleshootingSection copy={copy} />
    </div>
  );
}
