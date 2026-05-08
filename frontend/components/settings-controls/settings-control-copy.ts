export const DEFAULT_CONTROLS_COPY = {
  core: {
    title: 'Core settings',
    subtitle: 'Duration, Aspect, Resolution',
    audioIncluded: 'Audio included in every render',
  },
  frames: {
    label: 'Frames',
    options: 'Options: {options}',
    unit: '{count} frames',
    hint: 'Frames control clip length; values are forwarded without converting to seconds.',
  },
  duration: {
    optionsLabel: 'Duration',
    maxLabel: 'Max {seconds}s',
    rangeLabel: 'Duration — seconds',
    rangeHint: 'Min {min}s · Max {max}s',
    managed: 'Duration is managed directly by this engine.',
  },
  resolution: {
    label: 'Resolution',
    auto: 'Auto',
    hd: '• HD',
    fullHd: '• Full HD',
    ultraHd: '• Ultra HD',
    proSuffix: '• Pro',
  },
  aspect: {
    label: 'Aspect',
    options: {
      auto: 'Auto',
      source: 'Source',
      custom: 'Custom',
    },
  },
  iterationsLabel: 'Iterations',
  loop: {
    label: 'Loop',
    on: 'On',
    off: 'Off',
  },
  audio: {
    label: 'Audio',
    on: 'On',
    off: 'Off',
  },
  advancedTitle: 'Advanced settings',
  seed: {
    label: 'Seed',
    placeholder: 'Random',
    lock: 'Lock seed',
  },
  fpsSuffix: '{value} fps',
  promptStrength: 'Prompt strength',
  guidance: 'Guidance',
  inputInfluence: 'Input influence',
  cfgScale: 'Cfg scale',
  extend: {
    label: 'Extend',
    action: 'Extend by',
    unit: 'seconds',
  },
  keyframes: 'Keyframes supported (Pika 2.2)',
} as const;

export type SettingsControlsCopy = typeof DEFAULT_CONTROLS_COPY;

export function mergeControlsCopy(source?: Partial<SettingsControlsCopy>) {
  return {
    ...DEFAULT_CONTROLS_COPY,
    ...source,
    core: { ...DEFAULT_CONTROLS_COPY.core, ...(source?.core ?? {}) },
    frames: { ...DEFAULT_CONTROLS_COPY.frames, ...(source?.frames ?? {}) },
    duration: { ...DEFAULT_CONTROLS_COPY.duration, ...(source?.duration ?? {}) },
    resolution: { ...DEFAULT_CONTROLS_COPY.resolution, ...(source?.resolution ?? {}) },
    aspect: {
      ...DEFAULT_CONTROLS_COPY.aspect,
      ...(source?.aspect ?? {}),
      options: {
        ...DEFAULT_CONTROLS_COPY.aspect.options,
        ...(source?.aspect?.options ?? {}),
      },
    },
    loop: { ...DEFAULT_CONTROLS_COPY.loop, ...(source?.loop ?? {}) },
    audio: { ...DEFAULT_CONTROLS_COPY.audio, ...(source?.audio ?? {}) },
    seed: { ...DEFAULT_CONTROLS_COPY.seed, ...(source?.seed ?? {}) },
    extend: { ...DEFAULT_CONTROLS_COPY.extend, ...(source?.extend ?? {}) },
  } as SettingsControlsCopy;
}
