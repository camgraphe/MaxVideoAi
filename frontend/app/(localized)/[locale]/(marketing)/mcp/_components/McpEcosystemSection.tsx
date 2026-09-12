import Link from 'next/link';
import {
  getMcpIntegrationLabel,
  getMcpVisibleIntegrationIds,
} from '@/lib/mcp-integration-registry';
import type { McpPageCopy } from '../_lib/mcp-page-types';

export function McpEcosystemSection({ copy }: { copy: McpPageCopy['ecosystem'] }) {
  const visible = new Set(getMcpVisibleIntegrationIds());
  return (
    <section className="border-t border-hairline px-4 py-16 dark:border-white/[0.08] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-semibold tracking-[0.18em] text-text-muted">{copy.eyebrow}</p>
        <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-text-primary dark:text-white">{copy.title}</h2>
        <p className="mt-4 max-w-3xl text-base leading-7 text-text-secondary dark:text-white/70">{copy.intro}</p>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {copy.groups.map((group) => (
            <div key={group.category} className="rounded-2xl border border-hairline bg-surface p-5 dark:border-white/[0.12] dark:bg-white/[0.035]">
              <h3 className="text-sm font-semibold text-text-primary dark:text-white">{group.label}</h3>
              <div className="mt-3 space-y-3">
                {group.items.filter((item) => visible.has(item.client)).map((item) => (
                  <Link key={item.client} href={item.href} className="block rounded-xl border border-hairline p-4 transition hover:border-border-hover hover:bg-surface-hover dark:border-white/[0.1] dark:hover:border-white/[0.24] dark:hover:bg-white/[0.05]">
                    <span className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-text-primary dark:text-white">{getMcpIntegrationLabel(item.client)}</span>
                      <span className="rounded-full border border-hairline px-2 py-1 text-[11px] text-text-muted dark:border-white/[0.12] dark:text-white/55">{item.status}</span>
                    </span>
                    <span className="mt-2 block text-sm leading-6 text-text-secondary dark:text-white/65">{item.body}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
