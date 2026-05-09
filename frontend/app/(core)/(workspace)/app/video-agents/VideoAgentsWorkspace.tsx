'use client';

import { VideoAgentChat } from './_components/VideoAgentChat';
import { VideoAgentPreview } from './_components/VideoAgentPreview';
import { VideoAgentSettingsStrip } from './_components/VideoAgentSettingsStrip';
import { useVideoAgentFlow } from './_hooks/useVideoAgentFlow';
import { VIDEO_AGENT_COPY } from './_lib/video-agent-copy';

export default function VideoAgentsWorkspace() {
  const agent = useVideoAgentFlow();

  return (
    <main className="min-w-0 flex-1 overflow-y-auto bg-bg px-4 py-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Video Agents</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-text-primary">
              {VIDEO_AGENT_COPY.title}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-text-secondary">{VIDEO_AGENT_COPY.subtitle}</p>
          </div>
          <div className="w-full lg:max-w-4xl">
            <VideoAgentSettingsStrip
              estimatedPriceCents={agent.estimatedPriceCents}
              preset={agent.preset}
              settings={agent.settings}
              onAspectRatioChange={agent.updateAspectRatio}
              onDurationChange={agent.updateDuration}
              onResolutionChange={agent.updateResolution}
              onToggleAudio={agent.toggleAudio}
            />
          </div>
        </header>

        <div className="grid gap-4 xl:grid-cols-[minmax(360px,0.85fr)_minmax(420px,1.15fr)]">
          <VideoAgentChat
            confirmation={agent.confirmation}
            phase={agent.phase}
            inputValue={agent.inputValue}
            isThinking={agent.isThinking}
            messages={agent.messages}
            onConfirmPrototype={agent.confirmPrototype}
            onInputChange={agent.setInputValue}
            onSendMessage={agent.sendMessage}
          />
          <VideoAgentPreview
            confirmation={agent.confirmation}
            phase={agent.phase}
            preset={agent.preset}
            prototypeResult={agent.prototypeResult}
            settings={agent.settings}
          />
        </div>
      </div>
    </main>
  );
}
