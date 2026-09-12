import Link from 'next/link';
import { getMcpIntegrationLabel } from '@/lib/mcp-integration-registry';
import type { McpPageCopy } from '../_lib/mcp-page-types';

export function McpEcosystemOverview({ copy }: { copy: McpPageCopy['ecosystem'] }) {
  return (
    <section className="border-t border-hairline px-4 py-8 dark:border-white/[0.08] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
          <h2 className="text-lg font-semibold tracking-tight text-text-primary dark:text-white">{copy.overviewLabel}</h2>
          <p className="max-w-3xl text-sm leading-6 text-text-secondary dark:text-white/65">{copy.overviewIntro}</p>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {copy.overview.map((item) => {
            const content = (
              <>
                <span className="font-semibold text-text-primary dark:text-white">{getMcpIntegrationLabel(item.client)}</span>
                <span className="mt-2 block text-[11px] leading-4 text-text-muted dark:text-white/55">{item.status}</span>
              </>
            );
            const className = `min-h-24 rounded-xl border p-4 ${item.availability === 'preview'
              ? 'border-hairline bg-surface transition hover:border-border-hover hover:bg-surface-hover dark:border-white/[0.12] dark:bg-white/[0.035] dark:hover:border-white/[0.24] dark:hover:bg-white/[0.05]'
              : 'border-hairline/70 bg-surface/45 dark:border-white/[0.07] dark:bg-white/[0.018]'
            }`;

            return item.href ? (
              <Link key={item.client} href={item.href} className={className}>{content}</Link>
            ) : (
              <div key={item.client} className={className}>{content}</div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
