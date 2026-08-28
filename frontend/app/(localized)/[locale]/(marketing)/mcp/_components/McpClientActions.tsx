import Image from 'next/image';
import Link from 'next/link';
import type { MouseEventHandler } from 'react';
import type { McpClientActionCopy, McpClientId } from '../_lib/mcp-page-types';

const CLIENT_MARKS: Record<
  McpClientId,
  { light: string; dark: string; alt: string }
> = {
  claude: {
    light: '/brand/partners/anthropic/claude-mark-light.svg',
    dark: '/brand/partners/anthropic/claude-mark-dark.svg',
    alt: 'Claude',
  },
  chatgpt: {
    light: '/brand/partners/openai/openai-mark-light.svg',
    dark: '/brand/partners/openai/openai-mark-dark.svg',
    alt: 'ChatGPT',
  },
  codex: {
    light: '/brand/partners/openai/openai-mark-light.svg',
    dark: '/brand/partners/openai/openai-mark-dark.svg',
    alt: 'Codex',
  },
};

function McpClientAction({
  action,
  onActionClick,
}: {
  action: McpClientActionCopy;
  onActionClick?: (action: McpClientActionCopy) => MouseEventHandler<HTMLAnchorElement>;
}) {
  const mark = CLIENT_MARKS[action.client];
  return (
    <Link
      href={action.href}
      className="group flex min-h-[76px] flex-1 items-center gap-3 rounded-[12px] border border-hairline bg-surface p-3 text-left text-text-primary shadow-card transition hover:border-border-hover hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg dark:border-white/[0.16] dark:bg-white/[0.045] dark:text-white dark:hover:border-white/[0.28] dark:hover:bg-white/[0.075]"
      data-client={action.client}
      data-visual-tone="neutral"
      onClick={onActionClick?.(action)}
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] border border-hairline bg-white dark:border-white/[0.14] dark:bg-neutral-900">
        <Image className="h-6 w-6 object-contain dark:hidden" src={mark.light} alt="" width={24} height={24} />
        <Image className="hidden h-6 w-6 object-contain dark:block" src={mark.dark} alt="" width={24} height={24} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-text-primary dark:text-white">{action.label}</span>
        <span className="mt-1 block text-xs text-text-secondary dark:text-white/65">
          {action.supportingLabel}
        </span>
      </span>
      <span className="ml-auto text-text-muted transition group-hover:translate-x-0.5 group-hover:text-text-primary dark:text-white/50 dark:group-hover:text-white" aria-hidden="true">
        →
      </span>
      <span className="sr-only">{mark.alt}</span>
    </Link>
  );
}

export function McpClientActions({
  actions,
  onActionClick,
}: {
  actions: McpClientActionCopy[];
  onActionClick?: (action: McpClientActionCopy) => MouseEventHandler<HTMLAnchorElement>;
}) {
  const clients = actions;
  return (
    <div className="grid gap-3 border-hairline bg-bg text-text-primary dark:border-white/[0.08] dark:bg-bg sm:grid-cols-3">
      {clients.map((action) => (
        <McpClientAction key={action.client} action={action} onActionClick={onActionClick} />
      ))}
    </div>
  );
}
