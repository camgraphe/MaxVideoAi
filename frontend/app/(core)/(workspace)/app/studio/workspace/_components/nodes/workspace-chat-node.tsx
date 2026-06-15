'use client';

import type { NodeProps } from '@xyflow/react';
import type { FormEvent, KeyboardEvent, SyntheticEvent } from 'react';
import { Copy, MessageSquareText, RotateCcw, Send, Trash2 } from 'lucide-react';
import { NodeFrame } from './workspace-node-frame';
import chatStyles from '../../_styles/canvas-chat-node.module.css';
import styles from '../../_styles/canvas-nodes.module.css';
import type { WorkspaceChatMessage, WorkspaceGraphNode } from '../../_lib/workspace-types';

function nodeCopy(data: WorkspaceGraphNode['data']): NonNullable<WorkspaceGraphNode['data']['studioCanvasCopy']>['nodes'] | null {
  return data.studioCanvasCopy?.nodes ?? null;
}

function stopNodeInteraction(event: SyntheticEvent): void {
  event.stopPropagation();
}

function messageRoleLabel(message: WorkspaceChatMessage, copy: ReturnType<typeof nodeCopy>): string {
  if (message.role === 'assistant') return copy?.assistantLabel ?? 'Assistant';
  if (message.role === 'user') return copy?.userLabel ?? 'You';
  return copy?.systemPrompt ?? 'System prompt';
}

export function ChatNode(props: NodeProps<WorkspaceGraphNode>) {
  const copy = nodeCopy(props.data);
  const chat = props.data.chat;
  const messages = chat?.messages.filter((message) => message.role !== 'system') ?? [];
  const draft = chat?.draftMessage ?? props.data.promptText ?? '';
  const isChatbot = chat?.mode === 'chatbot';
  const isRunning = chat?.status === 'running';
  const canSend = Boolean(draft.trim()) && !isRunning;
  const botName = chat?.botName?.trim() || copy?.chatbotDefaultName || 'Studio assistant';
  const latestAssistantMessage = [...messages].reverse().find((message) => message.role === 'assistant');
  const latestUserMessage = [...messages].reverse().find((message) => message.role === 'user');
  const canCopyAnswer = Boolean(latestAssistantMessage?.content);
  const canReuseUserMessage = Boolean(latestUserMessage?.content) && !isRunning;
  const canClearChat = Boolean(chat?.messages.length) && !isRunning;

  const handleDraftChange = (value: string): void => {
    props.data.onChatDraftChange?.(props.id, value);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    if (!canSend) return;
    props.data.onRunChat?.(props.id);
  };

  const handleDraftKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    event.stopPropagation();
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      if (canSend) props.data.onRunChat?.(props.id);
    }
  };

  const handleCopyLastAnswer = (event: SyntheticEvent<HTMLButtonElement>): void => {
    stopNodeInteraction(event);
    const content = latestAssistantMessage?.content;
    if (!content) return;
    void navigator.clipboard.writeText(content);
  };

  const handleReuseLastMessage = (event: SyntheticEvent<HTMLButtonElement>): void => {
    stopNodeInteraction(event);
    const content = latestUserMessage?.content;
    if (!content) return;
    props.data.onChatDraftChange?.(props.id, content);
  };

  const handleClearChat = (event: SyntheticEvent<HTMLButtonElement>): void => {
    stopNodeInteraction(event);
    props.data.onPatchChat?.(props.id, {
      messages: [],
      status: 'idle',
    });
  };

  return (
    <NodeFrame nodeId={props.id} data={props.data} selected={props.selected} icon={<MessageSquareText size={14} />} className={styles.promptNode}>
      {isChatbot ? (
        <div
          className={`${chatStyles.chatbotPanel} nodrag`}
          onClick={stopNodeInteraction}
          onDoubleClick={stopNodeInteraction}
          onMouseDown={stopNodeInteraction}
          onPointerDown={stopNodeInteraction}
        >
          <div className={chatStyles.chatMessageList} aria-label={copy?.messages ?? 'messages'}>
            {messages.length ? messages.map((message) => (
              <article key={message.id} className={`${chatStyles.chatMessage} ${message.role === 'assistant' ? chatStyles.chatMessageAssistant : chatStyles.chatMessageUser}`}>
                <strong>{messageRoleLabel(message, copy)}</strong>
                <p>{message.content}</p>
              </article>
            )) : (
              <p className={chatStyles.chatEmpty}>{copy?.emptyChat ?? 'Start a conversation from this block.'}</p>
            )}
          </div>
          <div className={chatStyles.chatUtilityBar}>
            <button
              type="button"
              className={chatStyles.chatUtilityButton}
              disabled={!canCopyAnswer}
              aria-label={copy?.copyLastAnswer ?? 'Copy last answer'}
              onClick={handleCopyLastAnswer}
            >
              <Copy size={12} />
            </button>
            <button
              type="button"
              className={chatStyles.chatUtilityButton}
              disabled={!canReuseUserMessage}
              aria-label={copy?.reuseLastMessage ?? 'Reuse last message'}
              onClick={handleReuseLastMessage}
            >
              <RotateCcw size={12} />
            </button>
            <button
              type="button"
              className={chatStyles.chatUtilityButton}
              disabled={!canClearChat}
              aria-label={copy?.clearConversation ?? 'Clear conversation'}
              onClick={handleClearChat}
            >
              <Trash2 size={12} />
            </button>
          </div>
          <form className={chatStyles.chatComposer} onSubmit={handleSubmit}>
            <textarea
              className={chatStyles.chatInput}
              value={draft}
              rows={3}
              spellCheck={false}
              placeholder={copy?.chatInputPlaceholder ?? 'Ask the chatbot...'}
              aria-label={copy?.message ?? 'Message'}
              disabled={isRunning}
              onChange={(event) => handleDraftChange(event.currentTarget.value)}
              onKeyDown={handleDraftKeyDown}
            />
            <button type="submit" className={chatStyles.chatSendButton} disabled={!canSend} aria-label={copy?.send ?? 'Send'}>
              <Send size={13} />
            </button>
          </form>
        </div>
      ) : (
        <textarea
          className={`${styles.promptTextarea} nodrag`}
          value={draft}
          readOnly
          rows={4}
          spellCheck={false}
          aria-label={copy?.chatBox ?? 'Chat box'}
        />
      )}
      <div className={styles.nodeMetaRow}>
        <span>{isChatbot ? botName : chat?.provider === 'gemini' ? 'Gemini' : 'OpenAI'}</span>
        <span>{isRunning ? copy?.running ?? 'Running' : `${messages.length} ${copy?.messages ?? 'messages'}`}</span>
      </div>
    </NodeFrame>
  );
}
