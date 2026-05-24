'use client';

import { usePathname } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  ChevronRight,
  Copy,
  Maximize2,
  MessageCircle,
  Minimize2,
  Paperclip,
  RotateCcw,
  Send,
  X,
} from 'lucide-react';

import { authFetch } from '@/lib/authFetch';
import { dispatchAnalyticsEvent } from '@/lib/analytics-client';
import {
  AI_STRATEGIST_ASK_CTA,
  AI_STRATEGIST_INTRO_MESSAGE,
  AI_STRATEGIST_LAUNCHER_LABEL,
  AI_STRATEGIST_WIDGET_TITLE,
} from '@/lib/ai-strategist/branding';
import { isAiStrategistBetaWidgetEnabled } from '@/lib/ai-strategist/beta-flags';
import {
  getAiStrategistApplyHref,
  resolveAiStrategistApplyTarget,
  storePendingAiStrategistApply,
  type AiStrategistBetaBridgeContext,
  type AiStrategistBetaOpenOptions,
} from '@/lib/ai-strategist/beta-bridge';
import type { AiStrategistBetaResponse } from '@/lib/ai-strategist/beta-response';
import type { AiStrategistPlaygroundInput } from '@/lib/ai-strategist/playground-pipeline';
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
  result?: AiStrategistBetaResponse;
};

type LastRequestContext = {
  userMessage: string;
};

type BetaErrorResponse = {
  ok?: false;
  error?: string;
};

type WidgetPosition = {
  x: number;
  y: number;
};

type WidgetSize = {
  width: number;
  height: number;
};

type WidgetDragState = {
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  width: number;
  height: number;
};

type WidgetResizeState = {
  startX: number;
  startY: number;
  originWidth: number;
  originHeight: number;
  originX: number;
  originY: number;
};

const WIDGET_VIEWPORT_MARGIN = 12;
const WIDGET_MIN_WIDTH = 360;
const WIDGET_MIN_HEIGHT = 420;
const WIDGET_MAX_WIDTH = 760;
const WIDGET_MAX_HEIGHT = 860;
const PROMPT_ASSISTANT_INTRO_MESSAGE =
  'Prompt assistant mode. I can improve the current prompt, adapt it to the selected model, or turn a rough idea into a production-ready MaxVideoAI prompt. Tell me what direction you want, or paste the prompt you want to refine.';

