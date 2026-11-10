export const COMPARISON_PATH = '/higgsfield-alternative';
export const COMPARISON_CHECKED = '2026-11-10';
export const COMPARISON_PUBLISHER = 'MaxVideoAI';
export const comparisonSources = [
  { id: 'max-pricing', publisher: 'MaxVideoAI', label: 'Pricing, top-ups and refunds', url: 'https://maxvideoai.com/pricing' },
  { id: 'max-terms', publisher: 'MaxVideoAI', label: 'Wallet terms', url: 'https://maxvideoai.com/legal/terms' },
  { id: 'max-prompts', publisher: 'MaxVideoAI', label: 'Milo Lite prompt assistance', url: 'https://maxvideoai.com/ai-video-prompt-generator' },
  { id: 'higgs-packs', publisher: 'Higgsfield', label: 'How Credit Packs work', url: 'https://higgsfield.ai/creator-hub/help-center/credits/how-credit-packs-work' },
  { id: 'higgs-credits', publisher: 'Higgsfield', label: 'How credits work', url: 'https://higgsfield.ai/creator-hub/help-center/credits/how-credits-work' },
  { id: 'higgs-supercomputer', publisher: 'Higgsfield', label: 'Supercomputer modes and credits', url: 'https://higgsfield.ai/blog/how-we-built-supercomputer' },
  { id: 'max-mcp', publisher: 'MaxVideoAI', label: 'MCP and supported hosts', url: 'https://maxvideoai.com/mcp' },
  { id: 'max-mcp-docs', publisher: 'MaxVideoAI', label: 'MCP planning, quotes and approval', url: 'https://maxvideoai.com/docs/mcp' },
  { id: 'higgs-connect', publisher: 'Higgsfield', label: 'Connect Higgsfield to an AI agent', url: 'https://higgsfield.ai/creator-hub/help-center/integrations/how-do-i-connect-higgsfield-to-ai-agent' },
  { id: 'higgs-mcp', publisher: 'Higgsfield', label: 'Standard MCP credit usage', url: 'https://higgsfield.ai/creator-hub/help-center/integrations/what-is-higgsfield-mcp' },
  { id: 'higgs-trial', publisher: 'Higgsfield', label: 'Claude MCP offer on homepage — observed 10 Nov 2026', url: 'https://higgsfield.ai/' },
  { id: 'higgs-cinema', publisher: 'Higgsfield', label: 'Cinema Studio 4.0 controls', url: 'https://higgsfield.ai/blog/cinema-studio-4-0-complete-guide' },
  { id: 'higgs-api', publisher: 'Higgsfield', label: 'Separate developer API billing', url: 'https://higgsfield.ai/creator-hub/help-center/integrations/what-is-the-higgsfield-api' },
  { id: 'higgs-supercomputer-guide', publisher: 'Higgsfield', label: 'Supercomputer Free, Smart and Manual credit rules', url: 'https://geo.higgsfield.ai/blog/recommended/which-ai-tool-best-automates-daily-content-across-channels-8660c3' },
  { id: 'higgs-render-billing', publisher: 'Higgsfield', label: 'Completed renders, failures and credits', url: 'https://higgsfield.ai/blog/higgsfield-pricing-explained#how-are-credits-spent-on-higgsfield' },
  { id: 'max-character-studio', publisher: 'MaxVideoAI', label: 'Character Studio, saved looks and Recast', url: 'https://maxvideoai.com/tools/character-builder' },
  { id: 'higgs-ai-influencer', publisher: 'Higgsfield', label: 'AI Influencer creation, library and Motion', url: 'https://higgsfield.ai/ai-influencer' },
  { id: 'higgs-soul-id', publisher: 'Higgsfield', label: 'Soul ID training requirements', url: 'https://higgsfield.ai/creator-hub/help-center/ai-models/how-do-i-create-and-use-a-soul-id-character' },
] as const;
export function sourceNumber(id: string) { return comparisonSources.findIndex((source) => source.id === id) + 1; }
