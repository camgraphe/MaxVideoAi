import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read=(name:string)=>readFileSync(`plugins/maxvideoai/skills/${name}/SKILL.md`,'utf8');
test('plugin discovery recognizes concrete Audio, Character Studio, creator and Studio requests',()=>{
  const generate=read('generate');
  const description=generate.split('---')[1];
  for(const intent of [/voice|audio/i,/music/i,/SFX/i,/Character Studio/i,/Recast/i,/subtitles/i,/Studio.*export/i])assert.match(description,intent);
  const plan=read('plan');
  assert.match(plan,/Audio.*list_audio_capabilities/s);
  assert.match(plan,/project.*budget.*video|video.*project.*budget/is);
});
test('expanded workflows preserve current-capability discovery, exact approvals and historical recovery',()=>{
  const source=read('generate')+'\n'+readFileSync('plugins/maxvideoai/skills/generate/references/extended-workflows.md','utf8');
  for(const tool of ['list_audio_capabilities','prepare_audio_generation','confirm_audio_generation','prepare_character_builder','confirm_character_builder','get_character_builder_status','list_saved_characters','get_saved_character','select_saved_character','prepare_recast','get_recast_status','list_creator_tools','prepare_creator_tool','get_creator_tool_operation','get_subtitle_document','edit_subtitle_document','export_subtitle_text','get_studio_timeline','prepare_studio_export','get_studio_export'])assert.ok(source.includes(tool),tool);
  assert.match(source,/zero.*approval|approval.*zero/is);
  assert.match(source,/web.*destination|destination.*web/is);
  assert.match(source,/never.*generic image.*Builder|generic image.*not.*Builder/is);
  assert.match(source,/do not.*repeat|never.*repeat|no.*new.*attempt/is);
});


test('offline policy fingerprint binds the packaged extended workflow reference', async () => {
  const {collectPolicyFingerprintInput}=await import('../frontend/scripts/qa/mcp-tool-selection-eval');
  const policy=await collectPolicyFingerprintInput();
  assert.equal(policy.references['generate/extended-workflows.md'],
    readFileSync('plugins/maxvideoai/skills/generate/references/extended-workflows.md','utf8'));
});
