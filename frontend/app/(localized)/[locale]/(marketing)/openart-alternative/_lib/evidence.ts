export const OPENART_PATH = '/openart-alternative';
export const OPENART_CHECKED = '2026-11-10';

// Published artwork from the Studio storyboard starter, shown as a still.
export const OPENART_HERO = {
  src: '/assets/studio/starters/storyboard-to-video.webp',
  width: 960,
  height: 541,
} as const;

export const openArtSources = [
  { id: 'openart-pricing', publisher: 'OpenArt', url: 'https://openart.ai/pricing' },
  { id: 'openart-trial', publisher: 'OpenArt', url: 'https://openart.ai/faq/' },
  { id: 'openart-credits', publisher: 'OpenArt', url: 'https://openart.ai/help/#credit-usage' },
  { id: 'openart-chat', publisher: 'OpenArt', url: 'https://openart.ai/features/chat-mode/' },
  { id: 'openart-director', publisher: 'OpenArt', url: 'https://openart.ai/features/director/' },
  { id: 'openart-mcp', publisher: 'OpenArt', url: 'https://openart.ai/mcp/' },
  { id: 'openart-claude', publisher: 'OpenArt', url: 'https://openart.ai/mcp/claude-ai-video-generator/' },
  { id: 'openart-chatgpt', publisher: 'OpenArt', url: 'https://openart.ai/mcp/chatgpt-ai-video-generator/' },
  { id: 'max-pricing', publisher: 'MaxVideoAI', url: 'https://maxvideoai.com/pricing' },
  { id: 'max-wallet', publisher: 'MaxVideoAI', url: 'https://maxvideoai.com/pay-as-you-go-ai-video-generator' },
  { id: 'max-studio', publisher: 'MaxVideoAI', url: 'https://maxvideoai.com/studio' },
  { id: 'max-mcp', publisher: 'MaxVideoAI', url: 'https://maxvideoai.com/mcp' },
] as const;

export type OpenArtSourceId = (typeof openArtSources)[number]['id'];

export const openArtCriteria = {
  entry: { max: ['max-pricing'], openart: ['openart-trial', 'openart-pricing'] },
  funding: { max: ['max-pricing'], openart: ['openart-pricing', 'openart-credits'] },
  balance: { max: ['max-wallet'], openart: ['openart-credits', 'openart-trial'] },
  chat: { max: ['max-studio', 'max-pricing'], openart: ['openart-chat'] },
  mcp: { max: ['max-mcp'], openart: ['openart-mcp', 'openart-claude', 'openart-chatgpt'] },
  delivery: { max: ['max-studio'], openart: ['openart-director'] },
} as const satisfies Record<string, { max: readonly OpenArtSourceId[]; openart: readonly OpenArtSourceId[] }>;

export type OpenArtCriterion = keyof typeof openArtCriteria;
