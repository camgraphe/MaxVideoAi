import type { GroupSummary } from '@/types/groups';
import type { Job } from '@/types/jobs';
import { resolveClientJobSurface } from './jobs-page-helpers';

export type ActivityDestination = {
  href: string;
  target: 'studio' | 'create' | 'image' | 'audio' | 'storyboard' | 'character' | 'angle' | 'upscale' | 'background-removal' | 'tools';
  origin: 'studio' | 'mcp' | null;
  resumesSettings: boolean;
};

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function encodedJobId(value: unknown): string | null {
  if (typeof value !== 'string' || !value.length || value.length > 256 || /\s|[\u0000-\u001f\u007f]/u.test(value)) return null;
  try {
    return encodeURIComponent(value);
  } catch {
    return null;
  }
}

function destinationForJob(job: Job | undefined): ActivityDestination | null {
  if (!job || job.curated) return null;
  const jobId = encodedJobId(job.jobId);
  if (!jobId) return null;

  // The request snapshot is shared by Create, Studio and MCP. Only the server's
  // account-owned accepted quote projection can establish an origin.
  const provenance = record(job.activityOrigin);
  if (provenance?.kind === 'studio' && typeof provenance.projectId === 'string'
    && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(provenance.projectId)) {
    return {
      href: `/app/studio/workspace/${encodeURIComponent(provenance.projectId)}`,
      target: 'studio', origin: 'studio', resumesSettings: false,
    };
  }
  const origin = provenance?.kind === 'mcp' ? 'mcp' : null;
  const surface = resolveClientJobSurface(job);
  switch (surface) {
    case 'image':
      return { href: `/app/image?job=${jobId}`, target: 'image', origin, resumesSettings: true };
    case 'audio':
      return { href: `/app/audio?job=${jobId}`, target: 'audio', origin, resumesSettings: true };
    case 'storyboard':
      return { href: `/app/tools/storyboard?job=${jobId}`, target: 'storyboard', origin, resumesSettings: true };
    case 'character':
      return { href: `/app/tools/character-builder?job=${jobId}`, target: 'character', origin, resumesSettings: true };
    case 'angle':
      return { href: '/app/tools/angle', target: 'angle', origin, resumesSettings: false };
    case 'upscale': {
      const isVideo = record(job.settingsSnapshot)?.mediaType === 'video' || Boolean(job.videoUrl);
      return { href: `/app/tools/upscale${isVideo ? '?kind=video' : ''}`, target: 'upscale', origin, resumesSettings: false };
    }
    case 'background-removal':
      return { href: '/app/tools/background-removal', target: 'background-removal', origin, resumesSettings: false };
    case 'tool':
      return { href: '/app/tools', target: 'tools', origin, resumesSettings: false };
    default:
      return { href: `/app?job=${jobId}`, target: 'create', origin, resumesSettings: true };
  }
}

export function resolveActivityDestination(group: GroupSummary): ActivityDestination | null {
  const destination = destinationForJob(group.hero.job);
  if (!destination) return null;
  for (const member of group.members) {
    const candidate = destinationForJob(member.job);
    if (!candidate || candidate.target !== destination.target || candidate.origin !== destination.origin
      || candidate.resumesSettings !== destination.resumesSettings) return null;
    // A batch may contain several job IDs for the same workspace. Studio project
    // identity and tool tabs must agree; otherwise there is no single destination.
    if (!destination.resumesSettings && candidate.href !== destination.href) return null;
  }
  return destination;
}
