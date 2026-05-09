'use client';

import { FormEvent, useEffect, useRef } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { VIDEO_AGENT_COPY } from '../_lib/video-agent-copy';
import type { VideoAgentConfirmation, VideoAgentFlowPhase, VideoAgentMessage } from '../_lib/video-agent-state';

type VideoAgentChatProps = {
  confirmation: VideoAgentConfirmation | null;
  phase: VideoAgentFlowPhase;
  inputValue: string;
  isThinking: boolean;
  messages: VideoAgentMessage[];
  onConfirmPrototype: () => void;
  onInputChange: (value: string) => void;
  onSendMessage: (value?: string) => void;
};

export function VideoAgentChat({
  confirmation,
  phase,
  inputValue,
  isThinking,
  messages,
  onConfirmPrototype,
  onInputChange,
  onSendMessage,
}: VideoAgentChatProps) {
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const messagesElement = messagesRef.current;
    if (!messagesElement) return;
    messagesElement.scrollTop = messagesElement.scrollHeight;
  }, [messages.length, isThinking]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSendMessage();
  };

  return (
    <section className="flex h-[580px] min-h-0 flex-1 flex-col overflow-hidden rounded-[8px] border border-border bg-surface shadow-sm md:h-[640px]">
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-5 py-4">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-text-primary text-bg">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-text-primary">{VIDEO_AGENT_COPY.chat.header}</h2>
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-text-muted">
              {VIDEO_AGENT_COPY.chat.badge}
            </span>
          </div>
          <p className="text-xs text-text-muted">Guided by chat, generated with Seedance 2.0.</p>
        </div>
      </div>

      <div ref={messagesRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {messages.map((message) => (
          <div
            key={message.id}
            className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
          >
            <div className="max-w-[78%]">
              <div
                className={[
                  'whitespace-pre-line rounded-[8px] px-4 py-3 text-sm leading-6',
                  message.role === 'user'
                    ? 'bg-text-primary text-bg'
                    : 'bg-surface-2 text-text-primary',
                ].join(' ')}
              >
                {message.text}
              </div>
              <p className="mt-2 text-xs text-text-muted">{message.createdAtLabel}</p>
            </div>
          </div>
        ))}
        {isThinking ? (
          <div className="flex justify-start">
            <div className="max-w-[78%]">
              <div className="rounded-[8px] bg-surface-2 px-4 py-3 text-sm leading-6 text-text-secondary">
                Thinking through the brief...
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-border p-4">
        {phase === 'confirm' && confirmation ? (
          <div className="mb-3 rounded-[8px] border border-border bg-bg p-3">
            <p className="text-sm font-semibold text-text-primary">{confirmation.summary}</p>
            {confirmation.warnings.length ? (
              <p className="mt-2 text-xs leading-5 text-text-muted">
                {confirmation.warnings.map((warning) => warning.message).join(' ')}
              </p>
            ) : null}
            <button
              type="button"
              disabled={isThinking}
              className="mt-3 inline-flex h-10 items-center justify-center rounded-[8px] bg-text-primary px-4 text-sm font-semibold text-bg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={onConfirmPrototype}
            >
              {isThinking ? 'Preparing prompt...' : 'Prepare test prompt'}
            </button>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="flex items-end gap-3">
          <textarea
            value={inputValue}
            onChange={(event) => onInputChange(event.target.value)}
            placeholder={VIDEO_AGENT_COPY.chat.inputPlaceholder}
            disabled={isThinking}
            className="min-h-[58px] max-h-[120px] min-w-0 flex-1 resize-none rounded-[8px] border border-border bg-bg px-4 py-3 text-sm leading-5 text-text-primary outline-none transition placeholder:text-text-muted focus:border-text-primary"
          />
          <button
            type="submit"
            disabled={isThinking}
            className="inline-flex h-12 w-12 items-center justify-center rounded-[8px] bg-text-primary text-bg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Send message"
          >
            <Send className="h-5 w-5" />
          </button>
        </form>

        <div className="mt-3 flex flex-wrap gap-2">
          {VIDEO_AGENT_COPY.chat.quickPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              disabled={isThinking}
              className="rounded-[8px] border border-border bg-bg px-3 py-2 text-xs font-medium text-text-secondary transition hover:border-text-muted hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => onSendMessage(prompt)}
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
