import type { EngineInputField } from '../../../types/engines';

export const FLUX_3_ASPECT_RATIOS = ['auto', '21:9', '2:1', '16:9', '4:3', '1:1', '3:4', '9:16'] as const;
export const FLUX_3_EXPLICIT_DURATIONS = Array.from({ length: 16 }, (_, index) => String(index + 5));
export const FLUX_3_AUTO_DURATIONS = ['auto', ...FLUX_3_EXPLICIT_DURATIONS];

export function createFlux3CommonOptionalFields(): EngineInputField[] {
  return [
    { id: 'duration', type: 'enum', label: 'Duration', modes: ['t2v', 'i2v', 'extend'], values: FLUX_3_AUTO_DURATIONS, default: 'auto' },
    { id: 'duration', type: 'enum', label: 'Duration', modes: ['fl2v'], values: FLUX_3_EXPLICIT_DURATIONS, default: '5' },
    { id: 'generate_audio', type: 'boolean', label: 'Generate audio', modes: ['t2v', 'i2v', 'fl2v', 'extend'], default: true },
    { id: 'aspect_ratio', type: 'enum', label: 'Aspect ratio', modes: ['t2v', 'i2v', 'fl2v', 'extend'], values: [...FLUX_3_ASPECT_RATIOS], default: 'auto' },
    { id: 'safety_tolerance', type: 'number', label: 'Safety tolerance', modes: ['t2v', 'i2v', 'fl2v', 'extend'], min: 0, max: 4, step: 1, default: 2 },
  ];
}
