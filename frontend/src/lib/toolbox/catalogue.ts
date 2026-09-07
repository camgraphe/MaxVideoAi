/** Product identities, never provider routing or commercial policy. */
export type ToolMediaKind = 'image' | 'video' | 'audio';
export type ToolId = 'upscale' | 'background-removal' | 'character-builder' | 'storyboard' | 'angle';
export type ToolDefinition = {
  id: ToolId;
  version: 1;
  group: 'quick' | 'workshop';
  inputKinds: readonly ToolMediaKind[];
  outputKinds: readonly ToolMediaKind[];
  minInputs: number;
  maxInputs: number;
  href: string;
  studio: 'existing-adapter' | 'standalone';
  mcpExecution: false;
};

export const TOOLBOX: readonly ToolDefinition[] = [
  { id: 'upscale', version: 1, group: 'quick', inputKinds: ['image', 'video'], outputKinds: ['image', 'video'], minInputs: 1, maxInputs: 1, href: '/app/tools/upscale', studio: 'existing-adapter', mcpExecution: false },
  { id: 'background-removal', version: 1, group: 'quick', inputKinds: ['video'], outputKinds: ['video'], minInputs: 1, maxInputs: 1, href: '/app/tools/background-removal', studio: 'standalone', mcpExecution: false },
  { id: 'character-builder', version: 1, group: 'workshop', inputKinds: ['image'], outputKinds: ['image'], minInputs: 0, maxInputs: 2, href: '/app/tools/character-builder', studio: 'existing-adapter', mcpExecution: false },
  { id: 'storyboard', version: 1, group: 'workshop', inputKinds: ['image'], outputKinds: ['image'], minInputs: 0, maxInputs: 1, href: '/app/tools/storyboard', studio: 'standalone', mcpExecution: false },
  { id: 'angle', version: 1, group: 'workshop', inputKinds: ['image'], outputKinds: ['image'], minInputs: 1, maxInputs: 1, href: '/app/tools/angle', studio: 'existing-adapter', mcpExecution: false },
];

export function getToolDefinition(id: string): ToolDefinition | undefined {
  return TOOLBOX.find((tool) => tool.id === id);
}

export function toolsForMedia(kind?: ToolMediaKind): readonly ToolDefinition[] {
  return kind ? TOOLBOX.filter((tool) => tool.inputKinds.includes(kind)) : TOOLBOX;
}

/** Qualification backlog: excluded from discovery and all executable adapters. */
export const TOOLBOX_CANDIDATES = [
  { id: 'denoise', inputKind: 'video', controls: ['strength'], gate: 'fidelity-temporal-audio-cost' },
  { id: 'fix-blur', inputKind: 'video', controls: ['blurType'], gate: 'faces-text-motion-cost' },
  { id: 'smooth-motion', inputKind: 'video', controls: ['outputFps'], gate: 'cadence-cuts-audio-cost' },
  { id: 'clean-audio', inputKind: 'audio', controls: ['noiseReduction'], gate: 'voice-music-timing-cost' },
] as const;
