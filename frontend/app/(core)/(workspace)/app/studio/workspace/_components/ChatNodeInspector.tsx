'use client';

import { Send } from 'lucide-react';
import { getDefaultStudioChatModel, getStudioChatModels, resolveStudioChatModel } from '@/lib/studio-chat-models';
import { FieldLabel, SelectControl } from './NodeInspectorControls';
import baseStyles from '../maxvideoai-editor.module.css';
import inspectorStyles from '../_styles/inspector.module.css';
import type { WorkspaceChatSettings, WorkspaceGraphNode } from '../_lib/workspace-types';
import type { StudioCopy } from '../../_lib/studio-copy';

const styles = { ...baseStyles, ...inspectorStyles };

type ChatNodeInspectorProps = {
  copy: StudioCopy['canvas']['nodes'];
  node: WorkspaceGraphNode;
  onPatchNodeData: (nodeId: string, patch: Partial<WorkspaceGraphNode['data']>) => void;
  onRunChat: (nodeId: string) => void;
};

function patchChat(chat: WorkspaceChatSettings | undefined, patch: Partial<WorkspaceChatSettings>): WorkspaceChatSettings {
  const provider = patch.provider ?? chat?.provider ?? 'openai';
  const model = resolveStudioChatModel(provider, patch.modelId ?? chat?.modelId);
  return {
    mode: chat?.mode ?? 'assistant',
    botName: chat?.botName ?? 'Studio assistant',
    systemPrompt: chat?.systemPrompt ?? '',
    draftMessage: chat?.draftMessage ?? '',
    messages: chat?.messages ?? [],
    status: chat?.status ?? 'idle',
    ...patch,
    provider,
    modelId: model.modelId,
  };
}

export function ChatNodeInspector({ copy, node, onPatchNodeData, onRunChat }: ChatNodeInspectorProps) {
  const chat = patchChat(node.data.chat, {});
  const chatModels = getStudioChatModels(chat.provider);
  return (
    <>
      <FieldLabel>
        {copy.chatMode}
        <SelectControl
          value={chat.mode}
          onChange={(value) => onPatchNodeData(node.id, {
            chat: patchChat(chat, { mode: value === 'chatbot' ? 'chatbot' : 'assistant' }),
          })}
        >
          <option value="assistant">{copy.llmBlockMode}</option>
          <option value="chatbot">{copy.chatbotMode}</option>
        </SelectControl>
      </FieldLabel>
      <FieldLabel>
        {copy.chatbotName}
        <input
          className={styles.settingsInput}
          value={chat.botName}
          placeholder={copy.chatbotNamePlaceholder}
          onChange={(event) => onPatchNodeData(node.id, { chat: patchChat(chat, { botName: event.currentTarget.value }) })}
        />
      </FieldLabel>
      <FieldLabel>
        {copy.provider}
        <SelectControl
          value={chat.provider}
          onChange={(value) => onPatchNodeData(node.id, {
            chat: patchChat(chat, {
              provider: value === 'gemini' ? 'gemini' : 'openai',
              modelId: getDefaultStudioChatModel(value === 'gemini' ? 'gemini' : 'openai').modelId,
            }),
          })}
        >
          <option value="openai">OpenAI</option>
          <option value="gemini">Gemini</option>
        </SelectControl>
      </FieldLabel>
      <FieldLabel>
        {copy.model}
        <SelectControl
          value={chat.modelId}
          onChange={(value) => onPatchNodeData(node.id, { chat: patchChat(chat, { modelId: value }) })}
        >
          {chatModels.map((model) => (
            <option key={model.modelId} value={model.modelId}>
              {model.label}
            </option>
          ))}
        </SelectControl>
      </FieldLabel>
      <FieldLabel>
        {copy.systemPrompt}
        <textarea
          className={styles.settingsTextarea}
          rows={4}
          value={chat.systemPrompt}
          onChange={(event) => onPatchNodeData(node.id, { chat: patchChat(chat, { systemPrompt: event.currentTarget.value }) })}
        />
      </FieldLabel>
      <FieldLabel>
        {copy.message}
        <textarea
          className={styles.settingsTextarea}
          rows={6}
          value={chat.draftMessage}
          onChange={(event) => onPatchNodeData(node.id, {
            chat: patchChat(chat, {
              draftMessage: event.currentTarget.value,
            }),
            promptText: event.currentTarget.value,
          })}
        />
      </FieldLabel>
      <button
        type="button"
        className={styles.primaryPanelButton}
        disabled={!chat.draftMessage.trim() || chat.status === 'running'}
        onClick={() => onRunChat(node.id)}
      >
        <Send size={15} />
        {chat.status === 'running' ? copy.running : copy.send}
      </button>
      <div className={styles.connectedList} aria-label="Full chat transcript">
        {chat.messages.length ? chat.messages.map((message) => (
          <div key={message.id} className={styles.connectedRow}>
            <span />
            <p>{message.role}</p>
            <small>{message.content}</small>
          </div>
        )) : (
          <div className={styles.connectedRow}>
            <span />
            <p>{copy.messages}</p>
            <small>{copy.emptyChat}</small>
          </div>
        )}
      </div>
    </>
  );
}
