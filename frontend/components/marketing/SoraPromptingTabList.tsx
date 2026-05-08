'use client';

import clsx from 'clsx';
import { Button } from '@/components/ui/Button';
import { buildPanelId, buildTabId, type PromptingTab, type TabId } from '@/components/marketing/sora-prompting-content';

type SoraPromptingTabListProps = {
  activeId: TabId;
  tabs: PromptingTab[];
  onActiveIdChange: (id: TabId) => void;
};

export function SoraPromptingTabList({ activeId, tabs, onActiveIdChange }: SoraPromptingTabListProps) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Prompt levels">
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <Button
            key={tab.id}
            type="button"
            size="sm"
            variant={isActive ? 'primary' : 'outline'}
            onClick={() => onActiveIdChange(tab.id)}
            className={clsx(
              'min-h-0 h-auto rounded-full px-4 py-2 text-sm font-semibold',
              isActive ? 'border border-brand' : 'border-hairline text-text-secondary hover:text-text-primary'
            )}
            role="tab"
            id={buildTabId(tab.id)}
            aria-selected={isActive}
            aria-controls={buildPanelId(tab.id)}
          >
            {tab.label}
          </Button>
        );
      })}
    </div>
  );
}
