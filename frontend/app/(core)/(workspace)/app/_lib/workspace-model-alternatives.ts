import { resolveRuntimeEngineInput } from '@/config/model-runtime';
import type { EngineCaps, PreflightRequest } from '@/types/engines';
import { buildWorkspacePreflightRequest } from './workspace-preflight-request';
import {
  prepareWorkspaceModelCandidate,
  type WorkspaceModelCandidate,
  type WorkspaceModelSetup,
} from './workspace-model-candidate';

export type WorkspaceModelAlternativeCandidate = {
  engine: EngineCaps;
  candidate: WorkspaceModelCandidate;
  request: PreflightRequest;
};

function familyKey(engine: EngineCaps) {
  return engine.brandId?.trim().toLowerCase() || engine.id.split('-')[0] || engine.id;
}

/**
 * Produces a small, diverse shortlist that can be quoted exactly. The runtime
 * catalogue order remains the final tie-breaker because it already carries the
 * product's publication and family priority.
 */
export function buildWorkspaceModelAlternatives({
  current,
  engines,
  locale,
  memberTier,
  disabledEngineReasons,
  engineScores,
  limit = 3,
}: {
  current: WorkspaceModelSetup | null;
  engines: EngineCaps[];
  locale: string;
  memberTier: 'Member' | 'Plus' | 'Pro';
  disabledEngineReasons?: Record<string, string>;
  engineScores?: Record<string, number | null | undefined>;
  limit?: number;
}): WorkspaceModelAlternativeCandidate[] {
  if (!current || limit <= 0) return [];
  const currentEngine = engines.find((engine) => engine.id === current.form.engineId);
  const ranked = engines
    .map((engine, index) => ({ engine, index }))
    .flatMap(({ engine, index }) => {
      if (
        engine.id === current.form.engineId ||
        engine.availability === 'paused' ||
        disabledEngineReasons?.[engine.id]
      )
        return [];
      const runtime = resolveRuntimeEngineInput(engine.id);
      if (runtime && (runtime.lifecycle !== 'current' || !runtime.publication.app.published)) return [];
      const candidate = prepareWorkspaceModelCandidate({
        engine,
        current,
        locale,
        currentEngine,
      });
      if (!candidate.applicable || candidate.blockingReasons.length) return [];
      const request = buildWorkspacePreflightRequest({
        form: candidate.setup.form,
        selectedEngine: engine,
        submissionMode: candidate.workflow.submissionMode,
        effectiveDurationSec: candidate.effectiveDurationSec,
        supportsAudioToggle: candidate.supportsAudioToggle,
        voiceControlEnabled: candidate.voiceControlEnabled,
        inputAssets: candidate.setup.inputAssets,
        memberTier,
      });
      return [{ engine, candidate, request, index }];
    })
    .sort((a, b) => {
      if (a.candidate.comparable !== b.candidate.comparable)
        return a.candidate.comparable ? -1 : 1;
      if (a.candidate.removedReferences.length !== b.candidate.removedReferences.length)
        return a.candidate.removedReferences.length - b.candidate.removedReferences.length;
      if (a.candidate.changes.length !== b.candidate.changes.length)
        return a.candidate.changes.length - b.candidate.changes.length;
      const scoreA = engineScores?.[a.engine.id];
      const scoreB = engineScores?.[b.engine.id];
      if (typeof scoreA === 'number' || typeof scoreB === 'number') {
        if (typeof scoreA !== 'number') return 1;
        if (typeof scoreB !== 'number') return -1;
        if (scoreA !== scoreB) return scoreB - scoreA;
      }
      return a.index - b.index;
    });

  const selected: typeof ranked = [];
  const familyCounts = new Map<string, number>();
  for (const alternative of ranked) {
    const family = familyKey(alternative.engine);
    if ((familyCounts.get(family) ?? 0) >= 2) continue;
    selected.push(alternative);
    familyCounts.set(family, (familyCounts.get(family) ?? 0) + 1);
    if (selected.length === limit) break;
  }
  if (selected.length < limit) {
    for (const alternative of ranked) {
      if (selected.includes(alternative)) continue;
      selected.push(alternative);
      if (selected.length === limit) break;
    }
  }
  return selected.map(({ engine, candidate, request }) => ({ engine, candidate, request }));
}
