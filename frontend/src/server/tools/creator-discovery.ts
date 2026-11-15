import {CREATOR_DEFAULT_SETTINGS} from '@/lib/toolbox/creator-tools';
import { FEATURES } from '@/content/feature-flags';
import { CREATOR_TOOL_IDS, isCreatorToolPublic } from '@/lib/toolbox/creator-availability';
import { TOOLBOX, type ToolId, type ToolMediaKind } from '@/lib/toolbox/catalogue';
import { FINISHING_QUALITY_CHOICES, isFinishingToolId } from '@/lib/toolbox/finishing';
import { isCreatorExecutionEnabled } from './creator-execution-gates';
import { listCreatorToolProfiles } from './creator-profiles';
import { FINISHING_PROFILES } from './finishing-providers';
import { FINISHING_QUALIFICATIONS, isFinishingProfileReleased } from './finishing-release';

function trustedToolOrigin(accountUrl: string): string {
  const url = new URL(accountUrl);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Creator discovery requires an HTTP account origin.');
  return url.origin;
}

type WebToolHandoff = {
  id: Exclude<ToolId, 'character-builder'>; inputKinds: readonly ToolMediaKind[]; outputKinds: readonly ToolMediaKind[];
  url: string; mcpExecution: false; providerReadiness: 'not-checked';
  release: 'public-web-entry' | 'owner-approved-pilot' | 'qualified' | 'profile-dependent';
  profiles: { id: string; quality: 'standard' | 'pro'; release: 'owner-approved-pilot' | 'qualified' }[];
};

function webToolHandoffs(origin: string): WebToolHandoff[] {
  if (!FEATURES.workflows.toolsSection) return [];
  return TOOLBOX.flatMap<WebToolHandoff>(tool => {
    if (tool.id === 'character-builder') return [];
    const toolId = tool.id;
    const base = { id: toolId, inputKinds: tool.inputKinds, outputKinds: tool.outputKinds,
      url: new URL(tool.href, origin).toString(), mcpExecution: false as const, providerReadiness: 'not-checked' as const };
    if (!isFinishingToolId(toolId)) return [{ ...base, release: 'public-web-entry' as const, profiles: [] }];
    const profiles = FINISHING_QUALITY_CHOICES[toolId].flatMap(quality => {
      const profile = FINISHING_PROFILES[toolId][quality];
      if (!profile || !isFinishingProfileReleased(profile, quality)) return [];
      const qualification = FINISHING_QUALIFICATIONS.find(entry => entry.profileId === profile.id);
      return [{ id: profile.id, quality, release: qualification?.ownerApprovedPilot
        ? 'owner-approved-pilot' as const : 'qualified' as const }];
    });
    if (!profiles.length) return [];
    const release = profiles.every(profile => profile.release === 'owner-approved-pilot') ? 'owner-approved-pilot' as const
      : profiles.every(profile => profile.release === 'qualified') ? 'qualified' as const : 'profile-dependent' as const;
    return [{ ...base, release, profiles }];
  });
}

/** Read-only discovery. A web entry is navigation, never a quote, media import or operation. */
export function readCreatorToolDiscovery(options: { enabled: boolean; accountUrl: string; surface?: 'mcp' | 'studio' }) {
  const origin = trustedToolOrigin(options.accountUrl);
  const webEnabled = isCreatorExecutionEnabled();
  const profiles = listCreatorToolProfiles({ enabled: options.enabled });
  const webProfiles = listCreatorToolProfiles({ enabled: webEnabled });
  return {
    executionSurface: options.surface ?? 'mcp',
    directExecutionEnabled: options.enabled,
    tools: CREATOR_TOOL_IDS.map(id => ({ id, defaults: id==='subtitles'?{}:CREATOR_DEFAULT_SETTINGS[id],
      source: id === 'subtitles' ? ['audio', 'video'] : id === 'lip-sync' ? ['image+audio', 'video+audio']
        : id === 'motion-transfer' ? ['image+video'] : [id === 'product-photo-editor' ? 'image' : 'video'],
      profiles: id === 'subtitles' ? [{ id: 'scribe-v2', deploymentGateOpen: options.enabled,
        webDeploymentGateOpen: webEnabled, editing: 'text, timing and style; no new transcription', exports: ['srt', 'vtt', 'mp4 from video source'] }]
        : profiles.filter(profile => profile.toolId === id).map(profile => ({ ...profile,
          webDeploymentGateOpen: webProfiles.find(candidate => candidate.id === profile.id)?.deploymentGateOpen === true })),
      web: { url: new URL(`/app/tools/${id}`, origin).toString(), publicReleased: isCreatorToolPublic(id), executionGateOpen: webEnabled },
    })),
    webTools: webToolHandoffs(origin),
    webHandoff: { startsOperation: false as const, transfersMedia: false as const,
      requiresSourceSelection: true as const, requiresWebQuoteApproval: true as const },
    requiresExactQuoteApproval: true as const,
    statusPolling: 'Follow retry.afterSeconds; null ends automatic polling.',
  };
}

export type CreatorToolDiscovery = ReturnType<typeof readCreatorToolDiscovery>;
