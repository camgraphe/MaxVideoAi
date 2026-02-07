'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { Button } from '@/components/ui/Button';
import { CopyPromptButton } from '@/components/CopyPromptButton';

const DEFAULT_GUIDE_URL =
  'https://developers.openai.com/cookbook/examples/sora/sora2_prompting_guide/';

type TabId = 'quick' | 'structured' | 'pro' | 'storyboard';
type PromptingMode = 'video' | 'image';

const DEFAULT_GLOBAL_PRINCIPLES = [
  '1 shot = 1 camera move + 1 subject action',
  'Use visual anchors (specific nouns > vague adjectives)',
  'Iterate: change one thing at a time',
];

const DEFAULT_ENGINE_WHY = [
  'Keep prompts focused: one subject, one action, one camera move.',
  'Use concrete visual anchors (props, textures, lighting cues).',
  'Iterate by changing a single variable per take.',
];

const DEFAULT_TAB_NOTES: Record<TabId, string> = {
  quick: 'Quick = variations. Use for fast iteration.',
  structured: 'Structured = consistency. Use when you need reliable results.',
  pro: 'Pro = continuity. Use for precise, repeatable looks.',
  storyboard: 'Storyboard = beat timing. Use for mini-stories in one clip.',
};

const STRUCTURED_TEMPLATE = `Scene (plain language):
[Subject + setting + props + time of day. Add 2–3 distinctive visual anchors.]

Cinematography:
- Camera shot: [wide / medium / close-up, angle]
- Camera motion: [slow push-in / handheld / pan / tracking]
- Lens look + depth of field: [e.g., 35mm, shallow DOF]
- Lighting + palette: [key light + 3 palette anchors]

Actions (beats):
- [Beat 1: a small, visible action]
- [Beat 2: another clear beat]
- [Beat 3: a final beat in the last second]

Dialogue (optional):
[Keep lines short so they fit the clip length.]

Background sound:
[One sentence: ambience + key SFX. Keep it simple.]

Constraints:
No logos, no readable text, no subtitles/overlays.`;

const QUICK_TEMPLATE =
  '[Style] + [Subject doing 1 clear action] + [Where] + [Camera move] + [Lighting] + [Sound cue]';

const QUICK_EXAMPLE =
  'Handheld smartphone UGC clip of a woman unboxing a new skincare bottle at a kitchen table. She peels the seal, smiles, and turns the bottle toward camera. Soft window daylight, natural colors, subtle room tone + packaging crinkle.';

const PRO_TEMPLATE = `Project / intent:
[One-line goal. What should the viewer feel/understand?]

Subject:
[Who/what. Wardrobe/materials. 2-3 distinctive traits.]

Location / set:
[Where + time of day + weather. Add 3 visual anchors (specific nouns).]

Cinematography:
- Framing: [wide / medium / close-up] + [angle]
- Lens feel + depth of field: [e.g., 35mm natural, shallow DOF]
- Camera movement: [ONE move: slow dolly-in / handheld / pan / tracking]
- Composition: [centered / rule of thirds / negative space]
- Look (optional): [clean digital / subtle film grain / soft bloom]

Lighting & color grade:
- Key light: [soft window / golden hour / neon practicals / studio key]
- Contrast: [low / medium / high]
- Palette anchors: [3-5 anchors: "warm sunrise, teal shadows, amber highlights"]

Action (timed beats):
- Beat 1 (start): [visible action + camera behavior]
- Beat 2 (middle): [visible action + camera behavior]
- Beat 3 (end): [final action + end pose / reveal]

Sound (if supported):
- Ambience: [one line]
- SFX cues: [1-3 cues]
- Music (optional): [genre + intensity]

Constraints:
No logos. No readable text. No subtitles/overlays. No slow-motion. No jump cuts.`;

