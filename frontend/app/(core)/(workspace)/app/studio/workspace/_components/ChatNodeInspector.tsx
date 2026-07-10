'use client';

import { Send } from 'lucide-react';
import { getStudioChatModels, resolveStudioChatModel } from '@/lib/studio-chat-models';
import { FieldLabel, SelectControl } from './NodeInspectorControls';
import { WorkspaceControlField } from './nodes/WorkspaceControlField';
import baseStyles from '../maxvideoai-editor.module.css';
import inspectorStyles from '../_styles/inspector.module.css';
import type { WorkspaceChatSettings, WorkspaceGraphNode, WorkspaceShotSettings } from '../_lib/workspace-types';
import { resolveWorkspaceBlockPolicy } from '../_lib/models/workspace-block-capability-policy';
import type { StudioCopy } from '../../_lib/studio-copy';

const styles = { ...baseStyles, ...inspectorStyles };

const CHAT_POLICY_SETTINGS: WorkspaceShotSettings = {
  presetId: 'chat-box',
  family: 'chat',
  outputKind: 'text',
  modelId: 'studio-chat-openai',
  workflowType: 'chat_completion',
  durationSec: 1,
  aspectRatio: '16:9',
  resolution: '1080p',
  fps: 24,
  seed: null,
  audioEnabled: false,
  lipSyncEnabled: false,
  referenceStrength: 0.65,
  outputName: 'Chat output',
  status: 'draft',
};

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
  const policy = resolveWorkspaceBlockPolicy({
    settings: CHAT_POLICY_SETTINGS,
    capability: null,
    connectedInputs: ['prompt'],
  });
  const patchNodeChat = (patch: Partial<WorkspaceChatSettings>) => onPatchNodeData(node.id, { chat: patchChat(chat, patch) });
  const controlLabels = {
    chatProvider: copy.provider,
    chatModel: copy.model,
    chatSystemPrompt: copy.systemPrompt,
    chatMessage: copy.message,
  };
  return (
    <>
      <FieldLabel>
        {copy.chatMode}
        <SelectControl
          value={chat.mode}
          onChange={(value) => patchNodeChat({ mode: value === 'chatbot' ? 'chatbot' : 'assistant' })}
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
          onChange={(event) => patchNodeChat({ botName: event.currentTarget.value })}
        />
      </FieldLabel>
      {policy.controlFields.map((field) => (
        <WorkspaceControlField
          key={field}
          field={field}
          chat={chat}
          label={controlLabels[field as keyof typeof controlLabels]}
          chatModels={chatModels}
          variant="inspector"
          onPatchChat={patchNodeChat}
          onPatchPromptText={(promptText) => onPatchNodeData(node.id, { promptText })}
        />
      ))}
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
