'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { PriceChip } from '@/components/marketing/PriceChip';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { DEFAULT_MARKETING_SCENARIO } from '@/lib/pricing-scenarios';

export function ProofTabs() {
  const { t } = useI18n();
  const tabs = t('home.proofTabs', []) as Array<{ id: string; label: string; heading: string; body: string }>;
  const [activeId, setActiveId] = useState<string>(tabs[0]?.id ?? 'brief');
  const activeTab = tabs.find((entry) => entry.id === activeId) ?? tabs[0];
  const priceChipSuffix = t('home.priceChipSuffix', 'Price before you generate.');

  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
      <div className="rounded-card border border-hairline bg-white p-6 shadow-card sm:p-8">
        <div className="flex flex-wrap gap-3">
          {tabs.map((tab) => {
            const isActive = tab.id === activeId;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveId(tab.id)}
                className={clsx(
                  'rounded-pill border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white',
                  isActive ? 'border-accent bg-accent text-white' : 'border-hairline text-text-secondary hover:text-text-primary'
                )}
                aria-pressed={isActive}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        <div className="mt-6 space-y-4">
          <div>
            <h3 className="text-xl font-semibold text-text-primary sm:text-2xl">{activeTab.heading}</h3>
            <p className="mt-2 max-w-3xl text-base text-text-secondary sm:text-lg">{activeTab.body}</p>
          </div>
          {activeTab.id === 'price' && <PriceChip {...DEFAULT_MARKETING_SCENARIO} suffix={priceChipSuffix} />}
        </div>
      </div>
    </section>
  );
}
