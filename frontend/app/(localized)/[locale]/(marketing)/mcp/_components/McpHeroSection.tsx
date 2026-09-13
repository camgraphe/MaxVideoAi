import type { McpPublicationState } from '@/lib/mcp-publication';
import type { McpPageCopy } from '../_lib/mcp-page-types';
import type { McpProof } from '../_lib/mcp-proof';

export function McpHeroSection({
  copy,
  publication,
}: {
  copy: McpPageCopy['hero'];
  evidenceCopy?: McpPageCopy['evidence'];
  proof: McpProof | null;
  publication: McpPublicationState;
  locale?: import('@/i18n/locales').AppLocale;
  resourceUrl?: string;
}) {
  const labels = [
    ...(publication.showTrialClaim ? [copy.eyebrows.trial] : []),
    copy.eyebrows.budget,
    copy.eyebrows.price,
  ];

  return (
    <header className="border-b border-hairline bg-bg text-text-primary dark:border-white/[0.1] dark:bg-bg dark:text-white">
      <div className="container-page max-w-[1120px] py-14 sm:py-20">
        <div className="max-w-[900px]">
          <div className="flex flex-wrap gap-2">
            {labels.map((label) => (
              <span key={label} className="inline-flex min-h-7 items-center rounded-full border border-hairline bg-surface px-3 text-[11px] font-semibold tracking-micro text-text-secondary dark:border-white/[0.14] dark:bg-white/[0.045] dark:text-white/72">
                {label}
              </span>
            ))}
          </div>
          <h1 className="mt-6 max-w-[760px] text-[40px] font-semibold leading-[1.02] tracking-tight text-text-primary dark:text-white sm:text-[56px]">
            {copy.title}
          </h1>
          <p className="mt-5 max-w-[680px] text-base leading-7 text-text-secondary dark:text-white/70 sm:text-lg">
            {publication.showPaidGenerationClaim ? copy.intro : copy.previewIntro}
          </p>
          {publication.showTrialClaim ? (
            <p className="mt-4 max-w-[680px] rounded-[12px] border border-hairline bg-surface px-4 py-3 text-sm leading-6 text-text-secondary dark:border-white/[0.14] dark:bg-white/[0.045] dark:text-white/70">
              {copy.trialDisclosure}
            </p>
          ) : null}
        </div>
      </div>
    </header>
  );
}
