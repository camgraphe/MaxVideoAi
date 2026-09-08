/** Product identities, never provider routing or commercial policy. */
export type ToolMediaKind = 'image' | 'video' | 'audio';
export type ToolId = 'upscale' | 'background-removal' | 'character-builder' | 'storyboard' | 'angle' | 'restore-video' | 'denoise' | 'fix-blur' | 'smooth-motion';
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
  qualificationRequired?: true;
};

export const TOOLBOX: readonly ToolDefinition[] = [
  { id: 'upscale', version: 1, group: 'quick', inputKinds: ['image', 'video'], outputKinds: ['image', 'video'], minInputs: 1, maxInputs: 1, href: '/app/tools/upscale', studio: 'existing-adapter', mcpExecution: false },
  { id: 'background-removal', version: 1, group: 'quick', inputKinds: ['video'], outputKinds: ['video'], minInputs: 1, maxInputs: 1, href: '/app/tools/background-removal', studio: 'standalone', mcpExecution: false },
  ...(['restore-video', 'denoise', 'fix-blur', 'smooth-motion'] as const).map(id => ({ id, version: 1 as const, group: 'quick' as const, inputKinds: ['video'] as const, outputKinds: ['video'] as const, minInputs: 1, maxInputs: 1, href: `/app/tools/${id}`, studio: 'standalone' as const, mcpExecution: false as const, qualificationRequired: true as const })),
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
  { id: 'smart-reframe', inputKind: 'video', controls: ['aspectRatio'], gate: 'fidelity-temporal-audio-cost' },
  { id: 'clean-audio', inputKind: 'audio', controls: ['noiseReduction'], gate: 'voice-music-timing-cost' },
] as const;
