import { FEATURES } from '@/content/feature-flags';

/** Pure runtime projection shared by authenticated routes and assistant discovery. */
export function isCreatorExecutionEnabled(env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  return FEATURES.workflows.toolsSection && env.CREATOR_TOOLS_ENABLED === '1';
}
