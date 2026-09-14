import Link from 'next/link';
import { McpIntegrationMark } from '@/components/marketing/mcp/McpIntegrationMark';
import { getMcpIntegrationLabel } from '@/lib/mcp-integration-registry';
import type { McpClientActionCopy, McpPageCopy } from '../_lib/mcp-page-types';
import { McpClientActions } from './McpClientActions';

export function McpPlatformSelector({
  actions,
  copy,
}: {
  actions: McpClientActionCopy[];
  copy: McpPageCopy['ecosystem'];
}) {
  return (
    <section id="platforms" className="scroll-mt-24 border-b border-hairline bg-surface py-12 text-text-primary dark:border-white/[0.1] dark:bg-white/[0.025] dark:text-white">
      <div className="container-page max-w-[1120px]">
        <p className="text-xs font-semibold uppercase tracking-micro text-text-secondary dark:text-white/68">{copy.eyebrow}</p>
        <div className="mt-2 grid gap-3 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <h2 className="text-3xl font-semibold leading-tight text-text-primary dark:text-white">{copy.title}</h2>
          <p className="text-sm leading-6 text-text-secondary dark:text-white/68">{copy.intro}</p>
        </div>

        <h3 className="mt-8 text-sm font-semibold text-text-primary dark:text-white">{copy.primaryLabel}</h3>
        <div className="mt-3">
          <McpClientActions actions={actions} tier="live" />
        </div>

        <h3 className="mt-7 text-sm font-semibold text-text-primary dark:text-white">{copy.secondaryLabel}</h3>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {copy.overview.map((item) => {
            const content = (
              <>
                <span className="flex items-center gap-2.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-hairline bg-white dark:border-white/[0.12] dark:bg-neutral-900">
                    <McpIntegrationMark integration={item.client} size={20} className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 font-semibold leading-5 text-text-primary dark:text-white">{getMcpIntegrationLabel(item.client)}</span>
                </span>
                <span className="mt-2 block text-[11px] leading-4 text-text-muted dark:text-white/55">{item.status}</span>
              </>
            );
            const className = 'min-h-24 rounded-xl border border-hairline bg-bg/45 p-4 dark:border-white/[0.07] dark:bg-white/[0.018]';

            return item.href ? (
              <Link key={item.client} href={item.href} className={className}>{content}</Link>
            ) : (
              <div key={item.client} className={className} data-platform-tier="preparing">{content}</div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
