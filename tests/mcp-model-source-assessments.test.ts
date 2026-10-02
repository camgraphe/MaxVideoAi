import assert from 'node:assert/strict';
import test from 'node:test';
import {getAgentModelGuidance,parseAgentModelGuidance} from '../frontend/src/server/agent-api/model-guidance';
import {getAgentModelDetails} from '../frontend/src/server/agent-api/model-details';
import {getFalEngineById} from '../frontend/src/config/falEngines';
import {studioVisualCapabilityDetails} from '../frontend/src/server/studio/conversation-capabilities';

test('shared guidance exposes attributed vendor recommendations without fabricating measured ratings or prices', async () => {
  for (const id of ['gpt-image-2-5-flare','gpt-image-2','seedance-2-0-mini','wan-3','minimax-h3']) {
    const guidance=getAgentModelGuidance(id);
    assert.ok(guidance?.sourceAssessments?.length,id);
    for (const assessment of guidance.sourceAssessments) {
      assert.ok(['vendor_recommendation','documented_capability'].includes(assessment.classification));
      assert.match(assessment.sourceUrl,/^https:\/\//);
      assert.ok(Object.isFrozen(assessment));
      assert.doesNotMatch(JSON.stringify(assessment),/\$|priceCents|qualityScore|benchmarkScore/);
    }
    const entry=getFalEngineById(id)!;
    const surface=id.startsWith('gpt-image') ? 'image' as const : 'video' as const;
    const mode=surface==='image' ? 't2i' as const : 't2v' as const;
    const candidate={engine:entry.engine,surface,publicModes:[mode],modeCaps:Object.fromEntries(entry.modes.map(value=>[value.mode,value.ui]))};
    const details=await getAgentModelDetails(id,{listEngines:async()=>[entry.engine],surfaceByEngineId:()=>surface,isEngineExecutable:()=>true,isModeExecutable:()=>true});
    assert.deepEqual(details.guidance?.sourceAssessments,guidance.sourceAssessments);
    const studio=studioVisualCapabilityDetails(candidate);
    assert.notEqual(studio.surface,'audio');
    if (studio.surface!=='audio') assert.deepEqual(studio.guidance?.sourceAssessments,details.guidance?.sourceAssessments);
  }
});

test('source annotations accept only classified, attributed primary evidence and reject invented numeric scores', () => {
  const base={engineId:'gpt-image-2',strengths:['Reference editing'],bestFor:['reference_guided'],considerations:['Inspect executable settings.'],evidenceUrls:['https://maxvideoai.com/models/gpt-image-2'],reviewedAt:'2026-10-02'};
  const source={source:'higgsfield',sourceUrl:'https://raw.githubusercontent.com/higgsfield-ai/cli/main/MODELS.md',summary:'Documents reference-guided image editing.',classification:'documented_capability',reviewedAt:'2026-10-02'};
  const known=new Set(['gpt-image-2']);
  assert.deepEqual(parseAgentModelGuidance([{...base,sourceAssessments:[source]}],known)[0].sourceAssessments,[source]);
  for (const mutation of [
    {...source,score:9.8}, {...source,classification:'measured_quality'}, {...source,sourceUrl:'https://example.com/ratings'},
    {...source,sourceUrl:'https://raw.githubusercontent.com.evil.test/higgsfield-ai/cli/main/MODELS.md'},
    {...source,sourceUrl:'https://user:secret@raw.githubusercontent.com/higgsfield-ai/cli/main/MODELS.md'},
    {...source,reviewedAt:'2026-02-30'},
  ]) assert.throws(()=>parseAgentModelGuidance([{...base,sourceAssessments:[mutation]}],known));
});
