import type { GroupedJobAction } from '@/components/GroupedJobCard';
import type { JobSurface } from '@/types/billing';
export type { GroupedJobAction };
export type JobsSource = JobSurface | 'all';
export type JobsStatus = 'all' | 'pending' | 'completed' | 'failed';
export const JOBS_SOURCES = ['all', 'video', 'image', 'audio', 'storyboard', 'character', 'angle', 'upscale', 'background-removal'] as const satisfies readonly JobsSource[];
