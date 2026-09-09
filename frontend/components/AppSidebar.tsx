'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  AudioWaveform,
  ArrowRight,
  Clapperboard,
  Home,
  Images,
  Info,
  LibraryBig,
  ListChecks,
  LucideIcon,
  SlidersHorizontal,
  Wrench,
  WalletCards,
} from 'lucide-react';

export { NAV_ITEMS } from '@/components/app/app-navigation';
import { AppNavigation } from '@/components/app/AppNavigation.client';
import { canShowStudioNavigation } from '@/components/app/app-navigation';

export const NAV_ICON_MAP: Record<string, LucideIcon> = {
  dashboard: Home,
  generate: Clapperboard,
  'generate-image': Images,
  'generate-audio': AudioWaveform,
  tools: Wrench,
  library: LibraryBig,
  jobs: ListChecks,
  billing: WalletCards,
  settings: SlidersHorizontal,
};

const ASSISTANT_CONNECTIONS = [
  {
    id: 'claude',
    href: '/integrations/claude',
    lightMark: '/brand/partners/anthropic/claude-mark-light.svg',
    darkMark: '/brand/partners/anthropic/claude-mark-dark.svg',
    fallbackLabel: 'Claude',
  },
  {
    id: 'chatgpt',
    href: '/integrations/chatgpt',
    lightMark: '/brand/partners/openai/openai-mark-light.svg',
    darkMark: '/brand/partners/openai/openai-mark-dark.svg',
    fallbackLabel: 'ChatGPT',
  },
  {
    id: 'codex',
    href: '/integrations/codex',
    lightMark: '/brand/partners/openai/openai-mark-light.svg',
    darkMark: '/brand/partners/openai/openai-mark-dark.svg',
    fallbackLabel: 'Codex',
  },
] as const;

type SidebarTranslate = (path: string, fallback: string) => string | undefined;

export function AssistantConnectionsCard({ t }: { t: SidebarTranslate }) {
  const tooltip = t(
    'workspace.sidebar.assistantConnections.tooltip',
    'Connect your account to use MaxVideoAI directly from your AI assistant.',
  );

  return (
    <div className="app-assistant-connections rounded-card border border-hairline bg-surface shadow-sm">
      <div className="flex items-center justify-between gap-2 px-3.5 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-primary">
          {t('workspace.sidebar.assistantConnections.label', 'Connect')}
        </p>
        <span className="group/assistant-tip relative inline-flex">
          <button
            type="button"
            className="flex h-5 w-5 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-2 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={tooltip}
            aria-describedby="assistant-connections-tooltip"
          >
            <Info className="h-3.5 w-3.5" aria-hidden />
          </button>
          <span
            id="assistant-connections-tooltip"
            role="tooltip"
            className="pointer-events-none absolute bottom-0 left-full z-50 ml-2 hidden w-56 rounded-input border border-border bg-surface px-3 py-2 text-left text-[11px] font-normal leading-4 normal-case tracking-normal text-text-secondary shadow-lg group-hover/assistant-tip:block group-focus-within/assistant-tip:block dark:border-white/12 dark:bg-[#111827] dark:text-white/78"
          >
            {tooltip}
          </span>
        </span>
      </div>

      <div className="overflow-hidden rounded-b-card border-t border-hairline divide-y divide-hairline">
        {ASSISTANT_CONNECTIONS.map((connection) => (
          <Link
            key={connection.id}
            href={connection.href}
            prefetch={false}
            className="group flex min-h-10 items-center gap-2.5 px-3.5 text-xs font-semibold text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden>
              <Image
                src={connection.lightMark}
                alt=""
                width={18}
                height={18}
                className="h-[18px] w-[18px] object-contain dark:hidden"
              />
              <Image
                src={connection.darkMark}
                alt=""
                width={18}
                height={18}
                className="hidden h-[18px] w-[18px] object-contain dark:block"
              />
            </span>
            <span className="min-w-0 flex-1 whitespace-nowrap text-[13px]">
              {t(`workspace.sidebar.assistantConnections.${connection.id}`, connection.fallbackLabel)}
            </span>
            <ArrowRight
              className="h-3.5 w-3.5 shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-brand"
              aria-hidden
            />
          </Link>
        ))}
      </div>
    </div>
  );
}

export function AppSidebar() {
  return <aside className="app-sidebar sticky top-[var(--header-height)] hidden h-[calc(100dvh-var(--header-height))] shrink-0 md:flex"><AppNavigation variant="rail" studioVisible={canShowStudioNavigation()} /></aside>;
}
