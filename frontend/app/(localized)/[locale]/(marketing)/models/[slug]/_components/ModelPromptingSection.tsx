import type { AppLocale } from '@/i18n/locales';
import { SoraPromptingTabs } from '@/components/marketing/SoraPromptingTabs.client';
import type { FeaturedMedia } from '../_lib/model-page-media';
import {
  FULL_BLEED_SECTION,
  SECTION_BG_B,
  SECTION_PAD,
  SECTION_SCROLL_MARGIN,
  type SoraCopy,
} from '../_lib/model-page-specs';
import { MediaPreview } from './MediaPreview';

type ModelPromptingSectionProps = {
  imageAnchorId: string;
  isVideoEngine: boolean;
  copy: SoraCopy;
  supportsNativeAudio: boolean;
  demoMedia: FeaturedMedia | null;
  locale: AppLocale;
  audioBadgeLabel: string;
  mediaAltContexts: { demo: string };
  useDemoMediaPrompt: boolean;
  decisionReferenceWorkflows?: Array<{ title: string; body: string }>;
};

export function ModelPromptingSection({
  imageAnchorId,
  isVideoEngine,
  copy,
  supportsNativeAudio,
  demoMedia,
  locale,
  audioBadgeLabel,
  mediaAltContexts,
  useDemoMediaPrompt,
  decisionReferenceWorkflows,
}: ModelPromptingSectionProps) {
  const referenceWorkflows = decisionReferenceWorkflows ?? [];
  return (
        <section
          id={imageAnchorId}
          className={`${FULL_BLEED_SECTION} ${SECTION_BG_B} ${SECTION_PAD} ${SECTION_SCROLL_MARGIN} stack-gap`}
        >
          {isVideoEngine ? (
            <div className="stack-gap-lg">
              {referenceWorkflows.length ? (
                <div className="mx-auto grid w-full max-w-5xl gap-3 px-6 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
                  {referenceWorkflows.map((workflow) => (
                    <article key={workflow.title} className="rounded-lg border border-hairline bg-surface px-4 py-3 shadow-card">
                      <h3 className="text-sm font-semibold text-text-primary">{workflow.title}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-text-secondary">{workflow.body}</p>
                    </article>
                  ))}
                </div>
              ) : null}
                <SoraPromptingTabs
                  title={copy.promptingTitle ?? undefined}
                  intro={copy.promptingIntro ?? undefined}
                  tip={copy.promptingTip ?? undefined}
                  guideLabel={copy.promptingGuideLabel ?? undefined}
                  guideUrl={copy.promptingGuideUrl ?? undefined}
                  mode="video"
                  supportsAudio={supportsNativeAudio}
                  tabs={copy.promptingTabs.length ? copy.promptingTabs : undefined}
                  globalPrinciples={copy.promptingGlobalPrinciples}
                  engineWhy={copy.promptingEngineWhy}
                  tabNotes={copy.promptingTabNotes}
                />
              {copy.demoTitle || copy.demoPrompt.length ? (
                <div className="stack-gap-lg">
                  {copy.demoTitle ? (
                    <h2 className="mt-2 text-center text-2xl font-semibold text-text-primary sm:mt-0 sm:text-3xl">
                      {copy.demoTitle}
                    </h2>
                  ) : null}
                  <div className="mx-auto w-full max-w-5xl">
                    {demoMedia ? (
                      <MediaPreview
                        media={demoMedia}
                        label={copy.demoTitle ?? 'Sora 2 demo'}
                        locale={locale}
                        audioBadgeLabel={audioBadgeLabel}
                        altContext={mediaAltContexts.demo}
                        hideLabel
                        promptLabel={useDemoMediaPrompt ? undefined : copy.demoPromptLabel ?? undefined}
                        promptLines={useDemoMediaPrompt ? [] : copy.demoPrompt}
                      />
                    ) : (
                      <div className="flex h-full min-h-[280px] items-center justify-center rounded-xl border border-dashed border-hairline bg-bg text-sm text-text-secondary">
                        {copy.galleryIntro ?? (locale === 'fr' ? 'Aperçu de démonstration.' : locale === 'es' ? 'Vista previa de demostración.' : 'Demo preview.')}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="stack-gap-lg">
              <SoraPromptingTabs
                title={copy.promptingTitle ?? undefined}
                intro={copy.promptingIntro ?? undefined}
                tip={copy.promptingTip ?? undefined}
                guideLabel={copy.promptingGuideLabel ?? undefined}
                guideUrl={copy.promptingGuideUrl ?? undefined}
                mode="image"
                supportsAudio={supportsNativeAudio}
                tabs={copy.promptingTabs.length ? copy.promptingTabs : undefined}
                globalPrinciples={copy.promptingGlobalPrinciples}
                engineWhy={copy.promptingEngineWhy}
                tabNotes={copy.promptingTabNotes}
              />
            </div>
          )}
        </section>
  );
}
