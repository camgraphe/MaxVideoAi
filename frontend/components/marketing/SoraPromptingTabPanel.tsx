'use client';

import { CopyPromptButton } from '@/components/CopyPromptButton';
import {
  buildPanelId,
  buildTabId,
  QUICK_EXAMPLE,
  QUICK_EXAMPLE_NO_AUDIO,
  type PromptingMode,
  type PromptingTab,
  type TabId,
} from '@/components/marketing/sora-prompting-content';

type SoraPromptingTabPanelProps = {
  activeId: TabId;
  mode: PromptingMode;
  note?: string;
  supportsAudio: boolean;
  tab: PromptingTab;
};

export function SoraPromptingTabPanel({ activeId, mode, note, supportsAudio, tab }: SoraPromptingTabPanelProps) {
  const isActive = tab.id === activeId;

  return (
    <div
      id={buildPanelId(tab.id)}
      role="tabpanel"
      aria-labelledby={buildTabId(tab.id)}
      aria-hidden={!isActive}
      hidden={!isActive}
    >
      <article className="stack-gap-sm rounded-2xl border border-hairline bg-surface/80 p-4 shadow-card">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-text-primary">{tab.title}</h3>
            {tab.description ? <p className="text-sm text-text-secondary">{tab.description}</p> : null}
            {note ? <p className="text-xs text-text-muted">{note}</p> : null}
          </div>
          <CopyPromptButton prompt={tab.copy} copyLabel="Copy template" />
        </header>

        <div className="stack-gap-sm">
          <div className="rounded-xl border border-dashed border-hairline bg-bg px-4 py-3 text-sm text-text-secondary">
            <p className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">
              Template (copy/paste)
            </p>
            <pre className="mt-2 whitespace-pre-wrap font-mono text-sm text-text-primary">{tab.copy}</pre>
          </div>
          {tab.id === 'quick' && mode === 'video' ? (
            <div className="rounded-xl border border-hairline bg-surface-2 px-4 py-3 text-sm text-text-secondary">
              <p className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">Example</p>
              <p className="mt-2">{supportsAudio ? QUICK_EXAMPLE : QUICK_EXAMPLE_NO_AUDIO}</p>
            </div>
          ) : null}
        </div>
      </article>
    </div>
  );
}
