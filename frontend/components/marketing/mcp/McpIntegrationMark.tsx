import Image from 'next/image';
import type { McpIntegrationId } from '@/lib/mcp-integration-registry';

type IntegrationBrand =
  | { kind: 'paired'; light: string; dark: string }
  | { kind: 'themed'; src: string }
  | { kind: 'color'; src: string };

const INTEGRATION_BRANDS: Record<McpIntegrationId, IntegrationBrand> = {
  claude: {
    kind: 'paired',
    light: '/brand/partners/anthropic/claude-mark-light.svg',
    dark: '/brand/partners/anthropic/claude-mark-dark.svg',
  },
  chatgpt: {
    kind: 'paired',
    light: '/brand/partners/openai/openai-mark-light.svg',
    dark: '/brand/partners/openai/openai-mark-dark.svg',
  },
  codex: {
    kind: 'paired',
    light: '/brand/partners/openai/openai-mark-light.svg',
    dark: '/brand/partners/openai/openai-mark-dark.svg',
  },
  openclaw: { kind: 'color', src: '/brand/partners/mcp/openclaw-mark.svg' },
  n8n: { kind: 'color', src: '/brand/partners/mcp/n8n-mark.svg' },
  cursor: { kind: 'themed', src: '/brand/partners/mcp/cursor-mark.svg' },
  githubCopilot: { kind: 'themed', src: '/brand/partners/mcp/github-copilot-mark.svg' },
  geminiCli: { kind: 'themed', src: '/brand/partners/mcp/gemini-mark.svg' },
  microsoftCopilot: { kind: 'color', src: '/brand/partners/mcp/microsoft-mark.svg' },
};

export function McpIntegrationMark({
  integration,
  size = 24,
  className = 'h-6 w-6',
}: {
  integration: McpIntegrationId;
  size?: number;
  className?: string;
}) {
  const brand = INTEGRATION_BRANDS[integration];
  return (
    <span
      aria-hidden="true"
      data-mcp-mark-kind="logo"
      data-mcp-integration-mark={integration}
      className="inline-flex shrink-0 items-center justify-center"
    >
      {brand.kind === 'paired' ? (
        <>
          <Image src={brand.light} alt="" width={size} height={size} className={`${className} object-contain dark:hidden`} />
          <Image src={brand.dark} alt="" width={size} height={size} className={`hidden ${className} object-contain dark:block`} />
        </>
      ) : (
        <Image
          src={brand.src}
          alt=""
          width={size}
          height={size}
          className={`${className} object-contain ${brand.kind === 'themed' ? 'dark:invert' : ''}`}
        />
      )}
    </span>
  );
}
