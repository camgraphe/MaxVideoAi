export type StudioChatProvider = 'gemini' | 'openai';

export type StudioChatModel = {
  provider: StudioChatProvider;
  modelId: string;
  label: string;
  tier: 'balanced' | 'fast' | 'powerful' | 'preview';
  defaultFor?: 'assistant' | 'chatbot';
  supportsImages: boolean;
  supportsAudio: boolean;
  supportsVideo: boolean;
  notes: string;
};

export type StudioChatMessageLike = {
  role: 'assistant' | 'system' | 'user';
  content: string;
};

export const STUDIO_CHAT_MODELS: StudioChatModel[] = [
  {
    provider: 'openai',
    modelId: 'gpt-4.1-mini',
    label: 'GPT-4.1 mini',
    tier: 'fast',
    defaultFor: 'assistant',
    supportsImages: false,
    supportsAudio: false,
    supportsVideo: false,
    notes: 'Fast OpenAI model for lightweight prompt work.',
  },
  {
    provider: 'openai',
    modelId: 'gpt-4.1',
    label: 'GPT-4.1',
    tier: 'powerful',
    supportsImages: false,
    supportsAudio: false,
    supportsVideo: false,
    notes: 'Stronger OpenAI model for planning and longer reasoning.',
  },
  {
    provider: 'gemini',
    modelId: 'gemini-3.5-flash',
    label: 'Gemini 3.5 Flash',
    tier: 'balanced',
    defaultFor: 'chatbot',
    supportsImages: false,
    supportsAudio: false,
    supportsVideo: false,
    notes: 'Default Gemini chat model for responsive Studio assistance.',
  },
  {
    provider: 'gemini',
    modelId: 'gemini-3.1-pro-preview',
    label: 'Gemini 3.1 Pro Preview',
    tier: 'preview',
    supportsImages: false,
    supportsAudio: false,
    supportsVideo: false,
    notes: 'Preview Gemini model for advanced reasoning.',
  },
  {
    provider: 'gemini',
    modelId: 'gemini-3.1-flash-lite',
    label: 'Gemini 3.1 Flash-Lite',
    tier: 'fast',
    supportsImages: false,
    supportsAudio: false,
    supportsVideo: false,
    notes: 'Fast, low-cost Gemini option.',
  },
  {
    provider: 'gemini',
    modelId: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    tier: 'powerful',
    supportsImages: false,
    supportsAudio: false,
    supportsVideo: false,
    notes: 'Stable Gemini deep reasoning fallback.',
  },
  {
    provider: 'gemini',
    modelId: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    tier: 'balanced',
    supportsImages: false,
    supportsAudio: false,
    supportsVideo: false,
    notes: 'Stable Gemini balanced fallback.',
  },
];

export function getStudioChatModels(provider?: StudioChatProvider): StudioChatModel[] {
  return provider ? STUDIO_CHAT_MODELS.filter((model) => model.provider === provider) : [...STUDIO_CHAT_MODELS];
}

export function getDefaultStudioChatModel(provider: StudioChatProvider): StudioChatModel {
  return (
    STUDIO_CHAT_MODELS.find((model) => model.provider === provider && model.defaultFor) ??
    STUDIO_CHAT_MODELS.find((model) => model.provider === provider) ??
    STUDIO_CHAT_MODELS[0]
  );
}

export function isStudioChatModelAllowed(provider: StudioChatProvider, modelId: string): boolean {
  return STUDIO_CHAT_MODELS.some((model) => model.provider === provider && model.modelId === modelId);
}

export function resolveStudioChatModel(provider: StudioChatProvider, modelId?: string | null): StudioChatModel {
  const requested = modelId && STUDIO_CHAT_MODELS.find((model) => model.provider === provider && model.modelId === modelId);
  return requested || getDefaultStudioChatModel(provider);
}

export function compactStudioChatMessages<TMessage extends StudioChatMessageLike>(
  messages: TMessage[],
  options: {
    keepLast?: number;
    maxChars?: number;
  } = {}
): TMessage[] {
  const keepLast = Math.max(1, options.keepLast ?? 12);
  const maxChars = Math.max(400, options.maxChars ?? 12000);
  const system = messages.find((message) => message.role === 'system' && message.content.trim());
  const recent = messages.filter((message) => message.role !== 'system' && message.content.trim()).slice(-keepLast);
  const selected: TMessage[] = [];
  let totalChars = system?.content.length ?? 0;

  for (let index = recent.length - 1; index >= 0; index -= 1) {
    const message = recent[index];
    const nextTotal = totalChars + message.content.length;
    if (selected.length > 0 && nextTotal > maxChars) break;
    selected.unshift(message);
    totalChars = nextTotal;
  }

  return system ? [system, ...selected] : selected;
}
