import assert from 'node:assert/strict';
import test from 'node:test';
import { getBaseEnginesByCategory } from '../frontend/src/lib/engines';
import { buildComposerModeToggles, coerceFormState, isWorkspaceModeAvailable } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-engine-helpers';
import { resolveWorkspaceWorkflow } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-workflow-projection';
import { summarizeWorkspaceInputSchema } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-input-schema';

import {resolveVideoOperationEngine} from '../frontend/lib/video-operation';
const workflowCopy = { generateVideo: 'Create', removeAudioToUnlock: 'Remove audio', audioUnsupported: 'Unsupported', audioLocked: 'Locked', audioLockedFallback: 'Locked' };
for (const engine of getBaseEnginesByCategory('video')) {
  test(`${engine.id}: every supported Modify/Extend has a selectable action and mode-specific controls`, () => {
    const toggles = buildComposerModeToggles({ selectedEngine: engine, audioWorkflowLocked: false, uiLocale: 'en', workflowCopy });
    for (const mode of ['v2v', 'extend'] as const) {
      const offered = toggles?.some(toggle => toggle.mode === mode) ?? false;
      assert.equal(offered, isWorkspaceModeAvailable(engine, mode), `${mode}: visible actions must match executable capabilities`);
      if (!offered) continue;
      const form = coerceFormState(engine, mode, null);
      const selectedEngine=resolveVideoOperationEngine(engine,mode,form.operation);
      const workflow = resolveWorkspaceWorkflow({ engine:selectedEngine, form, inputAssets: {}, klingElements: [] });
      assert.equal(workflow.submissionMode, mode, 'empty explicit workflows must not fall back to Create');
      assert.equal(workflow.activeManualMode, mode);
      const summary = summarizeWorkspaceInputSchema({ selectedEngine, ...workflow, uiLocale: 'en' });
      const fields = [...summary.assetFields, ...summary.promotedFields, ...summary.secondaryFields].map(entry => entry.field);
      for (const field of fields) {
        assert.ok(!field.modes?.length || field.modes.includes(mode), `${field.id} has no effect in ${mode}`);
      }
      const owned=(engine.id==='luma-ray-3-2'&&mode==='extend')||(engine.id==='flux-3-draft'&&mode==='v2v');
      if(owned){
        assert.equal(summary.assetFields.some(({field})=>field.type==='video'),false,'lineage uses an owned generation picker');
        assert.ok([...selectedEngine.inputSchema!.required!,...selectedEngine.inputSchema!.optional!].some(field=>field.id==='source_job_id'));
      }else assert.ok(summary.assetFields.some(({ field, required }) => field.type === 'video' && required), 'source remains mandatory');
      for (const field of [...(selectedEngine.inputSchema?.required ?? []), ...(selectedEngine.inputSchema?.optional ?? [])]) {
        if (!['image', 'video', 'audio'].includes(field.type) || (field.modes?.length && !field.modes.includes(mode))) continue;
        const displayed = summary.assetFields.find(entry => entry.field.id === field.id)?.field;
        assert.ok(displayed, `${field.id}: supported references must not disappear`);
        assert.equal(displayed.maxCount, field.maxCount);
        assert.equal(displayed.maxDurationSec, field.maxDurationSec);
      }
    }
  });
}

test('promptless operation controls do not require an invisible prompt; operation projection retains full navigation',()=>{
 for(const [id,mode,operation]of [['flux-3-draft','v2v','flux-draft-enhance'],['minimax-h3-max','v2v','h3-relight'],['ltx-2-3','reframe','ltx23-reframe']] as const){
  const base=getBaseEnginesByCategory('video').find(engine=>engine.id===id)!;
  const engine=resolveVideoOperationEngine(base,mode,operation);
  const form={...coerceFormState(base,mode,null),operation};
  const workflow=resolveWorkspaceWorkflow({engine,capabilityEngine:base,form,inputAssets:{},klingElements:[]});
  const summary=summarizeWorkspaceInputSchema({selectedEngine:engine,...workflow,uiLocale:'en'});
  assert.equal(summary.promptField,undefined);assert.equal(summary.promptRequired,false,operation);
  assert.deepEqual(workflow.workspaceExecutableModes,base.modes.filter(mode=>isWorkspaceModeAvailable(base,mode)));
 }
});
