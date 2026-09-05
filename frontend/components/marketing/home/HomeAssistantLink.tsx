import Image from 'next/image';
import Link from 'next/link';

const ASSISTANTS = [
  { name: 'Claude', light: '/brand/partners/anthropic/claude-mark-light.svg', dark: '/brand/partners/anthropic/claude-mark-dark.svg' },
  { name: 'ChatGPT', light: '/brand/partners/openai/openai-mark-light.svg', dark: '/brand/partners/openai/openai-mark-dark.svg' },
  { name: 'Codex', light: '/brand/partners/openai/openai-mark-light.svg', dark: '/brand/partners/openai/openai-mark-dark.svg' },
] as const;

export function HomeAssistantLink({ link }: { link: { href: string; label: string } | null }) {
  if (!link) return null;

  return (
    <Link
      href={link.href}
      prefetch={false}
      className="group mt-4 flex max-w-md flex-col gap-2 rounded-xl border border-hairline bg-surface px-3 py-3 text-text-primary transition hover:border-border-hover hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      data-analytics-event="mcp_internal_link_click"
      data-analytics-cta-name="assistant_video"
      data-analytics-cta-location="home_hero"
      data-analytics-target-family="mcp"
    >
      <span className="flex items-center justify-between gap-2 text-sm font-semibold leading-5">
        {link.label}
        <span aria-hidden="true" className="shrink-0 transition group-hover:translate-x-0.5">→</span>
      </span>
      <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {ASSISTANTS.map((assistant) => (
          <span key={assistant.name} className="inline-flex items-center gap-1.5 text-xs font-medium">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-hairline bg-white dark:bg-neutral-900">
              <Image src={assistant.light} alt="" aria-hidden="true" width={16} height={16} className="h-4 w-4 object-contain dark:hidden" />
              <Image src={assistant.dark} alt="" aria-hidden="true" width={16} height={16} className="hidden h-4 w-4 object-contain dark:block" />
            </span>
            {assistant.name}
          </span>
        ))}
      </span>
    </Link>
  );
}