const STORYBOARD_TEMPLATE = `Storyboard / shot list prompt
Duration: [4/8/12s] • Aspect: [16:9 or 9:16]

Scene + continuity:
[Same subject + same location + same wardrobe/props + same lighting throughout.]

Shot 1 (0–2s):
[Framing + subject action + camera move]

Shot 2 (2–6s):
[Framing + subject action + camera move]

Shot 3 (6–8/12s):
[Framing + final action/reveal + camera move or settle]

Lighting + mood:
[Golden hour / soft daylight / neon night… + 2–3 palette anchors]

Sound (if supported):
[Ambience + 1–2 SFX cues + optional music vibe]

Constraints:
No logos. No readable text. No subtitles/overlays. No jump cuts. No slow-motion.`;


const VIDEO_TABS = [
  {
    id: 'quick' as TabId,
    label: 'Quick',
    title: 'Quick prompt (fast iteration)',
    description: 'Use 1–2 sentences when you want variations.',
    copy: QUICK_TEMPLATE,
  },
  {
    id: 'structured' as TabId,
    label: 'Structured',
    title: 'Structured prompt (best for reliable results)',
    description: 'Separate information so the model can follow it consistently.',
    copy: STRUCTURED_TEMPLATE,
  },
  {
    id: 'pro' as TabId,
    label: 'Pro',
    title: 'Pro prompt (ultra-specific "film crew brief")',
    description: 'Use this when you need a very specific cinematic look or continuity across shots.',
    copy: PRO_TEMPLATE,
  },
  {
    id: 'storyboard' as TabId,
    label: 'Storyboard',
    title: 'Storyboard prompt (multi-shot / shot list)',
    description:
      'Use this when you want a mini-story in one clip. A storyboard prompt (aka multi-shot / shot list prompt) gives Sora clear timing, camera direction, and continuity. Also called shot-list or sequenced prompts.',
    copy: STORYBOARD_TEMPLATE,
  },
];

const IMAGE_QUICK_TEMPLATE =
  '[Style] + [Subject] + [Setting] + [Lighting] + [Mood / palette]';

const IMAGE_STRUCTURED_TEMPLATE = `Subject:
[Who/what + 1 clear action or pose.]

Setting:
[Where + time of day + 2–3 visual anchors.]

Composition:
- Framing: [wide / medium / close-up]
- Angle: [eye-level / low / high]
- Lens feel: [e.g., 35mm natural, shallow DOF]

Lighting + palette:
[Key light + 2–3 palette anchors]

Style constraints:
No logos. No readable text. Clean background.`;

const IMAGE_PRO_TEMPLATE = `Project / intent:
[One-line goal for the still.]

Subject:
[Who/what + wardrobe/materials + 2–3 distinctive traits.]

Location / set:
[Where + time of day + weather. Add 3 visual anchors.]

Composition:
- Framing + angle
- Lens feel + depth of field
- Look: [clean digital / subtle film grain / soft bloom]

Lighting & grade:
- Key light
- Contrast
- Palette anchors (3–5)

Constraints:
No logos. No readable text. No overlays.`;

const IMAGE_TABS = [
  {
    id: 'quick' as TabId,
    label: 'Quick',
    title: 'Quick prompt (fast iteration)',
    description: 'Use 1–2 sentences when you want variations.',
    copy: IMAGE_QUICK_TEMPLATE,
  },
  {
    id: 'structured' as TabId,
    label: 'Structured',
    title: 'Structured prompt (best for reliable results)',
    description: 'Separate information so the model can follow it consistently.',
    copy: IMAGE_STRUCTURED_TEMPLATE,
  },
  {
    id: 'pro' as TabId,
    label: 'Pro',
    title: 'Pro prompt (ultra-specific "studio brief")',
    description: 'Use this when you need a very specific look or continuity across shots.',
    copy: IMAGE_PRO_TEMPLATE,
  },
];

function buildPanelId(id: TabId) {
  return `prompting-panel-${id}`;
}

function buildTabId(id: TabId) {
  return `prompting-tab-${id}`;
}

type PromptingTabNotes = Partial<Record<TabId, string>>;

type PromptingTab = {
  id: TabId;
  label: string;
  title: string;
  description?: string;
  copy: string;
};

