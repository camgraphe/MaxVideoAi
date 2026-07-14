import type { AppLocale } from '@/i18n/locales';
import type { McpPublicationState } from '@/lib/mcp-publication';
import type { McpCompatibilityClientEvidence } from '../../mcp/_lib/mcp-compatibility';
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
}: {
  compatibility: McpCompatibilityClientEvidence;
  copy: IntegrationPageCopy;
  locale: AppLocale;
  publication: McpPublicationState;
}) {
  return (
    <div className="border-t border-hairline bg-bg text-text-primary dark:border-white/[0.08] dark:bg-bg dark:text-white">
      <IntegrationHeroSection copy={copy} publication={publication} />
      <IntegrationSetupSection compatibility={compatibility} copy={copy} locale={locale} />
      <IntegrationWorkflowSection copy={copy} publication={publication} />
      <IntegrationTroubleshootingSection copy={copy} />
    </div>
  );
}
