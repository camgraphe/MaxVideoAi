import {
  ImageIcon,
  Maximize2,
  PenLine,
  Sparkles,
  Type,
  Users,
  type LucideIcon,
} from 'lucide-react';

import { UIIcon } from '@/components/ui/UIIcon';

import { MODEL_PAGE_ICON, MODEL_PAGE_ICON_WRAP } from '../_lib/model-page-icon-styles';
import type { ModelPromptingContent } from '../_lib/model-page-prompting-content';
import { ModelDecisionCopyButton } from './ModelDecisionCopyButton.client';

const IMAGE_EXAMPLE_ICONS = {
  image: ImageIcon,
  references: Users,
  edit: PenLine,
  typography: Type,
  layout: Maximize2,
  quality: Sparkles,
} as const satisfies Record<string, LucideIcon>;

export function ModelDecisionImagePromptExamples({
  copiedLabel,
  copyLabel,
  engineSlug,
  imageExamples,
}: {
  copiedLabel: string;
  copyLabel: string;
  engineSlug: string;
  imageExamples: NonNullable<ModelPromptingContent['imageExamples']>;
}) {
  return (
    <article className="rounded-[22px] border border-slate-200/80 bg-white/[0.92] p-5 shadow-[0_22px_58px_-36px_rgba(15,23,42,0.36)] backdrop-blur dark:border-white/10 dark:!bg-slate-950/[0.72]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="!text-left text-2xl font-semibold text-text-primary">{imageExamples.title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">{imageExamples.intro}</p>
        </div>
        <a
          href={`/app/image?engine=${encodeURIComponent(engineSlug)}`}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-hairline bg-surface px-4 text-sm font-semibold text-text-primary shadow-sm transition hover:bg-surface-2"
        >
          <UIIcon icon={Sparkles} size={15} />
          <span>{imageExamples.workspaceLabel}</span>
        </a>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {imageExamples.items.map((example) => {
          const Icon = IMAGE_EXAMPLE_ICONS[example.kind];
          return (
            <article key={example.title} className="rounded-xl border border-hairline bg-surface p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${MODEL_PAGE_ICON_WRAP}`}>
                  <UIIcon icon={Icon} size={18} className={MODEL_PAGE_ICON} />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="!text-left text-base font-semibold text-text-primary">{example.title}</h3>
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[0.68rem] font-semibold text-blue-700 dark:!bg-blue-500/[0.12] dark:text-blue-200">
                      {example.badge}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-text-secondary">{example.prompt}</p>
                  <div className="mt-3">
                    <ModelDecisionCopyButton copyText={example.prompt} label={copyLabel} copiedLabel={copiedLabel} />
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </article>
  );
}
