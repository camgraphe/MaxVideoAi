import {
  FULL_BLEED_SECTION,
  SECTION_BG_A,
  SECTION_PAD,
  SECTION_SCROLL_MARGIN,
  type SoraCopy,
} from '../_lib/model-page-specs';

type TipsCardLabels = {
  strengths: string;
  boundaries: string;
};

type ModelTipsSectionProps = {
  hasTipsSection: boolean;
  copy: SoraCopy;
  strengths: string[];
  troubleshootingItems: string[];
  boundaries: string[];
  tipsCardLabels: TipsCardLabels;
  troubleshootingTitle: string | null;
};

export function ModelTipsSection({
  hasTipsSection,
  copy,
  strengths,
  troubleshootingItems,
  boundaries,
  tipsCardLabels,
  troubleshootingTitle,
}: ModelTipsSectionProps) {
  return hasTipsSection ? (
          <section id="tips" className={`${FULL_BLEED_SECTION} ${SECTION_BG_A} ${SECTION_PAD} ${SECTION_SCROLL_MARGIN} stack-gap-lg`}>
            <h2 className="mt-2 text-2xl font-semibold text-text-primary sm:text-3xl sm:mt-0">
              {copy.tipsTitle ?? 'Tips & Limitations'}
            </h2>
            {copy.tipsIntro ? (
              <p className="text-center text-base leading-relaxed text-text-secondary">{copy.tipsIntro}</p>
            ) : null}
            {(() => {
              const tipsCardCount =
                (strengths.length ? 1 : 0) +
                (troubleshootingItems.length ? 1 : 0) +
                (boundaries.length ? 1 : 0);
              const gridClass =
                tipsCardCount === 1
                  ? 'mx-auto grid w-full max-w-3xl grid-gap-sm'
                  : tipsCardCount === 2
                  ? 'mx-auto grid w-full max-w-4xl grid-gap-sm lg:grid-cols-2'
                  : 'mx-auto grid w-full max-w-5xl grid-gap-sm lg:grid-cols-3';
              return (
                <div className={gridClass}>
              {strengths.length ? (
                <div className="stack-gap-sm rounded-2xl border border-hairline bg-surface/80 p-4 shadow-card">
                  <h3 className="text-base font-semibold text-text-primary">{tipsCardLabels.strengths}</h3>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
                    {strengths.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {troubleshootingItems.length ? (
                <div className="stack-gap-sm rounded-2xl border border-hairline bg-surface/80 p-4 shadow-card">
                  <h3 className="text-base font-semibold text-text-primary">
                    {troubleshootingTitle ?? 'Common problems → fast fixes'}
                  </h3>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
                    {troubleshootingItems.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {boundaries.length ? (
                <div className="stack-gap-sm rounded-2xl border border-hairline bg-surface/80 p-4 shadow-card">
                  <h3 className="text-base font-semibold text-text-primary">{tipsCardLabels.boundaries}</h3>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
                    {boundaries.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
                </div>
              );
            })()}
          </section>
  ) : null;
}
