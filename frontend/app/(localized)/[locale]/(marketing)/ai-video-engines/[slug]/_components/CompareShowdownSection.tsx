import type { AppLocale } from '@/i18n/locales';
import { Link } from '@/i18n/navigation';
import { DeferredSourcePrompt } from '@/components/i18n/DeferredSourcePrompt.client';
import { getImageAlt } from '@/lib/image-alt';
import type { CompareDetailLabels, ComparePageCopy } from '../_lib/compare-page-copy';
import {
  buildGenerateHref,
  formatEngineName,
  formatEngineShortName,
  formatTemplate,
} from '../_lib/compare-page-helpers';
import type { CompareShowdownSlot, EngineCatalogEntry } from '../_lib/compare-page-types';
import { CopyPromptButton } from '../CopyPromptButton.client';
import { renderShowdownMedia } from './CompareShowdownMedia';

type CompareShowdownSectionProps = {
  activeLocale: AppLocale;
  compareCopy: ComparePageCopy;
  exposeSourcePrompt: boolean;
  labels: CompareDetailLabels;
  left: EngineCatalogEntry;
  leftIsPrelaunch: boolean;
  localizedPromptNote: string;
  right: EngineCatalogEntry;
  rightIsPrelaunch: boolean;
  showdownActionHint: string;
  showdownActionLabel: string;
  showdownSlots: CompareShowdownSlot[];
  showdownSubtitle: string;
  slug: string;
};

export function CompareShowdownSection({
  activeLocale,
  compareCopy,
  exposeSourcePrompt,
  labels,
  left,
  leftIsPrelaunch,
  localizedPromptNote,
  right,
  rightIsPrelaunch,
  showdownActionHint,
  showdownActionLabel,
  showdownSlots,
  showdownSubtitle,
  slug,
}: CompareShowdownSectionProps) {
  if (!showdownSlots.length) return null;

  return (
    <section className="stack-gap-sm">
      <h2 className="text-2xl font-semibold text-text-primary">
        {compareCopy.showdown?.title ?? 'Showdown (same prompt)'}
      </h2>
      <p className="text-sm text-text-secondary">{showdownSubtitle}</p>
      <p className="text-xs text-text-muted">{compareCopy.showdown?.note ?? 'Showing up to 3 prompt pairs for clarity.'}</p>

      <div className="stack-gap-lg">
        {showdownSlots.map((entry) => {
          const leftLabel = entry.left.label ?? formatEngineName(left);
          const rightLabel = entry.right.label ?? formatEngineName(right);
          const leftAlt = getImageAlt({
            kind: 'compareThumb',
            engine: leftLabel,
            compareEngine: rightLabel,
            label: `${entry.title} - ${leftLabel}`,
            locale: activeLocale,
          });
          const rightAlt = getImageAlt({
            kind: 'compareThumb',
            engine: rightLabel,
            compareEngine: leftLabel,
            label: `${entry.title} - ${rightLabel}`,
            locale: activeLocale,
          });

          return (
            <article key={`${slug}-showdown-${entry.id}`} className="rounded-card border border-hairline bg-surface p-6 shadow-card">
              <div className="stack-gap-sm">
                <div>
                  <h3 className="text-lg font-semibold text-text-primary">{entry.title}</h3>
                  <p className="text-sm text-text-secondary">
                    {labels.whatTests}: {entry.whatItTests}
                  </p>
                </div>
                <div className="rounded-card border border-hairline bg-surface-2 p-3 text-sm text-text-secondary">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">{labels.prompt}</span>
                    {exposeSourcePrompt ? (
                      <CopyPromptButton
                        prompt={entry.prompt}
                        copyLabel={compareCopy.labels?.copyPrompt ?? 'Copy prompt'}
                        copiedLabel={compareCopy.labels?.copied ?? 'Copied'}
                      />
                    ) : null}
                  </div>
                  {exposeSourcePrompt ? (
                    <DeferredSourcePrompt
                      locale={activeLocale}
                      prompt={entry.prompt}
                      mode="details"
                      className="mt-2"
                      summaryClassName="cursor-pointer list-none text-xs font-semibold text-brand"
                      promptClassName="mt-2 whitespace-pre-wrap text-text-primary"
                      fallbackClassName="mt-2 text-sm text-text-secondary"
                    />
                  ) : (
                    <p className="mt-2 text-sm text-text-secondary">{localizedPromptNote}</p>
                  )}
                </div>
                <div className="grid grid-gap lg:grid-cols-2">
                  {renderShowdownMedia(
                    entry.left,
                    formatEngineName(left),
                    labels.placeholder,
                    labels.placeholder,
                    entry.aspectRatio,
                    leftAlt
                  )}
                  {renderShowdownMedia(
                    entry.right,
                    formatEngineName(right),
                    labels.placeholder,
                    labels.placeholder,
                    entry.aspectRatio,
                    rightAlt
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm text-text-secondary">
                  <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">{showdownActionLabel}</span>
                  <Link
                    href={buildGenerateHref(
                      left.modelSlug,
                      exposeSourcePrompt ? entry.prompt : null,
                      entry.aspectRatio,
                      entry.mode
                    )}
                    prefetch={false}
                    className="rounded-full border border-hairline bg-surface px-3 py-1 text-xs font-semibold text-text-primary transition hover:bg-surface-2"
                  >
                    {leftIsPrelaunch
                      ? labels.savePromptForLaunch
                      : formatTemplate(compareCopy.scorecard?.generateWith ?? 'Generate with {engine}', {
                          engine: formatEngineShortName(left),
                        })}
                  </Link>
                  <Link
                    href={buildGenerateHref(
                      right.modelSlug,
                      exposeSourcePrompt ? entry.prompt : null,
                      entry.aspectRatio,
                      entry.mode
                    )}
                    prefetch={false}
                    className="rounded-full border border-hairline bg-surface px-3 py-1 text-xs font-semibold text-text-primary transition hover:bg-surface-2"
                  >
                    {rightIsPrelaunch
                      ? labels.savePromptForLaunch
                      : formatTemplate(compareCopy.scorecard?.generateWith ?? 'Generate with {engine}', {
                          engine: formatEngineShortName(right),
                        })}
                  </Link>
                  <span className="text-xs text-text-muted">{showdownActionHint}</span>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <p className="text-sm text-text-secondary">
        {compareCopy.showdown?.footer ??
          'This side-by-side AI video comparison uses identical prompts to highlight differences in motion, realism, human fidelity, and text legibility. For full specs, controls, and more prompt examples, open each engine profile.'}
      </p>
    </section>
  );
}
