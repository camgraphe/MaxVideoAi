import Image from 'next/image';
import Link from 'next/link';
import type { McpPublicationState } from '@/lib/mcp-publication';
import type { IntegrationPageCopy } from '../_lib/integration-copy';

const MARKS = {
  claude: {
    light: '/brand/partners/anthropic/claude-mark-light.svg',
    dark: '/brand/partners/anthropic/claude-mark-dark.svg',
  },
  codex: {
    light: '/brand/partners/openai/openai-mark-light.svg',
    dark: '/brand/partners/openai/openai-mark-dark.svg',
  },
} as const;

export function IntegrationHeroSection({
  copy,
  publication,
}: {
  copy: IntegrationPageCopy;
  publication: McpPublicationState;
}) {
  const mark = MARKS[copy.client];
  return (
    <header className="border-b border-hairline bg-bg text-text-primary dark:border-white/[0.1] dark:bg-bg dark:text-white">
      <div className="container-page max-w-[1060px] py-12 sm:py-16">
        <div className="flex h-14 w-14 items-center justify-center rounded-[12px] border border-hairline bg-white shadow-card dark:border-white/[0.16] dark:bg-white">
          <Image src={mark.light} alt="" width={28} height={28} className="h-7 w-7 object-contain dark:hidden" />
          <Image src={mark.dark} alt="" width={28} height={28} className="hidden h-7 w-7 object-contain dark:block" />
        </div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-micro text-text-muted dark:text-white/55">{copy.hero.eyebrow}</p>
        <h1 className="mt-3 max-w-[760px] text-[38px] font-semibold leading-[1.04] tracking-tight text-text-primary dark:text-white sm:text-[52px]">{copy.hero.title}</h1>
        <p className="mt-4 max-w-[760px] text-base leading-7 text-text-secondary dark:text-white/70">{copy.hero.intro}</p>
        <p className="mt-5 max-w-[760px] rounded-[12px] border border-hairline bg-surface px-4 py-3 text-sm font-medium leading-6 text-text-primary dark:border-white/[0.14] dark:bg-white/[0.045] dark:text-white">
          {publication.indexable ? copy.hero.liveStatus : copy.hero.unavailable}
        </p>
        <Link href={copy.hero.backHref} className="mt-5 inline-flex min-h-10 items-center border-b border-hairline text-sm font-semibold text-text-primary hover:border-text-primary dark:border-white/30 dark:text-white dark:hover:border-white">
          ← {copy.hero.backLabel}
        </Link>
      </div>
    </header>
  );
}
