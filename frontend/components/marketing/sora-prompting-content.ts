export const DEFAULT_GUIDE_URL =
  'https://developers.openai.com/cookbook/examples/sora/sora2_prompting_guide/';

export type TabId = 'quick' | 'structured' | 'pro' | 'storyboard';
export type PromptingMode = 'video' | 'image';
export type PromptingTabNotes = Partial<Record<TabId, string>>;

export type PromptingTab = {
  id: TabId;
  label: string;
  title: string;
  description?: string;
  copy: string;
};

export type SoraPromptingTabsProps = {
  title?: string;
  intro?: string;
  tip?: string;
  guideLabel?: string;
  guideUrl?: string | null;
  mode?: PromptingMode;
  supportsAudio?: boolean;
  tabs?: PromptingTab[];
  globalPrinciples?: string[];
  engineWhy?: string[];
  tabNotes?: PromptingTabNotes;
};

export const DEFAULT_GLOBAL_PRINCIPLES = [
  '1 shot = 1 camera move + 1 subject action',
  'Use visual anchors (specific nouns > vague adjectives)',
  'Iterate: change one thing at a time',
];

export const DEFAULT_ENGINE_WHY = [
  'Keep prompts focused: one subject, one action, one camera move.',
  'Use concrete visual anchors (props, textures, lighting cues).',
  'Iterate by changing a single variable per take.',
];

export const DEFAULT_TAB_NOTES: Record<TabId, string> = {
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

const STRUCTURED_TEMPLATE_NO_AUDIO = `Scene (plain language):
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

Constraints:
No logos, no readable text, no subtitles/overlays.`;

const QUICK_TEMPLATE =
  '[Style] + [Subject doing 1 clear action] + [Where] + [Camera move] + [Lighting] + [Sound cue]';

const QUICK_TEMPLATE_NO_AUDIO =
  '[Style] + [Subject doing 1 clear action] + [Where] + [Camera move] + [Lighting] + [Ending / visual payoff]';

export const QUICK_EXAMPLE =
  'Handheld smartphone UGC clip of a woman unboxing a new skincare bottle at a kitchen table. She peels the seal, smiles, and turns the bottle toward camera. Soft window daylight, natural colors, subtle room tone + packaging crinkle.';

export const QUICK_EXAMPLE_NO_AUDIO =
  'Handheld smartphone UGC clip of a woman unboxing a new skincare bottle at a kitchen table. She peels the seal, smiles, and turns the bottle toward camera. Soft window daylight, natural colors, clean kitchen background, product label held readable in the final beat.';

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

const PRO_TEMPLATE_NO_AUDIO = `Project / intent:
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

const STORYBOARD_TEMPLATE_NO_AUDIO = `Storyboard / shot list prompt
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

Constraints:
No logos. No readable text. No subtitles/overlays. No jump cuts. No slow-motion.`;

export const VIDEO_TABS: PromptingTab[] = [
  {
    id: 'quick',
    label: 'Quick',
    title: 'Quick prompt (fast iteration)',
    description: 'Use 1–2 sentences when you want variations.',
    copy: QUICK_TEMPLATE,
  },
  {
    id: 'structured',
    label: 'Structured',
    title: 'Structured prompt (best for reliable results)',
    description: 'Separate information so the model can follow it consistently.',
    copy: STRUCTURED_TEMPLATE,
  },
  {
    id: 'pro',
    label: 'Pro',
    title: 'Pro prompt (ultra-specific "film crew brief")',
    description: 'Use this when you need a very specific cinematic look or continuity across shots.',
    copy: PRO_TEMPLATE,
  },
  {
    id: 'storyboard',
    label: 'Storyboard',
    title: 'Storyboard prompt (multi-shot / shot list)',
    description:
      'Use this when you want a mini-story in one clip. A storyboard prompt (aka multi-shot / shot list prompt) gives Sora clear timing, camera direction, and continuity. Also called shot-list or sequenced prompts.',
    copy: STORYBOARD_TEMPLATE,
  },
];

export const VIDEO_TABS_NO_AUDIO: PromptingTab[] = [
  {
    id: 'quick',
    label: 'Quick',
    title: 'Quick prompt (fast iteration)',
    description: 'Use 1–2 sentences when you want variations.',
    copy: QUICK_TEMPLATE_NO_AUDIO,
  },
  {
    id: 'structured',
    label: 'Structured',
    title: 'Structured prompt (best for reliable results)',
    description: 'Separate information so the model can follow it consistently.',
    copy: STRUCTURED_TEMPLATE_NO_AUDIO,
  },
  {
    id: 'pro',
    label: 'Pro',
    title: 'Pro prompt (ultra-specific "film crew brief")',
    description: 'Use this when you need a very specific cinematic look or continuity across shots.',
    copy: PRO_TEMPLATE_NO_AUDIO,
  },
  {
    id: 'storyboard',
    label: 'Storyboard',
    title: 'Storyboard prompt (multi-shot / shot list)',
    description:
      'Use this when you want a mini-story in one clip. A storyboard prompt (aka multi-shot / shot list prompt) gives clear timing, camera direction, and continuity. Also called shot-list or sequenced prompts.',
    copy: STORYBOARD_TEMPLATE_NO_AUDIO,
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

export const IMAGE_TABS: PromptingTab[] = [
  {
    id: 'quick',
    label: 'Quick',
    title: 'Quick prompt (fast iteration)',
    description: 'Use 1–2 sentences when you want variations.',
    copy: IMAGE_QUICK_TEMPLATE,
  },
  {
    id: 'structured',
    label: 'Structured',
    title: 'Structured prompt (best for reliable results)',
    description: 'Separate information so the model can follow it consistently.',
    copy: IMAGE_STRUCTURED_TEMPLATE,
  },
  {
    id: 'pro',
    label: 'Pro',
    title: 'Pro prompt (ultra-specific "studio brief")',
    description: 'Use this when you need a very specific look or continuity across shots.',
    copy: IMAGE_PRO_TEMPLATE,
  },
];

export function buildPanelId(id: TabId) {
  return `prompting-panel-${id}`;
}

export function buildTabId(id: TabId) {
  return `prompting-tab-${id}`;
}
