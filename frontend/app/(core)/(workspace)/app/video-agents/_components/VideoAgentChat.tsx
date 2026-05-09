'use client';

import { FormEvent, useEffect, useRef } from 'react';
import { ImageIcon, Send, Sparkles } from 'lucide-react';
import { VIDEO_AGENT_COPY } from '../_lib/video-agent-copy';
import type { VideoAgentMessage } from '../_lib/video-agent-state';

type VideoAgentChatProps = {
  inputValue: string;
  messages: VideoAgentMessage[];
  onInputChange: (value: string) => void;
  onSendMessage: (value?: string) => void;
};

export function VideoAgentChat({
  inputValue,
  messages,
  onInputChange,
  onSendMessage,
}: VideoAgentChatProps) {
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const messagesElement = messagesRef.current;
    if (!messagesElement) return;
    messagesElement.scrollTop = messagesElement.scrollHeight;
  }, [messages.length]);

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
                  'rounded-[8px] px-4 py-3 text-sm leading-6',
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
      </div>

      <div className="shrink-0 border-t border-border p-4">
        <button
          type="button"
          className="mb-3 inline-flex h-10 items-center gap-2 rounded-[8px] border border-dashed border-border px-4 text-sm text-text-secondary transition hover:border-text-muted hover:text-text-primary"
        >
          <ImageIcon className="h-4 w-4" />
          {VIDEO_AGENT_COPY.chat.productImage}
        </button>

        <form onSubmit={handleSubmit} className="flex items-center gap-3">
          <input
            value={inputValue}
            onChange={(event) => onInputChange(event.target.value)}
            placeholder={VIDEO_AGENT_COPY.chat.inputPlaceholder}
            className="min-h-[52px] min-w-0 flex-1 rounded-[8px] border border-border bg-bg px-4 text-sm text-text-primary outline-none transition placeholder:text-text-muted focus:border-text-primary"
          />
          <button
            type="submit"
            className="inline-flex h-12 w-12 items-center justify-center rounded-[8px] bg-text-primary text-bg transition hover:opacity-90"
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
              className="rounded-[8px] border border-border bg-bg px-3 py-2 text-xs font-medium text-text-secondary transition hover:border-text-muted hover:text-text-primary"
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
