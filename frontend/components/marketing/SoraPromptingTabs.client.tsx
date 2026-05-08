'use client';

import { useState } from 'react';
import { SoraPromptingSidebar } from '@/components/marketing/SoraPromptingSidebar';
import { SoraPromptingTabList } from '@/components/marketing/SoraPromptingTabList';
import { SoraPromptingTabPanel } from '@/components/marketing/SoraPromptingTabPanel';
import {
  DEFAULT_ENGINE_WHY,
  DEFAULT_GLOBAL_PRINCIPLES,
  DEFAULT_GUIDE_URL,
  DEFAULT_TAB_NOTES,
  IMAGE_TABS,
  VIDEO_TABS,
  VIDEO_TABS_NO_AUDIO,
  type SoraPromptingTabsProps,
  type TabId,
} from '@/components/marketing/sora-prompting-content';

export function SoraPromptingTabs({
  title,
  intro,
  tip,
  guideLabel,
  guideUrl,
  mode = 'video',
  supportsAudio = true,
  tabs,
  globalPrinciples,
  engineWhy,
  tabNotes,
}: SoraPromptingTabsProps) {
  const [activeId, setActiveId] = useState<TabId>('quick');
  const mergedTabNotes: Record<TabId, string> = {
    ...DEFAULT_TAB_NOTES,
    ...(tabNotes ?? {}),
  };
  const resolvedTabs = (
    tabs && tabs.length
      ? tabs
      : mode === 'image'
        ? IMAGE_TABS
        : supportsAudio
          ? VIDEO_TABS
          : VIDEO_TABS_NO_AUDIO
  ).filter(Boolean);
  const globalRules = globalPrinciples?.length ? globalPrinciples : DEFAULT_GLOBAL_PRINCIPLES;
  const engineRules = engineWhy?.length ? engineWhy : DEFAULT_ENGINE_WHY;
  const resolvedTitle =
    title ?? (mode === 'image' ? 'How to Write a Great Image Prompt' : 'How to Write a Great Video Prompt');
  const resolvedIntro =
    intro ??
    (mode === 'image'
      ? 'Describe the subject, composition, lighting, and style in clear, concrete terms.'
      : 'Works best when you brief it like a cinematographer: one clear shot, simple timing, and visible actions.');
  const resolvedTip =
    tip ??
    (mode === 'image'
      ? 'Tip: resolution + aspect ratio are set in the UI — your prompt controls subject, composition, lighting, style, and mood.'
      : supportsAudio
        ? 'Tip: duration + aspect ratio are set in the UI — your prompt controls subject, action, camera, lighting, style, and sound.'
        : 'Tip: duration + aspect ratio are set in the UI — your prompt controls subject, action, camera, lighting, style, and the visual ending.');
  const resolvedGuideUrl = guideUrl === null ? undefined : guideUrl ?? (mode === 'video' ? DEFAULT_GUIDE_URL : undefined);
  const resolvedGuideLabel = resolvedGuideUrl ? guideLabel ?? (mode === 'video' ? 'Developers guide' : 'Learn more') : undefined;

  return (
    <div className="stack-gap">
      <div className="stack-gap-sm text-center">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <h2 className="text-2xl font-semibold text-text-primary sm:text-3xl">{resolvedTitle}</h2>
          {resolvedGuideUrl ? (
            <a
              href={resolvedGuideUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold uppercase tracking-micro text-text-muted hover:text-text-primary"
            >
              {resolvedGuideLabel ?? 'Learn more'}
            </a>
          ) : null}
        </div>
        {resolvedIntro ? <p className="text-base leading-relaxed text-text-secondary">{resolvedIntro}</p> : null}
        {resolvedTip ? <p className="text-sm text-text-secondary">{resolvedTip}</p> : null}
      </div>

      <SoraPromptingTabList activeId={activeId} tabs={resolvedTabs} onActiveIdChange={setActiveId} />

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          {resolvedTabs.map((tab) => (
            <SoraPromptingTabPanel
              key={tab.id}
              activeId={activeId}
              mode={mode}
              note={mergedTabNotes[tab.id]}
              supportsAudio={supportsAudio}
              tab={tab}
            />
          ))}
        </div>

        <SoraPromptingSidebar engineRules={engineRules} globalRules={globalRules} />
      </div>

      <div className="mt-8 border-t border-hairline" />
    </div>
  );
}
