import { AlertCircle, CheckCircle2, ShieldCheck, Wrench } from 'lucide-react';

import { UIIcon } from '@/components/ui/UIIcon';

import {
  MODEL_PAGE_ICON,
  MODEL_PAGE_ICON_MUTED,
  MODEL_PAGE_ICON_RULE,
  MODEL_PAGE_ICON_WRAP,
} from '../_lib/model-page-icon-styles';
import { SECTION_SCROLL_MARGIN, type SoraCopy } from '../_lib/model-page-specs';

type TipsCardLabels = {
  strengths: string;
  boundaries: string;
};

type ModelDecisionTipsSectionProps = {
  copy: SoraCopy;
  modelName: string;
  strengths: string[];
  troubleshootingItems: string[];
  boundaries: string[];
  tipsCardLabels: TipsCardLabels;
  troubleshootingTitle: string | null;
};

const CARD_META = [
  {
    icon: CheckCircle2,
    tone: MODEL_PAGE_ICON_WRAP,
    marker: MODEL_PAGE_ICON_MUTED,
    rule: MODEL_PAGE_ICON_RULE,
  },
  {
    icon: Wrench,
    tone: MODEL_PAGE_ICON_WRAP,
    marker: MODEL_PAGE_ICON_MUTED,
    rule: MODEL_PAGE_ICON_RULE,
  },
  {
    icon: ShieldCheck,
    tone: MODEL_PAGE_ICON_WRAP,
    marker: MODEL_PAGE_ICON_MUTED,
    rule: MODEL_PAGE_ICON_RULE,
  },
] as const;

function getTipsIntro(copy: SoraCopy, modelName: string) {
  return (
    copy.tipsIntro ??
    `Best practices, common fixes, and important limitations to help you get the strongest results with ${modelName}.`
  );
}

export function ModelDecisionTipsSection({
  copy,
  modelName,
  strengths,
  troubleshootingItems,
  boundaries,
  tipsCardLabels,
  troubleshootingTitle,
}: ModelDecisionTipsSectionProps) {
  const groups = [
    { title: tipsCardLabels.strengths, items: strengths },
    { title: troubleshootingTitle ?? 'Common problems -> fast fixes', items: troubleshootingItems },
    { title: tipsCardLabels.boundaries, items: boundaries },
  ].filter((group) => group.items.length);

  if (!groups.length) return null;

  return (
    <section id="tips" className={`${SECTION_SCROLL_MARGIN} space-y-5 py-6`}>
      <div>
        <h2 className="!text-left text-3xl font-semibold leading-tight text-text-primary">
          {copy.tipsTitle ?? 'Tips and boundaries'}
        </h2>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-text-secondary">{getTipsIntro(copy, modelName)}</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {groups.map((group, index) => {
          const meta = CARD_META[index] ?? CARD_META[0];
          return (
            <article
              key={group.title}
              className="min-h-[320px] rounded-xl border border-slate-200/80 bg-white/92 p-6 shadow-[0_22px_58px_-38px_rgba(15,23,42,0.34)] dark:border-white/10 dark:bg-slate-950/72"
            >
              <span className={`inline-flex h-14 w-14 items-center justify-center rounded-full ${meta.tone}`}>
                <UIIcon icon={meta.icon} size={25} strokeWidth={1.9} className={MODEL_PAGE_ICON} />
              </span>
              <h3 className="mt-5 !text-left text-base font-semibold text-text-primary">{group.title}</h3>
              <span className={`mt-3 block h-0.5 w-8 rounded-full ${meta.rule}`} aria-hidden />
              <ul className="mt-7 space-y-4 text-sm leading-6 text-text-secondary">
                {group.items.map((item) => (
                  <li key={item} className="flex gap-3">
                    <UIIcon
                      icon={index === 1 ? AlertCircle : CheckCircle2}
                      size={15}
                      className={`mt-0.5 shrink-0 ${meta.marker}`}
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
    </section>
  );
}
