import OpenAI from 'openai';
import { compactStudioChatMessages, resolveStudioChatModel } from '@/lib/studio-chat-models';

export type StudioChatProvider = 'openai' | 'gemini';

export type StudioChatMessageInput = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type StudioChatRequest = {
  provider: StudioChatProvider;
  modelId: string;
  messages: StudioChatMessageInput[];
};

type StudioChatResult = {
  content: string;
  modelId: string;
  provider: StudioChatProvider;
};

export async function runStudioChat(request: StudioChatRequest): Promise<StudioChatResult> {
  if (request.provider === 'gemini') {
    return runGeminiStudioChat(request);
  }
  return runOpenAIStudioChat(request);
}

async function runOpenAIStudioChat(request: StudioChatRequest): Promise<StudioChatResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured.');
  const modelId = resolveStudioChatModel('openai', request.modelId).modelId;
  const messages = compactStudioChatMessages(request.messages);
  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model: modelId,
    messages: messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  });
  const content = response.choices[0]?.message?.content?.trim();
  if (!content) throw new Error('OpenAI returned an empty response.');
  return { content, modelId, provider: 'openai' };
}

async function runGeminiStudioChat(request: StudioChatRequest): Promise<StudioChatResult> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured.');
  const modelId = resolveStudioChatModel('gemini', request.modelId).modelId;
  const messages = compactStudioChatMessages(request.messages);
  const system = messages.find((message) => message.role === 'system')?.content.trim() ?? '';
  const userMessages = messages.filter((message) => message.role !== 'system' && message.content.trim());
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      system_instruction: system ? { parts: [{ text: system }] } : undefined,
      contents: userMessages.map((message) => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }],
      })),
    }),
  });
  const data = await response.json().catch(() => null);
  const content = data?.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text ?? '')
    .join('')
    .trim();
  if (!response.ok || !content) throw new Error(data?.error?.message ?? 'Gemini returned an empty response.');
  return { content, modelId, provider: 'gemini' };
}
