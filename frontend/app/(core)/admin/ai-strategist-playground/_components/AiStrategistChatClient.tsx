'use client';

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import {
  Check,
  ChevronRight,
  Copy,
  Minimize2,
  Paperclip,
  RotateCcw,
  Send,
  Sparkles,
  X,
} from 'lucide-react';

import { authFetch } from '@/lib/authFetch';
import type {
  AiStrategistPlaygroundInput,
  AiStrategistPlaygroundMode,
  AiStrategistPlaygroundResult,
} from '@/lib/ai-strategist/playground-pipeline';
import type {
  AiStrategistAlsoConsider,
  AiStrategistModelId,
  AiStrategistRecommendation,
  AiStrategistTierPosition,
} from '@/lib/ai-strategist/types';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  result?: AiStrategistPlaygroundResult;
};

type LastRequestContext = {
  userMessage: string;
};

const introMessage =
  'Tell me what you want to create, paste a prompt to improve, or ask about models, pricing, and workflows. I’ll guide the next step.';

export function AiStrategistChatClient() {
  const messageId = useRef(0);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'intro',
      role: 'assistant',
      text: introMessage,
    },
  ]);
  const [isWidgetOpen, setIsWidgetOpen] = useState(true);
  const [input, setInput] = useState('Luxury perfume ad on black marble, 9:16, premium look');
  const [lastContext, setLastContext] = useState<LastRequestContext | null>(null);
  const [lastResult, setLastResult] = useState<AiStrategistPlaygroundResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, isSubmitting]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text || isSubmitting) return;

    const tierCommand = resolveTierCommand(text);
    if (tierCommand && lastContext) {
      await submitTierPrompt(tierCommand, `Use ${tierCommand} and build the prompt.`);
      setInput('');
      return;
    }

    const requestedMode: AiStrategistPlaygroundMode = 'recommend';
    const context = buildContext(text);
    await runChatRequest(
      {
        userMessage: text,
        mode: requestedMode,
        surface: 'chat',
      },
      text,
      context
    );
    setInput('');
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  async function submitTierPrompt(tier: AiStrategistTierPosition, visibleText?: string) {
    if (!lastContext || isSubmitting) return;
    await runChatRequest(
      {
        userMessage: lastContext.userMessage,
        mode: 'build_prompt',
        surface: 'chat',
        selectedTier: tier,
      },
      visibleText ?? `Build the ${tier} prompt.`,
      lastContext
    );
  }

  async function submitRecommendationChoice(tier: AiStrategistTierPosition, recommendation: AiStrategistRecommendation) {
    if (!lastContext || isSubmitting) return;
    await runChatRequest(
      {
        userMessage: `Choose ${tier}`,
        mode: 'recommend',
        surface: 'chat',
        selectedTier: tier,
        selectedModel: recommendation.model.id,
      },
      `Choose ${tier}: ${recommendation.model.label}`,
      lastContext
    );
  }

  async function submitAlternativeChoice(alternative: AiStrategistAlsoConsider) {
    if (!lastContext || isSubmitting) return;
    await runChatRequest(
      {
        userMessage: `Choose ${alternative.model.label}`,
        mode: 'recommend',
        surface: 'chat',
        selectedModel: alternative.model.id,
      },
      `Choose ${alternative.model.label}`,
      lastContext
    );
  }

  async function submitGeneratePrompt() {
    if (!lastContext || isSubmitting) return;
    await runChatRequest(
      {
        userMessage: 'Generate prompt',
        mode: 'recommend',
        surface: 'chat',
      },
      'Generate prompt',
      lastContext
    );
  }

  async function submitMakeAssumptions() {
    if (!lastContext || isSubmitting) return;
    await runChatRequest(
      {
        userMessage: 'Make smart assumptions and continue',
        mode: 'recommend',
        surface: 'chat',
      },
      'Make smart assumptions and continue',
      lastContext
    );
  }

  async function submitQuickReply(reply: string) {
    if (!lastContext || isSubmitting) {
      setInput(reply);
      return;
    }

    await runChatRequest(
      {
        userMessage: reply,
        mode: 'recommend',
        surface: 'chat',
      },
      reply,
      lastContext
    );
  }

  function resetChat() {
    messageId.current = 0;
    setMessages([
      {
        id: 'intro',
        role: 'assistant',
        text: introMessage,
      },
    ]);
    setLastContext(null);
    setLastResult(null);
    setError(null);
    setInput('');
  }

  async function runChatRequest(
    payload: AiStrategistPlaygroundInput,
    visibleUserText: string,
    context: LastRequestContext
  ) {
    setIsSubmitting(true);
    setError(null);
    setMessages((current) => [...current, createMessage('user', visibleUserText)]);

    try {
      const response = await authFetch('/api/admin/ai-strategist-playground', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          conversationState: buildConversationState(),
        }),
      });
      const json = (await response.json().catch(() => null)) as AiStrategistPlaygroundResult | { ok?: false; error?: string } | null;
      if (!response.ok || !json?.ok) {
        throw new Error(json && 'error' in json && json.error ? json.error : 'AI Strategist chat request failed');
      }

      setLastContext(resolveNextContext(json, context));
      setLastResult(json);
      setMessages((current) => [
        ...current,
        {
          ...createMessage('assistant', buildAssistantReply(json)),
          result: json,
        },
      ]);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'AI Strategist chat request failed';
      setError(message);
      setMessages((current) => [...current, createMessage('assistant', `I could not run the strategist preview: ${message}`)]);
    } finally {
      setIsSubmitting(false);
    }
  }

  function buildContext(userMessage: string): LastRequestContext {
    return {
      userMessage,
    };
  }

  function buildConversationState(): AiStrategistPlaygroundInput['conversationState'] {
    return {
      recentTurns: messages
        .slice(-8)
        .map((message) => ({ role: message.role, content: message.text })),
      ...(lastResult?.normalizedBrief ? { lastNormalizedBrief: lastResult.normalizedBrief } : {}),
      ...(lastResult?.recommendations ? { lastRecommendations: lastResult.recommendations } : {}),
      ...(lastResult?.selectedModel ? { lastSelectedModel: lastResult.selectedModel as AiStrategistModelId } : {}),
      ...(lastResult?.selectedTier ? { lastSelectedTier: lastResult.selectedTier } : {}),
      ...(lastResult?.workflow ? { lastSelectedWorkflow: lastResult.workflow } : {}),
      ...(lastResult?.sanitizedFinalOutput?.finalPrompt ? { lastFinalPrompt: lastResult.sanitizedFinalOutput.finalPrompt } : {}),
      ...(lastResult?.conversationStage ? { stage: lastResult.conversationStage } : {}),
      ...(lastResult?.briefCompletion ? { lastBriefCompletion: lastResult.briefCompletion } : {}),
    };
  }

  function resolveNextContext(result: AiStrategistPlaygroundResult, submittedContext: LastRequestContext): LastRequestContext {
    if (result.conversationPlan.shouldUsePreviousBrief && lastContext) {
      return {
        ...lastContext,
        userMessage: result.briefCompletion?.resolvedBrief ?? lastContext.userMessage,
      };
    }

    return {
      ...submittedContext,
      userMessage: result.briefCompletion?.resolvedBrief ?? result.normalizedBrief.normalizedBrief ?? submittedContext.userMessage,
    };
  }

  function createMessage(role: ChatMessage['role'], text: string): ChatMessage {
    messageId.current += 1;
    return { id: `${role}-${messageId.current}`, role, text };
  }

  return (
    <section
      data-testid="ai-strategist-overlay-preview"
      className="relative min-h-[760px] overflow-hidden rounded-[30px] border border-[#e6ebf5] bg-[radial-gradient(circle_at_82%_18%,rgba(124,58,237,0.16),transparent_31%),linear-gradient(135deg,#fbfdff_0%,#eef4fc_56%,#fbfcff_100%)] shadow-[0_28px_90px_rgba(15,23,42,0.10)]"
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.035)_1px,transparent_1px)] bg-[size:42px_42px]" />

      <div className="relative flex min-h-[760px]">
        <aside className="hidden w-[218px] shrink-0 border-r border-[#e7ecf5] bg-white/62 px-6 py-8 backdrop-blur-sm lg:block">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-950 text-white">
              <Sparkles className="h-4 w-4" />
            </span>
            MaxVideoAI
          </div>
          <div className="mt-12 space-y-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Operations</p>
            {['Users', 'Jobs', 'Transactions', 'Engines', 'Pricing rules'].map((item) => (
              <div key={item} className="flex items-center gap-3 text-sm font-semibold text-slate-600">
                <span className="h-2 w-2 rounded-full border border-slate-300" />
                {item}
              </div>
            ))}
          </div>
        </aside>

        <main className="relative min-w-0 flex-1 px-6 py-7 lg:px-12 lg:py-9">
          <div className="mb-9 flex items-center justify-between">
            <div className="hidden items-center gap-8 text-sm font-semibold text-slate-600 md:flex">
              {['Models', 'Examples', 'Compare', 'Tools', 'Pricing', 'Blog'].map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <span className="ml-auto rounded-full border border-slate-200 bg-white/70 px-5 py-2 text-sm font-semibold text-slate-900">
              Generate
            </span>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-[#7c3aed]/15 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6d28d9] shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
            <Sparkles className="h-3.5 w-3.5" />
            AI strategist preview
          </div>
          <h2 className="mt-8 max-w-[500px] text-4xl font-semibold leading-[1.08] tracking-[-0.02em] text-slate-950 lg:text-5xl">
            Stop guessing which AI video model to use.
          </h2>
          <p className="mt-5 max-w-[430px] text-base leading-8 text-slate-600">
            Internal overlay preview for recommendations, model choice, brief completion, and prompt preview.
          </p>
          <div className="mt-8 flex max-w-[320px] flex-col gap-3">
            {['Multi-engine routing', 'Price before generation', 'No credits spent'].map((item) => (
              <span key={item} className="inline-flex w-fit rounded-full border border-[#e5eaf4] bg-white/78 px-4 py-2 text-sm font-semibold text-slate-600">
                {item}
              </span>
            ))}
          </div>
          <div className="mt-11 grid max-w-[380px] grid-cols-2 gap-3">
            {['Compare engines', 'Prompt advisor'].map((item) => (
              <div key={item} className="rounded-2xl border border-[#e5eaf4] bg-white/62 px-4 py-4 shadow-[0_12px_36px_rgba(15,23,42,0.04)]">
                <p className="text-sm font-semibold text-slate-900">{item}</p>
                <p className="mt-2 text-xs leading-5 text-slate-500">Preview surface.</p>
              </div>
            ))}
          </div>
        </main>
      </div>

      {isWidgetOpen ? (
        <div
          data-testid="ai-strategist-chat-widget"
          className="absolute bottom-20 right-3 z-20 flex h-[590px] max-h-[calc(100%-5rem)] w-[calc(100%-1.5rem)] max-w-[600px] flex-col overflow-hidden rounded-[24px] border border-[#e6ebf4] bg-white shadow-[0_28px_90px_rgba(15,23,42,0.18)] sm:right-8 lg:bottom-[15.5rem]"
        >
          <header className="flex min-h-[58px] items-center justify-between border-b border-[#edf1f7] px-5">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#7c3aed]/10 text-[#7c3aed]">
                <Sparkles className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-950">AI Video Strategist</p>
                <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Online
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <IconButton label="Reset chat" onClick={resetChat}>
                <RotateCcw className="h-3.5 w-3.5" />
              </IconButton>
              <IconButton label="Minimize AI Strategist" onClick={() => setIsWidgetOpen(false)}>
                <Minimize2 className="h-3.5 w-3.5" />
              </IconButton>
              <IconButton label="Close AI Strategist" onClick={() => setIsWidgetOpen(false)}>
                <X className="h-4 w-4" />
              </IconButton>
            </div>
          </header>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {messages.map((message) => (
                <ChatBubble
                  key={message.id}
                  message={message}
                  isSubmitting={isSubmitting}
                  onChooseRecommendation={submitRecommendationChoice}
                  onChooseAlternative={submitAlternativeChoice}
                  onGeneratePrompt={submitGeneratePrompt}
                  onMakeAssumptions={submitMakeAssumptions}
                  onQuickReply={(reply) => void submitQuickReply(reply)}
                  onAdjustBrief={() => setInput('')}
                  onChangeModel={() => setInput('Change model')}
                />
              ))}
              {isSubmitting ? (
                <div className="flex items-center gap-2 px-1 text-xs font-semibold text-slate-500">
                  <Sparkles className="h-3.5 w-3.5 animate-pulse text-brand" />
                  Strategist is thinking...
                </div>
              ) : null}
              <div ref={scrollAnchorRef} />
            </div>

            <form onSubmit={handleSubmit} className="border-t border-[#edf1f7] bg-white px-5 py-4">
              <div className="flex items-end gap-2 rounded-[22px] border border-[#e3e8f3] bg-white px-3 py-2 shadow-[0_12px_34px_rgba(15,23,42,0.08)]">
                <button
                  type="button"
                  aria-label="Attach reference"
                  className="mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.currentTarget.value)}
                  onKeyDown={handleInputKeyDown}
                  rows={1}
                  placeholder="Ask anything..."
                  aria-keyshortcuts="Enter"
                  className="min-h-[44px] flex-1 resize-none border-0 bg-transparent py-3 text-sm font-medium leading-5 text-slate-900 outline-none placeholder:text-slate-400"
                />
                <button
                  type="submit"
                  disabled={isSubmitting || !input.trim()}
                  aria-label="Send message"
                  className="mb-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#7c3aed] text-white shadow-[0_12px_28px_rgba(124,58,237,0.36)] transition hover:bg-[#6d28d9] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              {error ? <p className="mt-2 rounded-xl border border-error/25 bg-error/10 px-3 py-2 text-xs font-semibold text-error">{error}</p> : null}
              <p className="mt-2 text-[10px] font-medium text-slate-400">Dev only — does not run generation or spend credits.</p>
            </form>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        data-testid="ai-strategist-launcher"
        aria-expanded={isWidgetOpen}
        aria-label={isWidgetOpen ? 'Close AI Strategist' : 'Open AI Strategist'}
        onClick={() => setIsWidgetOpen((current) => !current)}
        className="group absolute bottom-4 right-4 z-30 flex items-center gap-2"
      >
        <span className="rounded-full border border-[#7c3aed]/15 bg-white/85 px-2.5 py-1 text-xs font-semibold text-[#7c3aed] opacity-0 shadow-[0_8px_20px_rgba(15,23,42,0.10)] transition group-hover:opacity-100">
          AI Strategist
        </span>
        <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-[#7c3aed] text-white shadow-[0_20px_42px_rgba(124,58,237,0.48)] transition hover:scale-[1.03]">
          <Sparkles className="h-6 w-6" />
          <span className="absolute right-1.5 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" />
        </span>
      </button>
    </section>
  );
}

function ChatBubble({
  message,
  isSubmitting,
  onChooseRecommendation,
  onChooseAlternative,
  onGeneratePrompt,
  onMakeAssumptions,
  onQuickReply,
  onAdjustBrief,
  onChangeModel,
}: {
  message: ChatMessage;
  isSubmitting: boolean;
  onChooseRecommendation: (tier: AiStrategistTierPosition, recommendation: AiStrategistRecommendation) => void;
  onChooseAlternative: (alternative: AiStrategistAlsoConsider) => void;
  onGeneratePrompt: () => void;
  onMakeAssumptions: () => void;
  onQuickReply: (reply: string) => void;
  onAdjustBrief: () => void;
  onChangeModel: () => void;
}) {
  const isUser = message.role === 'user';
  const articleClassName = isUser ? 'ml-auto max-w-[78%]' : message.result ? 'mr-auto w-full max-w-full' : 'mr-auto max-w-[90%]';
  const bubbleClassName = isUser ? userBubbleClassName : `${assistantBubbleClassName} ${message.result ? 'flex-1' : ''}`;
  return (
    <article className={articleClassName}>
      <div className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}>
        {isUser ? null : (
          <span className={assistantAvatarClassName}>
            <Sparkles className="h-3.5 w-3.5" />
          </span>
        )}
        <div className={bubbleClassName}>
          <p className="whitespace-pre-wrap text-[13px] leading-5">{message.text}</p>
          {message.result ? (
            <ChatResult
              result={message.result}
              isSubmitting={isSubmitting}
              onChooseRecommendation={onChooseRecommendation}
              onChooseAlternative={onChooseAlternative}
              onGeneratePrompt={onGeneratePrompt}
              onMakeAssumptions={onMakeAssumptions}
              onQuickReply={onQuickReply}
              onAdjustBrief={onAdjustBrief}
              onChangeModel={onChangeModel}
            />
          ) : null}
        </div>
      </div>
    </article>
  );
}

function ChatResult({
  result,
  isSubmitting,
  onChooseRecommendation,
  onChooseAlternative,
  onGeneratePrompt,
  onMakeAssumptions,
  onQuickReply,
  onAdjustBrief,
  onChangeModel,
}: {
  result: AiStrategistPlaygroundResult;
  isSubmitting: boolean;
  onChooseRecommendation: (tier: AiStrategistTierPosition, recommendation: AiStrategistRecommendation) => void;
  onChooseAlternative: (alternative: AiStrategistAlsoConsider) => void;
  onGeneratePrompt: () => void;
  onMakeAssumptions: () => void;
  onQuickReply: (reply: string) => void;
  onAdjustBrief: () => void;
  onChangeModel: () => void;
}) {
  const showPrompt = result.conversationStage === 'prompt_ready' && (result.mode === 'build_prompt' || result.mode === 'improve_prompt');
  return (
    <div className="mt-2.5 space-y-2.5">
      {result.recommendations && result.conversationStage === 'awaiting_model_choice' ? (
        <>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <RecommendationCard label="Best" tier="best" recommendation={result.recommendations.best} disabled={isSubmitting} onChoose={onChooseRecommendation} />
            <RecommendationCard label="Medium" tier="medium" recommendation={result.recommendations.medium} disabled={isSubmitting} onChoose={onChooseRecommendation} />
            <RecommendationCard label="Value" tier="value" recommendation={result.recommendations.value} disabled={isSubmitting} onChoose={onChooseRecommendation} />
          </div>
          {result.alsoConsider?.length ? (
            <div className="flex flex-wrap gap-2">
              {result.alsoConsider.map((alternative) => (
                <AlternativeModelChip key={alternative.model.id} alternative={alternative} disabled={isSubmitting} onChoose={onChooseAlternative} />
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            <QuickActionButton disabled={isSubmitting} onClick={onMakeAssumptions}>
              <Sparkles className="h-3.5 w-3.5" />
              Make assumptions
            </QuickActionButton>
            <QuickActionButton disabled={isSubmitting} onClick={() => onQuickReply('Improve prompt')}>
              Improve prompt
            </QuickActionButton>
            <QuickActionButton disabled={isSubmitting} onClick={() => onQuickReply('Change format')}>
              Change format
            </QuickActionButton>
          </div>
        </>
      ) : null}

      {showPrompt && result.sanitizedFinalOutput ? <PromptPreview result={result} /> : null}

      {result.conversationStage === 'collecting_missing_fields' ? (
        <div className="flex flex-wrap gap-2">
          {buildMissingInfoChips(result).map((chip) => (
            <QuickActionButton key={chip} disabled={isSubmitting} onClick={() => onQuickReply(chip)}>
              {chip}
            </QuickActionButton>
          ))}
          <QuickActionButton disabled={isSubmitting} onClick={onMakeAssumptions}>
            <Sparkles className="h-3.5 w-3.5" />
            Make assumptions
          </QuickActionButton>
          <QuickActionButton disabled={isSubmitting} onClick={onAdjustBrief}>
            Adjust brief
          </QuickActionButton>
        </div>
      ) : null}

      {result.conversationStage === 'awaiting_confirmation' ? (
        <div className="flex flex-wrap gap-2">
          <QuickActionButton disabled={isSubmitting} onClick={onGeneratePrompt}>
            <Check className="h-3.5 w-3.5" />
            Generate prompt
          </QuickActionButton>
          <QuickActionButton disabled={isSubmitting} onClick={onAdjustBrief}>
            Adjust brief
          </QuickActionButton>
          <QuickActionButton disabled={isSubmitting} onClick={onChangeModel}>
            Change model
          </QuickActionButton>
        </div>
      ) : null}

      {result.knowledgeToolResults?.length ? <SourceChips result={result} /> : null}
    </div>
  );
}

function SourceChips({ result }: { result: AiStrategistPlaygroundResult }) {
  const labels = Array.from(
    new Set(result.knowledgeToolResults?.flatMap((toolResult) => toolResult.sources.map((source) => source.label)) ?? [])
  );
  if (!labels.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[10px] font-semibold text-slate-400">
      <span>Sources:</span>
      {labels.slice(0, 3).map((label) => (
        <span key={label} className="rounded-full border border-slate-100 bg-slate-50 px-2 py-0.5 text-slate-500">
          {label}
        </span>
      ))}
    </div>
  );
}

function RecommendationCard({
  label,
  tier,
  recommendation,
  disabled,
  onChoose,
}: {
  label: string;
  tier: AiStrategistTierPosition;
  recommendation: AiStrategistRecommendation;
  disabled: boolean;
  onChoose: (tier: AiStrategistTierPosition, recommendation: AiStrategistRecommendation) => void;
}) {
  const tag = getModelPositionTag(recommendation);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChoose(tier, recommendation)}
      className={`group min-h-[142px] rounded-2xl border bg-white px-3 py-3 text-left shadow-[0_12px_30px_rgba(15,23,42,0.045)] transition hover:border-[#7c3aed]/40 hover:bg-[#7c3aed]/[0.025] disabled:cursor-not-allowed disabled:opacity-60 ${tier === 'best' ? 'border-orange-200' : 'border-[#e4e9f3]'}`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${getTierBadgeClassName(tier)}`}>
          {tier === 'best' ? <Sparkles className="h-3 w-3" /> : null}
          {label}
        </span>
        <ChevronRight className="h-3.5 w-3.5 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-[#7c3aed]" />
      </span>
      <span className="mt-2 flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-[11px] font-bold text-white">
          {modelIconText(recommendation.model.label)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-semibold text-slate-950">{recommendation.model.label}</span>
          <span className="mt-0.5 inline-flex rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
            {tag}
          </span>
        </span>
      </span>
      <span className="mt-2 block max-h-10 overflow-hidden text-[11px] leading-4 text-slate-500">{shortReason(recommendation.reason)}</span>
    </button>
  );
}

function AlternativeModelChip({
  alternative,
  disabled,
  onChoose,
}: {
  alternative: AiStrategistAlsoConsider;
  disabled: boolean;
  onChoose: (alternative: AiStrategistAlsoConsider) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChoose(alternative)}
      className="group inline-flex min-h-[34px] max-w-full items-center gap-2 rounded-full border border-[#e4e9f3] bg-white px-2.5 text-left text-[11px] font-semibold text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.035)] transition hover:border-[#7c3aed]/30 hover:bg-[#7c3aed]/[0.035] hover:text-[#6d28d9] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-950 text-[9px] font-bold text-white">
        {modelIconText(alternative.model.label)}
      </span>
      <span className="truncate">Also consider {alternative.model.label}</span>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-[#7c3aed]" />
    </button>
  );
}

function PromptPreview({ result }: { result: AiStrategistPlaygroundResult }) {
  const output = result.sanitizedFinalOutput;
  const [copied, setCopied] = useState(false);
  if (!output) return null;

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(output.finalPrompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-2">
      <PreviewSection
        title="Final prompt"
        action={
          <button
            type="button"
            onClick={() => void copyPrompt()}
            className="inline-flex min-h-[26px] items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-600 transition hover:border-brand/30 hover:text-brand"
          >
            <Copy className="h-3 w-3" />
            {copied ? 'Copied' : 'Copy'}
          </button>
        }
      >
        <pre className={preClassName}>{output.finalPrompt}</pre>
      </PreviewSection>
      <CompactDetails title="Negative prompt">
        <pre className={compactPreClassName}>{output.negativePrompt}</pre>
      </CompactDetails>
      <CompactDetails title="Settings">
        <List items={output.settings} empty="No settings returned." compact />
      </CompactDetails>
      <CompactDetails title="Warnings">
        <List items={result.warnings} empty="No warnings." compact />
      </CompactDetails>
    </div>
  );
}

function PreviewSection({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#e7ecf5] bg-[#f8faff] px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{title}</p>
        {action}
      </div>
      <div className="mt-1.5">{children}</div>
    </section>
  );
}

function CompactDetails({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="rounded-2xl border border-slate-100 bg-slate-50/70">
      <summary className="cursor-pointer px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {title}
      </summary>
      <div className="border-t border-slate-100 px-3 py-2">{children}</div>
    </details>
  );
}

function List({ items, empty, compact = false }: { items: string[]; empty: string; compact?: boolean }) {
  if (!items.length) return <p className="text-sm text-text-secondary">{empty}</p>;
  return (
    <ul className={`${compact ? 'space-y-1 text-xs leading-5' : 'space-y-2 text-sm leading-6'} text-text-secondary`}>
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <ChevronRight className="mt-1 h-3.5 w-3.5 shrink-0 text-brand" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function QuickActionButton({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex min-h-[32px] items-center justify-center gap-1.5 rounded-full border border-[#e4e9f3] bg-[#fafbff] px-3 text-[11px] font-semibold text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.04)] transition hover:border-[#7c3aed]/25 hover:bg-[#7c3aed]/[0.04] hover:text-[#6d28d9] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
    >
      {children}
    </button>
  );
}

function buildMissingInfoChips(result: AiStrategistPlaygroundResult): string[] {
  const text = `${result.assistantMessage}\n${result.briefCompletion?.missingFields.join(' ') ?? ''}`.toLowerCase();
  const chips: string[] = [];
  if (text.includes('fighter')) chips.push('One fighter', 'Two fighters');
  if (text.includes('style') || text.includes('stylized') || text.includes('cinematic')) chips.push('Cinematic', 'Arcade / stylized');
  if (text.includes('setting') || text.includes('street') || text.includes('arena') || text.includes('rooftop')) chips.push('Street', 'Rooftop', 'Arena');
  if (!chips.length) chips.push('Premium', 'Fast social', 'Cinematic');
  return Array.from(new Set(chips)).slice(0, 6);
}

function getModelPositionTag(recommendation: AiStrategistRecommendation): string {
  if (recommendation.model.relativeSpeedLevel === 'very-fast' || recommendation.model.relativeSpeedLevel === 'fast') return 'Fast';
  if (recommendation.model.relativeCostLevel === 'low') return 'Value';
  if (recommendation.model.qualityLevel === 'premium') return 'Premium';
  return 'Balanced';
}

function getTierBadgeClassName(tier: AiStrategistTierPosition): string {
  if (tier === 'best') return 'bg-orange-50 text-orange-600';
  if (tier === 'medium') return 'bg-[#eef2ff] text-[#4f46e5]';
  return 'bg-slate-100 text-slate-600';
}

function modelIconText(label: string): string {
  const normalized = label.trim();
  if (/veo/i.test(normalized)) return 'V';
  if (/kling/i.test(normalized)) return 'K';
  if (/seedance/i.test(normalized)) return 'S';
  if (/ltx/i.test(normalized)) return 'L';
  if (/pika/i.test(normalized)) return 'P';
  return normalized.slice(0, 1).toUpperCase();
}

function shortReason(reason: string): string {
  const lower = reason.toLowerCase();
  if (lower.includes('product realism') || lower.includes('product preservation')) {
    return 'Product realism and controlled motion.';
  }
  if (lower.includes('social') || lower.includes('vertical')) {
    return 'Fast vertical pacing for social ads.';
  }
  if (lower.includes('cinematic') || lower.includes('realism')) {
    return 'Cinematic realism and polished motion.';
  }
  if (lower.includes('draft') || lower.includes('storyboard') || lower.includes('low-cost')) {
    return 'Quick low-cost testing.';
  }
  const sentence = reason.split(/[.!?]/).find(Boolean)?.trim() ?? reason.trim();
  return sentence.length > 62 ? `${sentence.slice(0, 59)}...` : sentence;
}

function buildAssistantReply(result: AiStrategistPlaygroundResult): string {
  if (result.mode === 'product_help') return result.assistantMessage;
  if (result.conversationStage === 'collecting_missing_fields' || result.conversationStage === 'awaiting_confirmation') {
    return result.assistantMessage;
  }
  if (result.conversationStage === 'prompt_ready' && (result.mode === 'build_prompt' || result.mode === 'improve_prompt')) {
    return 'Prompt ready. Copy it below, or open settings and warnings first.';
  }
  if (result.recommendations && result.conversationStage === 'awaiting_model_choice') {
    return buildAdvisorRecommendationReply(result);
  }
  return result.assistantMessage;
}

function buildAdvisorRecommendationReply(result: AiStrategistPlaygroundResult): string {
  const brief = cleanClientBrief(result.normalizedBrief.normalizedBrief || result.normalizedBrief.rawUserMessage || 'your video idea');
  const routingReason = describeRoutingPriority(result);
  const workflowReason = describeWorkflowChoice(result);
  const warning = buildClientWarningLine(result);

  return [
    `I understand this as: ${brief}.`,
    `${routingReason} ${workflowReason}`,
    warning,
    'I’d compare three routes below: highest quality, balanced, and faster/value. Pick the one that feels right, then I’ll check the missing creative details before writing the prompt.',
  ]
    .filter(Boolean)
    .join('\n');
}

function cleanClientBrief(value: string): string {
  return value
    .replace(/^create\s+/i, '')
    .replace(/\s+/g, ' ')
    .replace(/[.。]+$/g, '')
    .trim();
}

function describeRoutingPriority(result: AiStrategistPlaygroundResult): string {
  const briefText = `${result.normalizedBrief.normalizedBrief} ${result.normalizedBrief.rawUserMessage}`.toLowerCase();
  if (result.normalizedBrief.hasVoiceover && !result.normalizedBrief.hasVisibleSpeaker) {
    return 'I’ll treat the voiceover as off-camera narration, so the visual direction stays focused on the product or scene.';
  }
  if (result.normalizedBrief.hasVisibleSpeaker || result.normalizedBrief.hasDialogue || result.normalizedBrief.hasLipSyncIntent) {
    return 'Since the person needs to speak, I’ll keep performance, audio timing, and lip-sync readability central to the choice.';
  }
  if (result.normalizedBrief.hasUploadedReference && result.normalizedBrief.hasPerson) {
    return 'Because this uses a person reference, I’ll prioritize identity preservation and controlled motion.';
  }
  if (result.normalizedBrief.hasProduct || /\b(perfume|bottle|sneaker|shoe|car|voiture|jewelry|watch|skincare|packaging)\b/.test(briefText)) {
    return 'Because the product or object needs to look credible, I’ll prioritize controlled motion, clean lighting, and preservation.';
  }
  if (result.normalizedBrief.platformHint === 'tiktok' || result.normalizedBrief.platformHint === 'instagram') {
    return 'For a social format, I’ll prioritize a fast hook, readable motion, and efficient iteration.';
  }
  if (result.normalizedBrief.qualityIntent === 'draft') {
    return 'For a draft pass, I’ll prioritize speed, cost control, and a prompt that is easy to iterate.';
  }
  return 'I’ll prioritize the route that best matches the creative intent, motion needs, and quality target.';
}

function describeWorkflowChoice(result: AiStrategistPlaygroundResult): string {
  if (result.workflow === 'text-to-image-then-image-to-video') {
    return 'A controlled starting image first gives the prompt a stronger hero frame before animation.';
  }
  if (result.workflow === 'image-to-video') {
    return 'Using the image as a reference keeps the subject anchored while the motion stays controlled.';
  }
  if (result.workflow === 'video-to-video') {
    return 'Using the source clip lets the existing timing and motion guide the restyle.';
  }
  return 'A text-to-video route keeps this fast and flexible for the first creative pass.';
}

function buildClientWarningLine(result: AiStrategistPlaygroundResult): string {
  const productWarning = result.warnings.find((warning) => /labels|logos|legal copy|tiny text|packaging/i.test(warning));
  if (productWarning) {
    return 'One note: exact labels, logos, legal copy, and tiny text should be checked after generation or added as overlays.';
  }
  const personWarning = result.warnings.find((warning) => /person\/character reference|identity|face/i.test(warning));
  if (personWarning) {
    return 'One note: person or character references need a compatible image-to-video workflow to reduce identity drift.';
  }
  return '';
}

function resolveTierCommand(text: string): AiStrategistTierPosition | null {
  const normalized = text.trim().toLowerCase();
  if (/^(best|use best|choose best|go best)\b/.test(normalized)) return 'best';
  if (/^(medium|use medium|choose medium|go medium)\b/.test(normalized)) return 'medium';
  if (/^(value|use value|choose value|go value|budget)\b/.test(normalized)) return 'value';
  return null;
}

const preClassName =
  'max-h-[190px] overflow-auto whitespace-pre-wrap rounded-xl border border-[#e3e8f3] bg-white px-3 py-2 font-mono text-[11px] leading-4 text-slate-600';

const compactPreClassName =
  'max-h-[120px] overflow-auto whitespace-pre-wrap rounded-xl border border-[#e3e8f3] bg-white px-3 py-1.5 font-mono text-[11px] leading-4 text-slate-600';

const assistantAvatarClassName =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#7c3aed]/20 bg-[#7c3aed]/10 text-[#7c3aed]';

const assistantBubbleClassName =
  'min-w-0 rounded-2xl rounded-tl-md border border-[#edf1f7] bg-white px-3.5 py-3 text-slate-950 shadow-[0_10px_28px_rgba(15,23,42,0.045)]';

const userBubbleClassName =
  'min-w-0 rounded-2xl rounded-tr-md bg-[#efe7ff] px-3.5 py-3 text-slate-950 shadow-[0_10px_24px_rgba(124,58,237,0.08)]';
