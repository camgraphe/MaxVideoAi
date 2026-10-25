import policy from '@/config/agent-model-editorial-policy.json';
import { getRuntimeModelById } from '@/config/model-runtime';
import type { EngineCaps, Mode } from '@/types/engines';

export type PickerGroup = { group: 'quality' | 'balanced' | 'budget'; ids: string[] };

/** Editorial projection only: identities and admission continue to belong to the registry. */
export function getPickerRecommendations(engines: EngineCaps[], mode: Mode): PickerGroup[] {
  const selection = mode === 't2v' || mode === 'i2v' || mode === 'ref2v' || mode === 'fl2v'
    ? policy.workspaceSelection.create : mode === 'v2v' ? policy.workspaceSelection.modify : [];
  const eligible = new Set(engines.filter(engine => {
    const runtime = getRuntimeModelById(engine.id);
    return engine.availability !== 'paused' && engine.modes.includes(mode)
      && (!runtime || (runtime.lifecycle === 'current' && runtime.publication.app.published));
  }).map(engine => engine.id));
  return selection.flatMap(entry => {
    const ids = entry.ids.filter(id => eligible.has(id));
    return ids.length ? [{ group: entry.group as PickerGroup['group'], ids }] : [];
  });
}
