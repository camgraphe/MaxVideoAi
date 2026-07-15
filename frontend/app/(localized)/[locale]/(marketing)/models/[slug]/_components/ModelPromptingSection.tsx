import { SoraPromptingTabs } from '@/components/marketing/SoraPromptingTabs.client';
import type { PromptingTab } from '@/components/marketing/sora-prompting-content';

import type { ModelPromptingViewModel } from '../_lib/model-page-prompting-view-model';
import {
  FULL_BLEED_SECTION,
  SECTION_BG_B,
  SECTION_PAD,
  SECTION_SCROLL_MARGIN,
} from '../_lib/model-page-specs';
import { MediaPreview } from './MediaPreview';
import { ModelDecisionPromptingSection } from './ModelDecisionPromptingSection';

type ModelPromptingSectionProps = {
  viewModel: ModelPromptingViewModel;
  variant?: 'default' | 'decision';
};

function toLegacyTabs(viewModel: ModelPromptingViewModel): PromptingTab[] {
  return viewModel.tabs.items.map((tab) => ({
    ...tab,
    description: tab.description ?? undefined,
  }));
}

export function ModelPromptingSection({
  viewModel,
  variant = 'default',
}: ModelPromptingSectionProps) {
  if (variant === 'decision') {
    return <ModelDecisionPromptingSection viewModel={viewModel} />;
  }

  const guide = viewModel.section.guide;
  const demo = viewModel.demo;
  const defaultPresentation = viewModel.defaultPresentation;

  return (
    <section
      id={viewModel.id}
      className={`${FULL_BLEED_SECTION} ${SECTION_BG_B} ${SECTION_PAD} ${SECTION_SCROLL_MARGIN} stack-gap`}
    >
      <div className="stack-gap-lg">
        {viewModel.referenceWorkflows.length ? (
          <div className="mx-auto grid w-full max-w-5xl gap-3 px-6 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
            {viewModel.referenceWorkflows.map((workflow) => (
              <article key={workflow.title} className="rounded-lg border border-hairline bg-surface px-4 py-3 shadow-card">
                <h3 className="text-sm font-semibold text-text-primary">{workflow.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-text-secondary">{workflow.body}</p>
              </article>
            ))}
          </div>
        ) : null}
        <SoraPromptingTabs
          title={viewModel.section.title}
          intro={viewModel.section.intro ?? undefined}
          tip={viewModel.section.tip ?? undefined}
          guideLabel={guide?.label}
          guideUrl={guide?.href}
          mode={viewModel.defaultPresentation.mode}
          supportsAudio={viewModel.defaultPresentation.supportsAudio}
          tabs={toLegacyTabs(viewModel)}
          globalPrinciples={viewModel.globalPrinciples}
          engineWhy={viewModel.engineWhy}
          tabNotes={viewModel.tabs.notesById}
        />
        {demo ? (
          <div className="stack-gap-lg">
            <h2 className="mt-2 text-center text-2xl font-semibold text-text-primary sm:mt-0 sm:text-3xl">
              {demo.title}
            </h2>
            <div className="mx-auto w-full max-w-5xl">
              {defaultPresentation.demo ? (
                <MediaPreview
                  media={defaultPresentation.demo.media}
                  label={defaultPresentation.demo.label}
                  locale={viewModel.defaultPresentation.locale}
                  audioBadgeLabel={defaultPresentation.demo.audioBadgeLabel}
                  altContext={defaultPresentation.demo.altContext}
                  hideLabel
                  promptLabel={defaultPresentation.demo.promptLabel}
                  promptLines={defaultPresentation.demo.promptLines}
                />
              ) : (
                <div className="flex h-full min-h-[280px] items-center justify-center rounded-xl border border-dashed border-hairline bg-bg text-sm text-text-secondary">
                  {viewModel.ui.demoPreview}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
