import { getWorkspaceFrameCommand } from '@/components/composer/workspace-reference-commands';
import {
  resolveWorkspaceReferenceFieldTitle,
  workspaceReferenceCopy,
} from '@/components/composer/workspace-reference-copy';
import type { EngineCaps, Mode } from '@/types/engines';
import type { WorkspaceModelCandidate, WorkspaceModelSetup } from './workspace-model-candidate';
import { summarizeWorkspaceInputSchema } from './workspace-input-schema';
import { resolveWorkspaceWorkflow } from './workspace-workflow-projection';
import { getEngineModeLabel } from './workspace-engine-helpers';
import {
  workspaceModelReviewCopy,
  workspaceModelSettingLabel,
  workspaceModelSettingValue,
} from './workspace-model-review-copy';

/** Labels reuse the real reference-role owner; never infer roles from a filename. */
export function describeWorkspaceModelReferences(
  setup: WorkspaceModelSetup,
  engine: EngineCaps | undefined,
  locale: string,
) {
  const copy = workspaceModelReviewCopy(locale);
  const workflow = resolveWorkspaceWorkflow({ engine: engine ?? null, ...setup });
  const schema = summarizeWorkspaceInputSchema({
    selectedEngine: engine ?? null,
    ...workflow,
    uiLocale: locale,
  });
  const rows: Array<{
    fieldId: string;
    index: number;
    elementId?: string;
    kind: 'image' | 'video' | 'audio';
    name: string;
    label: string;
  }> = [];
  for (const [fieldId, assets] of Object.entries(setup.inputAssets)) {
    const entry = schema.assetFields.find((entry) => entry.field.id === fieldId);
    const frame = entry && engine ? getWorkspaceFrameCommand(entry, engine) : null;
    const label = frame
      ? workspaceReferenceCopy(locale)[frame]
      : entry
        ? resolveWorkspaceReferenceFieldTitle(entry.field, entry.role ?? 'generic', locale)
        : copy.unknown;
    assets.forEach((asset, index) => {
      if (asset) rows.push({ fieldId, index, kind: asset.kind, name: asset.name, label });
    });
  }
  for (const element of setup.klingElements)
    for (const [slot, assets] of [
      ['frontal', [element.frontal]],
      ['reference', element.references],
      ['video', [element.video]],
    ] as const) {
      assets.forEach((asset, index) => {
        if (asset)
          rows.push({
            fieldId: `klingElements.${slot}`,
            index,
            elementId: element.id,
            kind: asset.kind,
            name: asset.name,
            label: copy[`subject-${slot}`],
          });
      });
    }
  return rows;
}

/** Collapse repeated display facts only; candidate conditions and commercial inputs stay untouched. */
export function workspaceModelReviewChangeRows(
  candidate: WorkspaceModelCandidate,
  currentEngine: EngineCaps | undefined,
  target: EngineCaps,
  locale: string,
) {
  const copy = workspaceModelReviewCopy(locale);
  const durationPairs = new Set<string>();
  return candidate.changes.flatMap((change) => {
    const duration = ['effectiveDurationSec', 'durationSec', 'durationOption'].includes(change.field);
    if (duration) {
      const pair = JSON.stringify([change.before, change.after]);
      if (durationPairs.has(pair)) return [];
      durationPairs.add(pair);
    }
    const value = (input: unknown, engineId: string) =>
      change.field === 'mode'
        ? getEngineModeLabel(engineId, input as Mode, locale)
        : duration && typeof input === 'number'
          ? `${input}s`
          : workspaceModelSettingValue(input, copy);
    let before = value(change.before, currentEngine?.id ?? '');
    let after =
      change.reason === 'inactive' && change.after == null ? copy.inactive : value(change.after, target.id);
    if (change.field === 'supportsAudioToggle') {
      before = change.before ? copy.optionalAudio : currentEngine?.audio ? copy.includedAudio : copy.noAudio;
      after = change.after ? copy.optionalAudio : target.audio ? copy.includedAudio : copy.noAudio;
    }
    return [{ field: change.field, label: workspaceModelSettingLabel(change.field, copy), before, after }];
  });
}
