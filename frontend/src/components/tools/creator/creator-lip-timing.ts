import type { SegmentDraft } from './CreatorSettings';
import type { CreatorSource } from './creator-source-selection';

type Role = 'source' | 'audio';
export type CreatorLipPassage = { startSec: number; endSec: number | null; durationSec: number | null; originalDurationSec: number | null };
export type CreatorLipTimingIssue = { role: Role; code: 'invalid' | 'outside' | 'short' | 'long' | 'mismatch' };
export type CreatorLipTiming = {
  passages: Partial<Record<Role, CreatorLipPassage>>;
  issue?: CreatorLipTimingIssue;
  adaptation?: { durationSec: number; segments: Partial<Record<Role, SegmentDraft>> };
};

/** Advisory browser validation only. Preparation re-measures the owned originals and selected passages. */
export function getCreatorLipTiming(mode: string, sources: Partial<Record<Role, CreatorSource>>, segments: Partial<Record<Role, SegmentDraft>>): CreatorLipTiming {
  const result: CreatorLipTiming = { passages: {} };
  const roles: Role[] = mode === 'video' ? ['audio', 'source'] : ['audio'];
  for (const role of roles) {
    const source = sources[role];
    if (!source) continue;
    const draft = segments[role];
    const originalDurationSec = source.durationSec != null && Number.isFinite(source.durationSec) && source.durationSec > 0 ? source.durationSec : null;
    const startSec = draft?.enabled ? draft.start.trim() === '' ? NaN : Number(draft.start) : 0;
    const endSec = draft?.enabled ? draft.end.trim() === '' ? NaN : Number(draft.end) : originalDurationSec;
    const durationSec = endSec == null ? null : Number((endSec - startSec).toFixed(9));
    result.passages[role] = { startSec, endSec, durationSec, originalDurationSec };
    const code = !Number.isFinite(startSec) || startSec < 0 || (endSec != null && (!Number.isFinite(endSec) || endSec <= startSec)) ? 'invalid'
      : endSec != null && originalDurationSec != null && endSec > originalDurationSec + 0.001 ? 'outside'
      : durationSec != null && durationSec < 2 ? 'short'
      : durationSec != null && durationSec > 15 ? 'long' : undefined;
    if (code) {
      // A malformed passage must not receive a suggestion based on another valid input.
      if (code === 'invalid' || code === 'outside') return { ...result, issue: { role, code } };
      result.issue ??= { role, code };
    }
  }
  const audio = result.passages.audio, video = result.passages.source;
  if (!result.issue && mode === 'video' && audio?.durationSec != null && video?.durationSec != null
    && (Math.abs(audio.durationSec - video.durationSec) > 0.001 || audio.durationSec > video.durationSec)) {
    result.issue = { role: 'audio', code: 'mismatch' };
  }
  if (result.issue && (result.issue.code === 'long' || result.issue.code === 'mismatch')
    && roles.every(role => result.passages[role]?.durationSec != null && result.passages[role]!.durationSec! >= 2)) {
    const durationSec = Math.min(15, ...roles.map(role => result.passages[role]!.durationSec!));
    const ranges: Partial<Record<Role, SegmentDraft>> = {};
    for (const role of roles) {
      const passage = result.passages[role]!;
      ranges[role] = { enabled: true, start: String(passage.startSec), end: String(Number((passage.startSec + durationSec).toFixed(9))) };
    }
    result.adaptation = { durationSec, segments: ranges };
  }
  return result;
}
