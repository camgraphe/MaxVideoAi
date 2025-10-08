import type { EngineAvailability } from '@/types/engines';

export const AVAILABILITY_LABELS: Record<EngineAvailability, string> = {
  available: 'Available',
  limited: 'Limited access',
  waitlist: 'Waitlist',
  paused: 'Paused',
};

export const AVAILABILITY_BADGE_CLASS: Record<EngineAvailability, string> = {
  available: '',
  limited: 'border-amber-300 bg-amber-50 text-amber-700',
  waitlist: 'border-slate-300 bg-slate-100 text-text-muted',
  paused: 'border-slate-300 bg-slate-200 text-slate-600',
};
