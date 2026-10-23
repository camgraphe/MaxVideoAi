import assert from 'node:assert/strict';
import test from 'node:test';
import { getBaseEnginesByCategory } from '../frontend/src/lib/engines';
import { buildComposerModeToggles, coerceFormState, isWorkspaceModeAvailable } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-engine-helpers';
import { resolveWorkspaceWorkflow } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-workflow-projection';
import { summarizeWorkspaceInputSchema } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-input-schema';

const workflowCopy = { generateVideo: 'Create', removeAudioToUnlock: 'Remove audio', audioUnsupported: 'Unsupported', audioLocked: 'Locked', audioLockedFallback: 'Locked' };
for (const engine of getBaseEnginesByCategory('video')) {
  test(`${engine.id}: every supported Modify/Extend has a selectable action and mode-specific controls`, () => {
    const toggles = buildComposerModeToggles({ selectedEngine: engine, audioWorkflowLocked: false, uiLocale: 'en', workflowCopy });
    for (const mode of ['v2v', 'extend'] as const) {
      const offered = toggles?.some(toggle => toggle.mode === mode) ?? false;
      assert.equal(offered, isWorkspaceModeAvailable(engine, mode), `${mode}: visible actions must match executable capabilities`);
      if (!offered) continue;
      const form = coerceFormState(engine, mode, null);
      const workflow = resolveWorkspaceWorkflow({ engine, form, inputAssets: {}, klingElements: [] });
      assert.equal(workflow.submissionMode, mode, 'empty explicit workflows must not fall back to Create');
      assert.equal(workflow.activeManualMode, mode);
      const summary = summarizeWorkspaceInputSchema({ selectedEngine: engine, ...workflow, uiLocale: 'en' });
      const fields = [...summary.assetFields, ...summary.promotedFields, ...summary.secondaryFields].map(entry => entry.field);
      for (const field of fields) {
        assert.ok(!field.modes?.length || field.modes.includes(mode), `${field.id} has no effect in ${mode}`);
      }
      assert.ok(summary.assetFields.some(({ field, required }) => field.type === 'video' && required), 'source remains mandatory');
      for (const field of [...(engine.inputSchema?.required ?? []), ...(engine.inputSchema?.optional ?? [])]) {
        if (!['image', 'video', 'audio'].includes(field.type) || (field.modes?.length && !field.modes.includes(mode))) continue;
        const displayed = summary.assetFields.find(entry => entry.field.id === field.id)?.field;
        assert.ok(displayed, `${field.id}: supported references must not disappear`);
        assert.equal(displayed.maxCount, field.maxCount);
        assert.equal(displayed.maxDurationSec, field.maxDurationSec);
      }
    }
  });
}
