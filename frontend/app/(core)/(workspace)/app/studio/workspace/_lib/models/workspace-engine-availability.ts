import type { EngineAvailability } from '@/types/engines';
import type { WorkspaceModelCapability } from '../workspace-types';

export type WorkspaceEngineOperationalEligibility = {
  availability: EngineAvailability | null;
  isOperational: boolean;
  unavailableReason: 'paused' | 'waitlist' | null;
};

export function resolveWorkspaceEngineOperationalEligibility(
  capability: WorkspaceModelCapability | null
): WorkspaceEngineOperationalEligibility {
  if (!capability) {
    return { availability: null, isOperational: false, unavailableReason: null };
  }

  switch (capability.availability) {
    case 'available':
    case 'limited':
      return {
        availability: capability.availability,
        isOperational: true,
        unavailableReason: null,
      };
    case 'paused':
      return { availability: 'paused', isOperational: false, unavailableReason: 'paused' };
    case 'waitlist':
      return { availability: 'waitlist', isOperational: false, unavailableReason: 'waitlist' };
  }
}
