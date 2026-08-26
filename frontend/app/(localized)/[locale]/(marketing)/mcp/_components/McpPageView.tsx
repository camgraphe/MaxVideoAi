import type { AppLocale } from '@/i18n/locales';
import type { McpPublicationState } from '@/lib/mcp-publication';
import { MCP_PRODUCTION_RESOURCE_URL } from '@/server/mcp/config';
import type { McpBudgetOption } from '../_lib/mcp-budget-options';
import type { McpCompatibilityEvidence } from '../_lib/mcp-compatibility';
import type { McpHostProof } from '../_lib/mcp-host-proof';
import type { McpPageCopy } from '../_lib/mcp-page-types';
import type { McpProof } from '../_lib/mcp-proof';
import { McpAnswerPassagesSection } from './McpAnswerPassagesSection';
import { McpBudgetShortlist } from './McpBudgetShortlist';
import { McpHeroSection } from './McpHeroSection';
import { McpReferenceWorkflowSection } from './McpReferenceWorkflowSection';
import { McpTrustSections } from './McpTrustSections';
import { McpWorkflowStrip } from './McpWorkflowStrip';

export function McpPageView({
  budgetOptions,
  compatibility,
  copy,
  locale,
  proof,
  hostProof = null,
  publication,
}: {
  budgetOptions: McpBudgetOption[];
  compatibility: McpCompatibilityEvidence;
  copy: McpPageCopy;
  locale: AppLocale;
  proof: McpProof | null;
  hostProof?: McpHostProof | null;
  publication: McpPublicationState;
}) {
  return (
    <div className="border-t border-hairline bg-bg text-text-primary dark:border-white/[0.08] dark:bg-bg dark:text-white">
      <McpHeroSection
        copy={copy.hero}
        evidenceCopy={copy.evidence}
        proof={proof}
        hostProof={hostProof}
        publication={publication}
        locale={locale}
        resourceUrl={MCP_PRODUCTION_RESOURCE_URL}
      />
      <McpWorkflowStrip copy={copy.workflow} />
      <McpBudgetShortlist copy={copy.budget} options={budgetOptions} />
      <McpReferenceWorkflowSection copy={copy.references} showReferenceClaim={publication.showReferenceClaim} />
      <McpAnswerPassagesSection
        copy={copy.answers}
        lastChecked={compatibility.lastChecked}
        locale={locale}
        publication={publication}
      />
      <McpTrustSections compatibility={compatibility} copy={copy} locale={locale} publication={publication} />
    </div>
  );
}
