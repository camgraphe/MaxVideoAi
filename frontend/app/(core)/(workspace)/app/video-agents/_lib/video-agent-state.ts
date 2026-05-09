import type { VideoAgentSettings } from './video-agent-config';

export type VideoAgentMessage = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  createdAtLabel: string;
};

export type VideoAgentFlowState = {
  settings: VideoAgentSettings;
  messages: VideoAgentMessage[];
  inputValue: string;
};

export function createVideoAgentMessage(role: VideoAgentMessage['role'], text: string): VideoAgentMessage {
  return {
    id: `${role}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    role,
    text,
    createdAtLabel: new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date()),
  };
}
