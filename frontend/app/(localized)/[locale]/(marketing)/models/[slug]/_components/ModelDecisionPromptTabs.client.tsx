'use client';

import { useMemo, useState } from 'react';
import { ArrowRight, Box, Camera, Clock3, FileText, Play, Sparkles } from 'lucide-react';

import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import { UIIcon } from '@/components/ui/UIIcon';

import { MODEL_PAGE_ICON } from '../_lib/model-page-icon-styles';
import type { PromptingTab } from '../_lib/model-page-specs';
import { ModelDecisionCopyButton } from './ModelDecisionCopyButton.client';

type ModelDecisionPromptTabsProps = {
  tabs: PromptingTab[];
  locale: AppLocale;
  exampleHref: string | null;
};

const TAB_ICONS = [FileText, Box, Camera, Sparkles] as const;

function getCopy(locale: AppLocale) {
  if (locale === 'fr') {
    return {
      copyTemplate: 'Copier le template',
      copied: 'Copié',
      example: 'EXEMPLE',
      viewRender: 'Voir le rendu exemple',
      usePrompt: 'Utiliser ce prompt',
    };
  }
  if (locale === 'es') {
    return {
      copyTemplate: 'Copiar plantilla',
      copied: 'Copiado',
      example: 'EJEMPLO',
      viewRender: 'Ver ejemplo',
      usePrompt: 'Usar este prompt',
    };
  }
  return {
    copyTemplate: 'Copy template',
    copied: 'Copied',
    example: 'EXAMPLE',
    viewRender: 'View example render',
    usePrompt: 'Use this prompt',
  };
}

function splitPromptCopy(value: string) {
  const match = value.match(/\n\nExample:\n/i);
  if (!match || typeof match.index !== 'number') {
    return { template: value.trim(), example: '' };
  }
  return {
    template: value.slice(0, match.index).trim(),
    example: value.slice(match.index + match[0].length).trim(),
  };
}

export function ModelDecisionPromptTabs({ tabs, locale, exampleHref }: ModelDecisionPromptTabsProps) {
  const [activeId, setActiveId] = useState(() => tabs[0]?.id ?? 'quick');
  const activeTab = tabs.find((tab) => tab.id === activeId) ?? tabs[0] ?? null;
  const labels = getCopy(locale);
  const activeCopy = useMemo(() => splitPromptCopy(activeTab?.copy ?? ''), [activeTab?.copy]);

  if (!activeTab) return null;

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab, index) => {
          const Icon = TAB_ICONS[index] ?? FileText;
          const isActive = tab.id === activeTab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveId(tab.id)}
              className={[
                'inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-5 text-sm font-semibold shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
                isActive
                  ? 'border-slate-950 bg-slate-950 text-white dark:border-white/15 dark:bg-white dark:text-slate-950'
                  : 'border-hairline bg-surface text-text-secondary hover:bg-surface-2 hover:text-text-primary',
              ].join(' ')}
            >
              <UIIcon icon={Icon} size={15} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <article className="mt-3 rounded-[20px] border border-hairline bg-surface p-5 shadow-[0_18px_54px_-38px_rgba(15,23,42,0.42)] dark:bg-white/[0.045]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="!text-left text-xl font-semibold text-text-primary">{activeTab.title}</h3>
            {activeTab.description ? (
              <p className="mt-1 text-sm leading-6 text-text-secondary">{activeTab.description}</p>
            ) : null}
          </div>
          <ModelDecisionCopyButton
            copyText={activeCopy.template || activeTab.copy}
            label={labels.copyTemplate}
            copiedLabel={labels.copied}
          />
        </div>

        <pre className="mt-4 max-h-[250px] overflow-auto whitespace-pre-wrap rounded-xl border border-hairline bg-bg px-4 py-4 font-mono text-[0.82rem] leading-6 text-text-primary dark:bg-slate-950/72">
          {activeCopy.template}
        </pre>

        <div className="mt-4 rounded-xl border border-hairline bg-bg/80 p-4 dark:bg-slate-950/42">
          <div className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-blue-600 dark:text-blue-300">
            <UIIcon icon={Sparkles} size={14} className={MODEL_PAGE_ICON} />
            <span>{labels.example}</span>
          </div>
          <p className="text-sm leading-6 text-text-secondary">
            {activeCopy.example || activeTab.copy.split('\n').slice(-3).join(' ')}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {exampleHref ? (
              <Link
                href={exampleHref}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-hairline bg-surface px-4 text-sm font-semibold text-text-primary shadow-sm transition hover:bg-surface-2"
              >
                <UIIcon icon={Play} size={15} />
                <span>{labels.viewRender}</span>
                <UIIcon icon={ArrowRight} size={15} />
              </Link>
            ) : null}
            <Link
              href="/app?engine=seedance-2-0"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-hairline bg-surface px-4 text-sm font-semibold text-text-primary shadow-sm transition hover:bg-surface-2"
            >
              <UIIcon icon={Clock3} size={15} />
              <span>{labels.usePrompt}</span>
              <UIIcon icon={ArrowRight} size={15} />
            </Link>
          </div>
        </div>
      </article>
    </div>
  );
}