export function AiStrategistBetaSidebarWidget() {
  const pathname = usePathname();
  const messageId = useRef(0);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const widgetRef = useRef<HTMLElement | null>(null);
  const dragStateRef = useRef<WidgetDragState | null>(null);
  const resizeStateRef = useRef<WidgetResizeState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'intro',
      role: 'assistant',
      text: AI_STRATEGIST_INTRO_MESSAGE,
    },
  ]);
  const [isWidgetOpen, setIsWidgetOpen] = useState(false);
  const [input, setInput] = useState('');
  const [lastContext, setLastContext] = useState<LastRequestContext | null>(null);
  const [lastResult, setLastResult] = useState<AiStrategistBetaResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [appliedAt, setAppliedAt] = useState<number | null>(null);
  const [hasLiveApplyBridge, setHasLiveApplyBridge] = useState(false);
  const [portalMounted, setPortalMounted] = useState(false);
  const [widgetPosition, setWidgetPosition] = useState<WidgetPosition | null>(null);
  const [widgetSize, setWidgetSize] = useState<WidgetSize | null>(null);
  const [isDraggingWidget, setIsDraggingWidget] = useState(false);
  const [isResizingWidget, setIsResizingWidget] = useState(false);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, isSubmitting, isWidgetOpen]);

  useEffect(() => {
    setPortalMounted(true);
  }, []);

  useEffect(() => {
    setHasLiveApplyBridge(Boolean(window.__mvaiAiStrategistBeta?.applyUiActions));
  }, [pathname, isWidgetOpen]);

  const openWidget = useCallback((options?: AiStrategistBetaOpenOptions) => {
    setIsWidgetOpen(true);
    if (options?.mode === 'prompt_assistant') {
      setMessages((current) => {
        const nextMessage = createPromptAssistantIntro(options.currentPrompt);
        if (current.length === 1 && current[0]?.id === 'intro') {
          return [nextMessage];
        }
        if (current.some((message) => message.id === 'prompt-assistant-intro')) {
          return current;
        }
        return [...current, nextMessage];
      });
      setLastContext(options.currentPrompt?.trim() ? { userMessage: options.currentPrompt.trim() } : null);
    }
    dispatchAnalyticsEvent('ai_strategist_beta_open', {
      mode: options?.mode ?? 'general',
      source: options?.source ?? 'sidebar',
      surface: 'app_sidebar',
    });
    return true;
  }, []);

  useEffect(() => {
    const previousBridge = window.__mvaiAiStrategistBeta;
    window.__mvaiAiStrategistBeta = {
      ...previousBridge,
      openWidget,
    };

    return () => {
      if (window.__mvaiAiStrategistBeta?.openWidget !== openWidget) return;
      if (previousBridge?.openWidget) {
        window.__mvaiAiStrategistBeta = {
          ...window.__mvaiAiStrategistBeta,
          openWidget: previousBridge.openWidget,
        };
      } else {
        const rest = { ...window.__mvaiAiStrategistBeta };
        delete rest.openWidget;
        window.__mvaiAiStrategistBeta = Object.keys(rest).length ? rest : previousBridge;
      }
    };
  }, [openWidget]);

  useEffect(() => {
    if (!widgetPosition && !widgetSize) return;

    function handleResize() {
      const widget = widgetRef.current;
      if (!widget) return;
      const rect = widget.getBoundingClientRect();
      setWidgetSize((current) =>
        current ? clampWidgetSize(current.width, current.height, rect.left, rect.top) : current
      );
      setWidgetPosition((current) =>
        current ? clampWidgetPosition(current.x, current.y, rect.width, rect.height) : current
      );
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [widgetPosition, widgetSize]);

  if (!isAiStrategistBetaWidgetEnabled()) return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text || isSubmitting) return;

    await runChatRequest(
      {
        userMessage: text,
        mode: 'recommend',
      },
      text,
      buildContext(text)
    );
    setInput('');
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  async function submitRecommendationChoice(tier: AiStrategistTierPosition, recommendation: AiStrategistRecommendation) {
    if (isSubmitting) return;
    await runChatRequest(
      {
        userMessage: `Choose ${tier}`,
        mode: 'recommend',
        selectedTier: tier,
        selectedModel: recommendation.model.id,
      },
      `Choose ${tier}: ${recommendation.model.label}`,
      lastContext ?? buildContext(recommendation.reason)
    );
  }

  async function submitAlternativeChoice(alternative: AiStrategistAlsoConsider) {
    if (isSubmitting) return;
    await runChatRequest(
      {
        userMessage: `Choose ${alternative.model.label}`,
        mode: 'recommend',
        selectedModel: alternative.model.id,
      },
      `Choose ${alternative.model.label}`,
      lastContext ?? buildContext(alternative.reason)
    );
  }

  async function submitGeneratePrompt() {
    if (isSubmitting) return;
    await runChatRequest(
      {
        userMessage: 'Generate prompt',
        mode: 'recommend',
      },
      'Generate prompt',
      lastContext ?? buildContext('Generate prompt')
    );
  }

  async function submitMakeAssumptions() {
    if (isSubmitting) return;
    await runChatRequest(
      {
        userMessage: 'Make smart assumptions and continue',
        mode: 'recommend',
      },
      'Make smart assumptions and continue',
      lastContext ?? buildContext('Make smart assumptions and continue')
    );
  }

  async function submitQuickReply(reply: string) {
    if (isSubmitting) return;
    await runChatRequest(
      {
        userMessage: reply,
        mode: 'recommend',
      },
      reply,
      lastContext ?? buildContext(reply)
    );
  }

  function resetChat() {
    messageId.current = 0;
    setMessages([
      {
        id: 'intro',
        role: 'assistant',
        text: AI_STRATEGIST_INTRO_MESSAGE,
      },
    ]);
    setLastContext(null);
    setLastResult(null);
    setError(null);
    setInput('');
    setAppliedAt(null);
    dispatchAnalyticsEvent('ai_strategist_beta_reset', { surface: 'app_sidebar' });
  }

  async function runChatRequest(
    payload: AiStrategistPlaygroundInput,
    visibleUserText: string,
    context: LastRequestContext
  ) {
    setIsSubmitting(true);
    setError(null);
    setAppliedAt(null);
    setMessages((current) => [...current, createMessage('user', visibleUserText)]);
    dispatchAnalyticsEvent('ai_strategist_beta_message', {
      mode: payload.mode ?? 'recommend',
      stage: lastResult?.conversationStage ?? 'collecting_brief',
      surface: 'app_sidebar',
    });

    try {
      const bridgeContext = readBridgeContext();
      const response = await authFetch('/api/ai-video-strategist/beta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          surface: 'chat',
          currentPrompt: bridgeContext.currentPrompt || payload.currentPrompt,
          selectedWorkflow: payload.selectedWorkflow ?? bridgeContext.selectedWorkflow,
          pageContext: buildPageContext(pathname, bridgeContext.pageContext),
          uploadedAsset: payload.uploadedAsset ?? bridgeContext.uploadedAsset,
          conversationState: buildConversationState(),
        }),
      });
      const json = (await response.json().catch(() => null)) as AiStrategistBetaResponse | BetaErrorResponse | null;
      if (!response.ok || !json?.ok) {
        throw new Error(getBetaErrorMessage(json) ?? `${AI_STRATEGIST_WIDGET_TITLE} request failed`);
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
      const message = submitError instanceof Error ? submitError.message : `${AI_STRATEGIST_WIDGET_TITLE} request failed`;
      setError(message);
      setMessages((current) => [...current, createMessage('assistant', `I could not run the strategist beta: ${message}`)]);
    } finally {
      setIsSubmitting(false);
    }
  }

  function buildContext(userMessage: string): LastRequestContext {
    return { userMessage };
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
      ...(lastResult?.briefCompletion ? { lastBriefCompletion: toConversationBriefCompletion(lastResult.briefCompletion) } : {}),
    };
  }

  function resolveNextContext(result: AiStrategistBetaResponse, submittedContext: LastRequestContext): LastRequestContext {
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

  function applyUiActions(result: AiStrategistBetaResponse) {
    const appliedCount = window.__mvaiAiStrategistBeta?.applyUiActions?.(result) ?? 0;
    if (!appliedCount) {
      const target = resolveAiStrategistApplyTarget(result, pathname);
      const href = getAiStrategistApplyHref(target);
      if (!storePendingAiStrategistApply(result, target)) return;
      dispatchAnalyticsEvent('ai_strategist_beta_apply_redirect', {
        href,
        selectedModel: result.selectedModel,
        target,
        workflow: result.workflow,
        surface: 'app_sidebar',
      });
      window.location.assign(href);
      return;
    }
    setAppliedAt(Date.now());
    dispatchAnalyticsEvent('ai_strategist_beta_apply_preview', {
      actionCount: appliedCount,
      selectedModel: result.selectedModel,
      workflow: result.workflow,
      surface: 'app_sidebar',
    });
  }

  function handleWidgetMouseDown(event: ReactMouseEvent<HTMLElement>) {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest('button,a,input,textarea')) return;
    const widget = widgetRef.current;
    if (!widget) return;

    const rect = widget.getBoundingClientRect();
    dragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: rect.left,
      originY: rect.top,
      width: rect.width,
      height: rect.height,
    };
    setWidgetPosition({ x: rect.left, y: rect.top });
    setIsDraggingWidget(true);
    event.preventDefault();

    function handleDocumentMouseMove(moveEvent: MouseEvent) {
      const dragState = dragStateRef.current;
      if (!dragState) return;

      setWidgetPosition(
        clampWidgetPosition(
          dragState.originX + moveEvent.clientX - dragState.startX,
          dragState.originY + moveEvent.clientY - dragState.startY,
          dragState.width,
          dragState.height
        )
      );
    }

    function handleDocumentMouseUp() {
      dragStateRef.current = null;
      setIsDraggingWidget(false);
      document.removeEventListener('mousemove', handleDocumentMouseMove);
      document.removeEventListener('mouseup', handleDocumentMouseUp);
    }

    document.addEventListener('mousemove', handleDocumentMouseMove);
    document.addEventListener('mouseup', handleDocumentMouseUp);
  }

  function handleWidgetResizeMouseDown(event: ReactMouseEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    const widget = widgetRef.current;
    if (!widget) return;

    const rect = widget.getBoundingClientRect();
    resizeStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originWidth: rect.width,
      originHeight: rect.height,
      originX: rect.left,
      originY: rect.top,
    };
    setWidgetPosition({ x: rect.left, y: rect.top });
    setWidgetSize({ width: rect.width, height: rect.height });
    setIsResizingWidget(true);
    event.preventDefault();
    event.stopPropagation();

    function handleDocumentMouseMove(moveEvent: MouseEvent) {
      const resizeState = resizeStateRef.current;
      if (!resizeState) return;

      setWidgetSize(
        clampWidgetSize(
          resizeState.originWidth + moveEvent.clientX - resizeState.startX,
          resizeState.originHeight + moveEvent.clientY - resizeState.startY,
          resizeState.originX,
          resizeState.originY
        )
      );
    }

    function handleDocumentMouseUp() {
      resizeStateRef.current = null;
      setIsResizingWidget(false);
      document.removeEventListener('mousemove', handleDocumentMouseMove);
      document.removeEventListener('mouseup', handleDocumentMouseUp);
    }

    document.addEventListener('mousemove', handleDocumentMouseMove);
    document.addEventListener('mouseup', handleDocumentMouseUp);
  }

  const widgetStyle =
    widgetPosition || widgetSize
      ? ({
          ...(widgetPosition
            ? {
                bottom: 'auto',
                left: widgetPosition.x,
                top: widgetPosition.y,
              }
            : {}),
          ...(widgetSize
            ? {
                height: widgetSize.height,
                width: widgetSize.width,
              }
            : {}),
        } satisfies CSSProperties)
      : undefined;

  return (
    <>
      {isWidgetOpen && portalMounted
        ? createPortal(
        <section
          ref={widgetRef}
          data-testid="app-ai-strategist-widget"
          className="fixed bottom-6 left-[204px] z-40 hidden h-[min(690px,calc(100vh-8rem))] w-[470px] flex-col overflow-hidden rounded-[26px] border border-[#e5eaf4] bg-white shadow-[0_30px_90px_rgba(15,23,42,0.22)] md:flex"
          style={widgetStyle}
        >
          <header
            className={`flex min-h-[58px] items-center justify-between border-b border-[#edf1f7] px-4 ${isDraggingWidget ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
            title="Drag to move"
            onMouseDown={handleWidgetMouseDown}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface-2 text-text-secondary">
                <MessageCircle className="h-4 w-4" strokeWidth={1.8} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-950">{AI_STRATEGIST_WIDGET_TITLE}</p>
                <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Beta online
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <IconButton label="Reset chat" onClick={resetChat}>
                <RotateCcw className="h-3.5 w-3.5" />
              </IconButton>
              <IconButton label={`Minimize ${AI_STRATEGIST_WIDGET_TITLE}`} onClick={() => setIsWidgetOpen(false)}>
                <Minimize2 className="h-3.5 w-3.5" />
              </IconButton>
              <IconButton label={`Close ${AI_STRATEGIST_WIDGET_TITLE}`} onClick={() => setIsWidgetOpen(false)}>
                <X className="h-4 w-4" />
              </IconButton>
            </div>
          </header>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((message) => (
              <ChatBubble
                key={message.id}
                message={message}
                isSubmitting={isSubmitting}
                appliedAt={appliedAt}
                onChooseRecommendation={submitRecommendationChoice}
                onChooseAlternative={submitAlternativeChoice}
                onGeneratePrompt={submitGeneratePrompt}
                onMakeAssumptions={submitMakeAssumptions}
                onQuickReply={(reply) => void submitQuickReply(reply)}
                onApply={applyUiActions}
                hasLiveApplyBridge={hasLiveApplyBridge}
              />
            ))}
            {isSubmitting ? (
              <div className="flex items-center gap-2 px-1 text-xs font-semibold text-slate-500">
                <MessageCircle className="h-3.5 w-3.5 animate-pulse text-text-muted" strokeWidth={1.8} />
                Assistant is thinking...
              </div>
            ) : null}
            <div ref={scrollAnchorRef} />
          </div>

          <form onSubmit={handleSubmit} className="border-t border-[#edf1f7] bg-white px-4 py-3">
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
                placeholder={`${AI_STRATEGIST_ASK_CTA}...`}
                aria-keyshortcuts="Enter"
                className="min-h-[42px] flex-1 resize-none border-0 bg-transparent py-3 text-sm font-medium leading-5 text-slate-900 outline-none placeholder:text-slate-400"
              />
              <button
                type="submit"
                disabled={isSubmitting || !input.trim()}
                aria-label="Send message"
                className="mb-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-text-primary text-surface shadow-[0_12px_28px_rgba(15,23,42,0.2)] transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            {error ? <p className="mt-2 rounded-xl border border-error/25 bg-error/10 px-3 py-2 text-xs font-semibold text-error">{error}</p> : null}
            <p className="mt-2 text-[10px] font-medium text-slate-400">Beta preview — does not run generation or spend credits.</p>
          </form>
          <button
            type="button"
            aria-label="Resize AI Assistant"
            title="Resize"
            onMouseDown={handleWidgetResizeMouseDown}
            className={`absolute bottom-2 right-2 flex h-6 w-6 cursor-se-resize items-center justify-center rounded-full text-slate-300 transition hover:bg-slate-100 hover:text-slate-600 ${isResizingWidget ? 'bg-slate-100 text-slate-600' : ''}`}
          >
            <Maximize2 className="h-3.5 w-3.5" strokeWidth={1.6} />
          </button>
        </section>,
            document.body
          )
        : null}

      <li className="group/sidebar-item relative hidden md:block">
        <button
          type="button"
          data-testid="app-ai-strategist-sidebar-trigger"
          aria-expanded={isWidgetOpen}
          aria-label={isWidgetOpen ? `Close ${AI_STRATEGIST_WIDGET_TITLE}` : `Open ${AI_STRATEGIST_WIDGET_TITLE}`}
          onClick={() => {
            const nextOpen = !isWidgetOpen;
            if (nextOpen) {
              openWidget({ source: 'sidebar', mode: 'general' });
            } else {
              setIsWidgetOpen(false);
            }
            dispatchAnalyticsEvent('ai_strategist_beta_launcher_toggle', {
              nextOpen,
              surface: 'app_sidebar',
            });
          }}
          className="relative flex min-h-[42px] w-full items-center gap-2 rounded-input border border-transparent px-2 text-left text-sm font-semibold text-text-secondary transition-colors duration-150 hover:bg-surface hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center text-text-muted transition-colors group-hover/sidebar-item:text-text-primary" aria-hidden>
            <MessageCircle className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </span>
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <span className="truncate">{AI_STRATEGIST_LAUNCHER_LABEL}</span>
            <span className="rounded-full border border-hairline bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-text-muted">
              Beta
            </span>
          </span>
        </button>
      </li>
    </>
  );
}

function ChatBubble({
  message,
  isSubmitting,
  appliedAt,
  onChooseRecommendation,
  onChooseAlternative,
  onGeneratePrompt,
  onMakeAssumptions,
  onQuickReply,
  onApply,
  hasLiveApplyBridge,
}: {
  message: ChatMessage;
  isSubmitting: boolean;
  appliedAt: number | null;
  onChooseRecommendation: (tier: AiStrategistTierPosition, recommendation: AiStrategistRecommendation) => void;
  onChooseAlternative: (alternative: AiStrategistAlsoConsider) => void;
  onGeneratePrompt: () => void;
  onMakeAssumptions: () => void;
  onQuickReply: (reply: string) => void;
  onApply: (result: AiStrategistBetaResponse) => void;
  hasLiveApplyBridge: boolean;
}) {
  const isUser = message.role === 'user';
  const articleClassName = isUser ? 'ml-auto max-w-[80%]' : message.result ? 'mr-auto w-full' : 'mr-auto max-w-[92%]';
  const bubbleClassName = isUser ? userBubbleClassName : `${assistantBubbleClassName} ${message.result ? 'flex-1' : ''}`;
  return (
    <article className={articleClassName}>
      <div className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}>
        {isUser ? null : (
          <span className={assistantAvatarClassName}>
            <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.8} />
          </span>
        )}
        <div className={bubbleClassName}>
          <p className="whitespace-pre-wrap text-[13px] leading-5">{message.text}</p>
          {message.result ? (
            <ChatResult
              result={message.result}
              isSubmitting={isSubmitting}
              appliedAt={appliedAt}
              onChooseRecommendation={onChooseRecommendation}
              onChooseAlternative={onChooseAlternative}
              onGeneratePrompt={onGeneratePrompt}
              onMakeAssumptions={onMakeAssumptions}
              onQuickReply={onQuickReply}
              onApply={onApply}
              hasLiveApplyBridge={hasLiveApplyBridge}
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
  appliedAt,
  onChooseRecommendation,
  onChooseAlternative,
  onGeneratePrompt,
  onMakeAssumptions,
  onQuickReply,
  onApply,
  hasLiveApplyBridge,
}: {
  result: AiStrategistBetaResponse;
  isSubmitting: boolean;
  appliedAt: number | null;
  onChooseRecommendation: (tier: AiStrategistTierPosition, recommendation: AiStrategistRecommendation) => void;
  onChooseAlternative: (alternative: AiStrategistAlsoConsider) => void;
  onGeneratePrompt: () => void;
  onMakeAssumptions: () => void;
  onQuickReply: (reply: string) => void;
  onApply: (result: AiStrategistBetaResponse) => void;
  hasLiveApplyBridge: boolean;
}) {
  const showPrompt = result.conversationStage === 'prompt_ready' && (result.mode === 'build_prompt' || result.mode === 'improve_prompt');
  return (
    <div className="mt-2.5 space-y-2.5">
      {result.recommendations && result.conversationStage === 'awaiting_model_choice' ? (
        <>
          <div className="grid grid-cols-1 gap-2 min-[430px]:grid-cols-3">
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
        </>
      ) : null}

      {result.conversationStage === 'collecting_missing_fields' ? (
        <div className="flex flex-wrap gap-2">
          {buildMissingInfoChips(result).map((chip) => (
            <QuickActionButton key={chip} disabled={isSubmitting} onClick={() => onQuickReply(chip)}>
              {chip}
            </QuickActionButton>
          ))}
          <QuickActionButton disabled={isSubmitting} onClick={onMakeAssumptions}>
            <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.8} />
            Make assumptions
          </QuickActionButton>
        </div>
      ) : null}

      {result.conversationStage === 'awaiting_confirmation' ? (
        <div className="flex flex-wrap gap-2">
          <QuickActionButton disabled={isSubmitting} onClick={onGeneratePrompt}>
            <Check className="h-3.5 w-3.5" />
            Generate prompt
          </QuickActionButton>
          <QuickActionButton disabled={isSubmitting} onClick={() => onQuickReply('Adjust brief')}>
            Adjust
          </QuickActionButton>
          <QuickActionButton disabled={isSubmitting} onClick={() => onQuickReply('Change model')}>
            Change model
          </QuickActionButton>
        </div>
      ) : null}

      {showPrompt && result.sanitizedFinalOutput ? (
        <PromptPreview
          result={result}
          appliedAt={appliedAt}
          hasLiveApplyBridge={hasLiveApplyBridge}
          onApply={onApply}
        />
      ) : null}
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
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChoose(tier, recommendation)}
      className="group min-h-[124px] rounded-2xl border border-[#e4e9f3] bg-white px-3 py-3 text-left shadow-[0_12px_28px_rgba(15,23,42,0.045)] transition hover:border-slate-300 hover:bg-slate-50/70 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="flex items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${getTierBadgeClassName(tier)}`}>
          {label}
        </span>
        <ChevronRight className="h-3.5 w-3.5 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700" />
      </span>
      <span className="mt-2 flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-[11px] font-bold text-white">
          {modelIconText(recommendation.model.label)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-semibold text-slate-950">{recommendation.model.label}</span>
          <span className="mt-0.5 inline-flex rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
            {getModelPositionTag(recommendation)}
          </span>
        </span>
      </span>
      <span className="mt-2 block max-h-8 overflow-hidden text-[11px] leading-4 text-slate-500">{shortReason(recommendation.reason)}</span>
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
      className="group inline-flex min-h-[34px] max-w-full items-center gap-2 rounded-full border border-[#e4e9f3] bg-white px-2.5 text-left text-[11px] font-semibold text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.035)] transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-950 text-[9px] font-bold text-white">
        {modelIconText(alternative.model.label)}
      </span>
      <span className="truncate">Also consider {alternative.model.label}</span>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700" />
    </button>
  );
}

function PromptPreview({
  result,
  appliedAt,
  hasLiveApplyBridge,
  onApply,
}: {
  result: AiStrategistBetaResponse;
  appliedAt: number | null;
  hasLiveApplyBridge: boolean;
  onApply: (result: AiStrategistBetaResponse) => void;
}) {
  const output = result.sanitizedFinalOutput;
  const [copied, setCopied] = useState(false);
  if (!output) return null;
  const finalPrompt = output.finalPrompt;
  const canApply = hasLiveApplyBridge || result.uiActions.length > 0;

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(finalPrompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-2">
      <PreviewSection
        title="Prompt"
        action={
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => void copyPrompt()}
              className="inline-flex min-h-[26px] items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-950"
            >
              <Copy className="h-3 w-3" />
              {copied ? 'Copied' : 'Copy'}
            </button>
            {canApply ? (
              <button
                type="button"
                onClick={() => onApply(result)}
                className="inline-flex min-h-[26px] items-center gap-1.5 rounded-full border border-slate-950 bg-slate-950 px-2.5 text-[11px] font-semibold text-white shadow-[0_10px_22px_rgba(15,23,42,0.2)] transition hover:bg-slate-800"
              >
                {hasLiveApplyBridge ? 'Apply to generator' : 'Apply in generator'}
              </button>
            ) : null}
          </div>
        }
      >
        <pre className={promptPreClassName}>{finalPrompt}</pre>
        {appliedAt ? <p className="mt-1.5 text-[10px] font-semibold text-emerald-600">Applied to the generator preview. Review before rendering.</p> : null}
      </PreviewSection>
      <CompactDetails title="Negative prompt">
        <pre className={compactPreClassName}>{output.negativePrompt}</pre>
      </CompactDetails>
      <CompactDetails title="Settings">
        <List items={output.settings} empty="No settings returned." />
      </CompactDetails>
      <CompactDetails title="Warnings">
        <List items={result.warnings} empty="No warnings." />
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

function List({ items, empty }: { items: string[]; empty: string }) {
  if (!items.length) return <p className="text-xs leading-5 text-slate-500">{empty}</p>;
  return (
    <ul className="space-y-1 text-xs leading-5 text-slate-500">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <ChevronRight className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-400" />
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
      className="inline-flex min-h-[32px] items-center justify-center gap-1.5 rounded-full border border-[#e4e9f3] bg-white px-3 text-[11px] font-semibold text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.04)] transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
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

function buildAssistantReply(result: AiStrategistBetaResponse): string {
  if (result.mode === 'product_help') return result.assistantMessage;
  if (result.conversationStage === 'collecting_missing_fields' || result.conversationStage === 'awaiting_confirmation') {
    return result.assistantMessage;
  }
  if (result.conversationStage === 'prompt_ready' && (result.mode === 'build_prompt' || result.mode === 'improve_prompt')) {
    return 'Prompt ready. Review it below, then apply it to the generator when you are happy.';
  }
  if (result.recommendations && result.conversationStage === 'awaiting_model_choice') {
    return buildAdvisorRecommendationReply(result);
  }
  return result.assistantMessage;
}

function buildAdvisorRecommendationReply(result: AiStrategistBetaResponse): string {
  const brief = cleanClientBrief(result.normalizedBrief.normalizedBrief || result.normalizedBrief.rawUserMessage || 'your video idea');
  const warning = buildClientWarningLine(result);
  return [
    `I understand this as: ${brief}.`,
    `${describeRoutingPriority(result)} ${describeWorkflowChoice(result)}`,
    warning,
    'I’d compare three routes below. Pick the one that feels right, then I’ll check the missing creative details before writing the prompt.',
  ]
    .filter(Boolean)
    .join('\n');
}

function describeRoutingPriority(result: AiStrategistBetaResponse): string {
  const briefText = `${result.normalizedBrief.normalizedBrief} ${result.normalizedBrief.rawUserMessage}`.toLowerCase();
  if (result.normalizedBrief.hasVoiceover && !result.normalizedBrief.hasVisibleSpeaker) {
    return 'I’ll treat the voiceover as off-camera narration, so the visuals stay focused on the product or scene.';
  }
  if (result.normalizedBrief.hasVisibleSpeaker || result.normalizedBrief.hasDialogue || result.normalizedBrief.hasLipSyncIntent) {
    return 'Since a person needs to speak, I’ll keep performance, audio timing, and lip-sync readability central to the choice.';
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
  return 'I’ll prioritize the route that best matches the creative intent, motion needs, and quality target.';
}

function describeWorkflowChoice(result: AiStrategistBetaResponse): string {
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

function buildClientWarningLine(result: AiStrategistBetaResponse): string {
  const productWarning = result.warnings.find((warning) => /labels|logos|legal copy|tiny text|packaging/i.test(warning));
  if (productWarning) {
    return 'One note: exact labels, logos, legal copy, and tiny text should be checked after generation or added as overlays.';
  }
  const personWarning = result.warnings.find((warning) => /person\/character reference|identity|face/i.test(warning));
  if (personWarning) {
    return 'One note: person or character references need compatible routing to reduce identity drift.';
  }
  return '';
}

function buildMissingInfoChips(result: AiStrategistBetaResponse): string[] {
  const text = `${result.assistantMessage}\n${result.briefCompletion?.missingFields.join(' ') ?? ''}`.toLowerCase();
  const chips: string[] = [];
  if (text.includes('fighter')) chips.push('One fighter', 'Two fighters');
  if (text.includes('style') || text.includes('stylized') || text.includes('cinematic')) chips.push('Cinematic', 'Arcade / stylized');
  if (text.includes('setting') || text.includes('street') || text.includes('arena') || text.includes('rooftop')) chips.push('Street', 'Rooftop', 'Arena');
  if (!chips.length) chips.push('Premium', 'Fast social', 'Cinematic');
  return Array.from(new Set(chips)).slice(0, 6);
}

function cleanClientBrief(value: string): string {
  return value
    .replace(/^create\s+/i, '')
    .replace(/\s+/g, ' ')
    .replace(/[.。]+$/g, '')
    .trim();
}

function getModelPositionTag(recommendation: AiStrategistRecommendation): string {
  if (recommendation.model.relativeSpeedLevel === 'very-fast' || recommendation.model.relativeSpeedLevel === 'fast') return 'Fast';
  if (recommendation.model.relativeCostLevel === 'low') return 'Value';
  if (recommendation.model.qualityLevel === 'premium') return 'Premium';
  return 'Balanced';
}

function getTierBadgeClassName(tier: AiStrategistTierPosition): string {
  if (tier === 'best') return 'bg-slate-950 text-white';
  if (tier === 'medium') return 'bg-slate-100 text-slate-700';
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
  if (lower.includes('product realism') || lower.includes('product preservation')) return 'Product realism and controlled motion.';
  if (lower.includes('social') || lower.includes('vertical')) return 'Fast vertical pacing for social ads.';
  if (lower.includes('cinematic') || lower.includes('realism')) return 'Cinematic realism and polished motion.';
  if (lower.includes('draft') || lower.includes('storyboard') || lower.includes('low-cost')) return 'Quick low-cost testing.';
  const sentence = reason.split(/[.!?]/).find(Boolean)?.trim() ?? reason.trim();
  return sentence.length > 58 ? `${sentence.slice(0, 55)}...` : sentence;
}

function getBetaErrorMessage(value: AiStrategistBetaResponse | BetaErrorResponse | null): string | undefined {
  return value && value.ok !== true && typeof value.error === 'string' ? value.error : undefined;
}

function readBridgeContext(): AiStrategistBetaBridgeContext {
  if (typeof window === 'undefined') return {};
  return window.__mvaiAiStrategistBeta?.getPageContext?.() ?? {};
}

function buildPageContext(pathname: string | null, bridgePageContext: unknown): unknown {
  const base = {
    surface: pathname === '/app' ? 'generate_video' : 'app_sidebar',
    pathname,
  };
  if (!bridgePageContext || typeof bridgePageContext !== 'object' || Array.isArray(bridgePageContext)) {
    return base;
  }
  return {
    ...base,
    ...(bridgePageContext as Record<string, unknown>),
  };
}

function toConversationBriefCompletion(
  completion: NonNullable<AiStrategistBetaResponse['briefCompletion']>
): NonNullable<AiStrategistPlaygroundInput['conversationState']>['lastBriefCompletion'] {
  return {
    resolvedBrief: completion.resolvedBrief,
    selectedModel: completion.selectedModel,
    ...(completion.selectedTier ? { selectedTier: completion.selectedTier } : {}),
    selectedWorkflow: completion.selectedWorkflow,
    missingFields: completion.missingFields.map((field) => field.label),
    assumptions: completion.assumptions,
    confirmationSummary: completion.confirmationSummary,
  };
}

function createPromptAssistantIntro(currentPrompt?: string): ChatMessage {
  const hasPrompt = Boolean(currentPrompt?.trim());
  return {
    id: 'prompt-assistant-intro',
    role: 'assistant',
    text: hasPrompt
      ? 'Prompt assistant mode. I can see the current prompt from Generate Video. Tell me how you want to improve it: more premium, shorter, model-specific, more cinematic, better product detail, or ready for a specific workflow.'
      : PROMPT_ASSISTANT_INTRO_MESSAGE,
  };
}

function clampWidgetPosition(x: number, y: number, width: number, height: number): WidgetPosition {
  if (typeof window === 'undefined') return { x, y };

  const maxX = Math.max(WIDGET_VIEWPORT_MARGIN, window.innerWidth - width - WIDGET_VIEWPORT_MARGIN);
  const maxY = Math.max(WIDGET_VIEWPORT_MARGIN, window.innerHeight - height - WIDGET_VIEWPORT_MARGIN);
  return {
    x: Math.min(Math.max(x, WIDGET_VIEWPORT_MARGIN), maxX),
    y: Math.min(Math.max(y, WIDGET_VIEWPORT_MARGIN), maxY),
  };
}

function clampWidgetSize(width: number, height: number, x: number, y: number): WidgetSize {
  if (typeof window === 'undefined') return { width, height };

  const maxWidth = Math.max(WIDGET_MIN_WIDTH, Math.min(WIDGET_MAX_WIDTH, window.innerWidth - x - WIDGET_VIEWPORT_MARGIN));
  const maxHeight = Math.max(WIDGET_MIN_HEIGHT, Math.min(WIDGET_MAX_HEIGHT, window.innerHeight - y - WIDGET_VIEWPORT_MARGIN));
  return {
    width: Math.min(Math.max(width, WIDGET_MIN_WIDTH), maxWidth),
    height: Math.min(Math.max(height, WIDGET_MIN_HEIGHT), maxHeight),
  };
}

const promptPreClassName =
  'max-h-[190px] overflow-auto whitespace-pre-wrap rounded-xl border border-[#e3e8f3] bg-white px-3 py-2 font-mono text-[11px] leading-4 text-slate-600';

const compactPreClassName =
  'max-h-[120px] overflow-auto whitespace-pre-wrap rounded-xl border border-[#e3e8f3] bg-white px-3 py-1.5 font-mono text-[11px] leading-4 text-slate-600';

const assistantAvatarClassName =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface-2 text-text-secondary';

const assistantBubbleClassName =
  'min-w-0 rounded-2xl rounded-tl-md border border-[#edf1f7] bg-white px-3.5 py-3 text-slate-950 shadow-[0_10px_28px_rgba(15,23,42,0.045)]';

const userBubbleClassName =
  'min-w-0 rounded-2xl rounded-tr-md bg-slate-100 px-3.5 py-3 text-slate-950 shadow-[0_10px_24px_rgba(15,23,42,0.06)]';
