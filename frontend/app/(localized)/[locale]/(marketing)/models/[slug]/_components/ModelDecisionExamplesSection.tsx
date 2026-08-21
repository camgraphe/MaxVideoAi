import type { ModelExamplesViewModel } from '../_lib/model-page-examples-view-model';
import { MODEL_PAGE_ICON, MODEL_PAGE_ICON_WRAP } from '../_lib/model-page-icon-styles';
import { SECTION_SCROLL_MARGIN } from '../_lib/model-page-specs';
import { UIIcon } from '@/components/ui/UIIcon';
import { ModelDecisionExamplesGallery } from './ModelDecisionExamplesGallery.client';

export function ModelDecisionExamplesSection({
  viewModel,
}: {
  viewModel: ModelExamplesViewModel;
}) {
  return (
    <section id={viewModel.anchorId} className={SECTION_SCROLL_MARGIN}>
      <div className="rounded-[28px] border border-slate-200/80 bg-white/92 p-5 shadow-[0_22px_58px_-36px_rgba(15,23,42,0.36)] backdrop-blur dark:border-white/10 dark:bg-slate-950/72 dark:shadow-[0_24px_70px_-42px_rgba(0,0,0,0.85)] sm:p-7">
        <ModelDecisionExamplesGallery
          title={viewModel.section.title}
          intro={viewModel.section.intro}
          filters={viewModel.filters}
          items={viewModel.decision.items}
          examplesLinkHref={viewModel.decision.examplesLinkHref}
          viewAllLabel={viewModel.decision.viewAllLabel}
          renderLinkLabel={viewModel.decision.renderLinkLabel}
          emptyLabel={viewModel.decision.emptyLabel}
          noPreviewLabel={viewModel.decision.noPreviewLabel}
        />

        <div className="mt-4 grid grid-cols-2 rounded-xl border border-slate-200 bg-white/70 dark:border-white/10 dark:bg-white/[0.035] lg:grid-cols-5">
          {viewModel.proofItems.map((item, index) => (
            <div
              key={item.title}
              className={[
                'flex gap-2.5 p-3 sm:gap-3 sm:p-4',
                index % 2 === 1 ? 'border-l border-slate-200 dark:border-white/10' : '',
                index >= 2 ? 'border-t border-slate-200 dark:border-white/10 lg:border-t-0' : '',
                index > 0 ? 'lg:border-l lg:border-slate-200 dark:lg:border-white/10' : '',
              ].join(' ')}
            >
              <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full sm:h-10 sm:w-10 ${MODEL_PAGE_ICON_WRAP}`}>
                <UIIcon icon={item.icon} size={19} strokeWidth={1.85} className={MODEL_PAGE_ICON} />
              </span>
              <div>
                <h3 className="!text-left text-[0.82rem] font-semibold leading-snug text-slate-950 dark:text-white sm:text-sm">{item.title}</h3>
                <p className="mt-1 text-[0.74rem] leading-4 text-slate-600 dark:text-slate-300 sm:text-[0.8rem] sm:leading-5">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
