'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { PriceChip } from '@/components/marketing/PriceChip';
import { Button } from '@/components/ui/Button';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { DEFAULT_MARKETING_SCENARIO } from '@/lib/pricing-scenarios';
import type { PricingRuleLite } from '@/lib/pricing-rules';

type ProofTabsProps = {
  pricingRules?: PricingRuleLite[];
};

export function ProofTabs({ pricingRules }: ProofTabsProps) {
  const { t } = useI18n();
  const tabs = t('home.proofTabs', []) as Array<{ id: string; label: string; heading: string; body: string }>;
  const [activeId, setActiveId] = useState<string>(tabs[0]?.id ?? 'brief');
  const activeTab = tabs.find((entry) => entry.id === activeId) ?? tabs[0];
  const priceChipSuffix = t('home.priceChipSuffix', 'Price before you generate.');

  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
      <div className="rounded-card border border-hairline bg-surface p-6 shadow-card sm:p-8">
        <div className="flex flex-wrap gap-4">
          {tabs.map((tab) => {
            const isActive = tab.id === activeId;
            return (
              <Button
                key={tab.id}
                type="button"
                size="sm"
                variant={isActive ? 'primary' : 'outline'}
                onClick={() => setActiveId(tab.id)}
                className={clsx(
                  'min-h-0 h-auto rounded-pill px-4 py-2 text-sm font-medium',
                  isActive ? 'border border-brand' : 'border-hairline text-text-secondary hover:text-text-primary'
                )}
                aria-pressed={isActive}
              >
                {tab.label}
              </Button>
            );
          })}
        </div>
        <div className="mt-6 stack-gap">
          <div>
            <h3 className="text-xl font-semibold text-text-primary sm:text-2xl">{activeTab.heading}</h3>
            <p className="mt-2 max-w-3xl text-base text-text-secondary sm:text-lg">{activeTab.body}</p>
          </div>
          {activeTab.id === 'price' && (
            <PriceChip {...DEFAULT_MARKETING_SCENARIO} suffix={priceChipSuffix} pricingRules={pricingRules} />
          )}
        </div>
      </div>
    </section>
  );
}
