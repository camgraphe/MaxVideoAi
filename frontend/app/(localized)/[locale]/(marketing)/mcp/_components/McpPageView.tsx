import type { AppLocale } from '@/i18n/locales';
import type { McpPublicationState } from '@/lib/mcp-publication';
import type { McpBudgetOption } from '../_lib/mcp-budget-options';
import type { McpCompatibilityEvidence } from '../_lib/mcp-compatibility';
import type { McpPageCopy } from '../_lib/mcp-page-types';
import type { McpProof } from '../_lib/mcp-proof';
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
  publication,
}: {
  budgetOptions: McpBudgetOption[];
  compatibility: McpCompatibilityEvidence;
  copy: McpPageCopy;
  locale: AppLocale;
  proof: McpProof | null;
  publication: McpPublicationState;
}) {
  return (
    <main className="border-t border-hairline bg-bg text-text-primary dark:border-white/[0.08] dark:bg-bg dark:text-white">
      <McpHeroSection copy={copy.hero} evidenceCopy={copy.evidence} proof={proof} publication={publication} />
      <McpWorkflowStrip copy={copy.workflow} />
      <McpBudgetShortlist copy={copy.budget} options={budgetOptions} />
      <McpReferenceWorkflowSection copy={copy.references} showReferenceClaim={publication.showReferenceClaim} />
      <McpTrustSections compatibility={compatibility} copy={copy} locale={locale} publication={publication} />
    </main>
  );
}
