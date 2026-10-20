import 'server-only';
import { FEATURES } from '@/content/feature-flags';

/** Deployment gate: pricing migrations, worker release and qualification must precede activation. */
export function isCreatorExecutionEnabled(): boolean {
  return FEATURES.workflows.toolsSection && process.env.CREATOR_TOOLS_ENABLED === '1';
}