type SoraPromptingTabsProps = {
  title?: string;
  intro?: string;
  tip?: string;
  guideLabel?: string;
  guideUrl?: string;
  mode?: PromptingMode;
  tabs?: PromptingTab[];
  globalPrinciples?: string[];
  engineWhy?: string[];
  tabNotes?: PromptingTabNotes;
};

export function SoraPromptingTabs({
  title,
  intro,
  tip,
  guideLabel,
  guideUrl,
  mode = 'video',
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
  const resolvedTabs = (tabs && tabs.length ? tabs : mode === 'image' ? IMAGE_TABS : VIDEO_TABS).filter(Boolean);
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
      : 'Tip: duration + aspect ratio are set in the UI — your prompt controls subject, action, camera, lighting, style, and sound.');
  const resolvedGuideUrl = guideUrl === null ? undefined : guideUrl ?? (mode === 'video' ? DEFAULT_GUIDE_URL : undefined);
  const resolvedGuideLabel =
    resolvedGuideUrl
      ? guideLabel ?? (mode === 'video' ? 'Developers guide' : 'Learn more')
      : undefined;

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

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Prompt levels">
        {resolvedTabs.map((tab) => {
          const isActive = tab.id === activeId;
          return (
            <Button
              key={tab.id}
              type="button"
              size="sm"
              variant={isActive ? 'primary' : 'outline'}
              onClick={() => setActiveId(tab.id)}
              className={clsx(
                'min-h-0 h-auto rounded-full px-4 py-2 text-sm font-semibold',
                isActive ? 'border border-brand' : 'border-hairline text-text-secondary hover:text-text-primary'
              )}
              role="tab"
              id={buildTabId(tab.id)}
              aria-selected={isActive}
              aria-controls={buildPanelId(tab.id)}
            >
              {tab.label}
            </Button>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          {resolvedTabs.map((tab) => {
            const isActive = tab.id === activeId;
            const note = mergedTabNotes[tab.id];
            return (
              <div
                key={tab.id}
                id={buildPanelId(tab.id)}
                role="tabpanel"
                aria-labelledby={buildTabId(tab.id)}
                aria-hidden={!isActive}
                hidden={!isActive}
              >
                <article className="stack-gap-sm rounded-2xl border border-hairline bg-surface/80 p-4 shadow-card">
                  <header className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h3 className="text-lg font-semibold text-text-primary">{tab.title}</h3>
                      {tab.description ? <p className="text-sm text-text-secondary">{tab.description}</p> : null}
                      {note ? <p className="text-xs text-text-muted">{note}</p> : null}
                    </div>
                    <CopyPromptButton prompt={tab.copy} copyLabel="Copy template" />
                  </header>

                  <div className="stack-gap-sm">
                    <div className="rounded-xl border border-dashed border-hairline bg-bg px-4 py-3 text-sm text-text-secondary">
                      <p className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">
                        Template (copy/paste)
                      </p>
                      <pre className="mt-2 whitespace-pre-wrap font-mono text-sm text-text-primary">{tab.copy}</pre>
                    </div>
                    {tab.id === 'quick' && mode === 'video' ? (
                      <div className="rounded-xl border border-hairline bg-surface-2 px-4 py-3 text-sm text-text-secondary">
                        <p className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">Example</p>
                        <p className="mt-2">{QUICK_EXAMPLE}</p>
                      </div>
                    ) : null}
                  </div>
                </article>
              </div>
            );
          })}
        </div>

        <aside className="lg:col-span-5">
          <div className="stack-gap-sm rounded-2xl border border-hairline bg-surface/80 p-4 shadow-card">
            <h4 className="text-sm font-semibold text-text-primary">Global principles</h4>
            <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
              {globalRules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </div>
          <div className="stack-gap-sm rounded-2xl border border-hairline bg-surface/80 p-4 shadow-card">
            <h4 className="text-sm font-semibold text-text-primary">Engine quirks / what to watch for</h4>
            <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
              {engineRules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      <div className="mt-8 border-t border-hairline" />
    </div>
  );
}
