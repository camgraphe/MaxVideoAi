import Image from 'next/image';
import Link from 'next/link';
import type { AppLocale } from '@/i18n/locales';
import type { McpPublicationState } from '@/lib/mcp-publication';
import type { McpHostProof } from '../../mcp/_lib/mcp-host-proof';
import { McpHostProofCard } from '../../mcp/_components/McpHostProofCard';
import type { IntegrationPageCopy } from '../_lib/integration-copy';
import { IntegrationConversationPreview } from './IntegrationConversationPreview';

const MARKS = {
  claude: {
    light: '/brand/partners/anthropic/claude-mark-light.svg',
    dark: '/brand/partners/anthropic/claude-mark-dark.svg',
  },
  chatgpt: {
    light: '/brand/partners/openai/openai-mark-light.svg',
    dark: '/brand/partners/openai/openai-mark-dark.svg',
  },
  codex: {
    light: '/brand/partners/openai/openai-mark-light.svg',
    dark: '/brand/partners/openai/openai-mark-dark.svg',
  },
} as const;

export function IntegrationHeroSection({
  copy,
  publication,
  locale = 'en',
  hostProof = null,
}: {
  copy: IntegrationPageCopy;
  publication: McpPublicationState;
  locale?: AppLocale;
  hostProof?: McpHostProof | null;
}) {
  const mark = MARKS[copy.client];
  return (
    <header className="border-b border-hairline bg-bg text-text-primary dark:border-white/[0.1] dark:bg-bg dark:text-white">
      <div className="container-page grid max-w-[1220px] gap-9 py-12 sm:py-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-12">
        <div className="max-w-[650px]">
          <div className="flex h-14 w-14 items-center justify-center rounded-[12px] border border-hairline bg-white shadow-card dark:border-white/[0.16] dark:bg-neutral-900">
            <Image src={mark.light} alt="" aria-hidden="true" width={28} height={28} className="h-7 w-7 object-contain dark:hidden" />
            <Image src={mark.dark} alt="" aria-hidden="true" width={28} height={28} className="hidden h-7 w-7 object-contain dark:block" />
          </div>
          <p className="mt-5 text-xs font-semibold uppercase tracking-micro text-text-secondary dark:text-white/68">{copy.hero.eyebrow}</p>
          <h1 className="mt-3 text-[38px] font-semibold leading-[1.04] tracking-tight text-text-primary dark:text-white sm:text-[52px]">{copy.hero.title}</h1>
          <p className="mt-4 text-base leading-7 text-text-secondary dark:text-white/70">{copy.hero.intro}</p>
          <p className="mt-5 rounded-[12px] border border-hairline bg-surface px-4 py-3 text-sm font-medium leading-6 text-text-primary dark:border-white/[0.14] dark:bg-white/[0.045] dark:text-white">
            {publication.connectionAvailable ? copy.hero.liveStatus : copy.hero.accountStatus}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link href="#setup" className="inline-flex min-h-11 items-center rounded-[10px] bg-text-primary px-5 text-sm font-semibold text-bg transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg dark:bg-white dark:text-neutral-950">
              {copy.hero.setupLabel} <span className="ml-2" aria-hidden="true">↓</span>
            </Link>
            <Link href={copy.hero.backHref} className="inline-flex min-h-10 items-center border-b border-hairline text-sm font-semibold text-text-primary hover:border-text-primary dark:border-white/30 dark:text-white dark:hover:border-white">
              {copy.hero.backLabel}
            </Link>
          </div>
        </div>
        {hostProof ? (
          <McpHostProofCard proof={hostProof} priority />
        ) : (
          <IntegrationConversationPreview client={copy.client} locale={locale} />
        )}
      </div>
    </header>
  );
}
