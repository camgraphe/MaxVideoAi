import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import test from 'node:test';
import {studioProjectEntryUrl} from '../frontend/app/(core)/(workspace)/app/studio/_lib/studio-conversation-entry';
const studio='frontend/app/(core)/(workspace)/app/studio/';

test('retired private projects never link to the Canvas editor',()=>{
  assert.equal(studioProjectEntryUrl({id:'old-private-project',persistenceMode:'legacy'},true),'/app/studio');
  assert.equal(studioProjectEntryUrl({id:'conversation',persistenceMode:'connected'},true),'/app/studio/conversation/conversation');
  assert.equal(studioProjectEntryUrl({id:'conversation',persistenceMode:'connected'},false),'/app/studio');
});

test('retired editor route entries redirect without importing an editor',()=>{
  for(const file of ['workspace/page.tsx','workspace/[projectId]/page.tsx','projects/page.tsx']){
    const source=readFileSync(studio+file,'utf8');
    assert.match(source,/redirect\(/,file);
    assert.doesNotMatch(source,/WorkspacePage|StudioProjectsPageClient|view.*canvas|readStudioProject|ensureStudioProjectSchema/,file);
  }
});

test('new project picker has no old Canvas creation or navigation surface',()=>{
  const source=readFileSync(studio+'_components/ConversationProjects.client.tsx','utf8');
  assert.doesNotMatch(source,/Canvas & templates|Canvas et modèles|view=canvas/);
  const list=readFileSync('frontend/src/server/studio/conversation-project-list.ts','utf8');
  assert.match(list,/persistence_mode\s*=\s*'connected'/);
});

test('React Flow and the private editor are absent while shared timeline remains owned',()=>{
  assert.equal(existsSync(studio+'workspace/WorkspacePage.client.tsx'),false);
  const pkg=JSON.parse(readFileSync('frontend/package.json','utf8'));
  assert.equal(pkg.dependencies?.['@xyflow/react'],undefined);
  assert.equal(existsSync(studio+'_shared/_components/viewer/ProgramPlaybackLayers.tsx'),true);
});

test('MCP montage results open the supported conversational Studio',()=>{
  const source=readFileSync('frontend/src/server/studio/montage-command.ts','utf8');
  assert.match(source,/studioUrl: `\/app\/studio\/conversation\//);
  assert.doesNotMatch(source,/studioUrl: `\/app\/studio\/workspace\//);
});


test('stale Canvas mutation clients cannot recreate old projects or sequences',()=>{
  for(const file of ['projects/route.ts','projects/[projectId]/route.ts','projects/[projectId]/sequences/route.ts','projects/[projectId]/sequences/[sequenceId]/route.ts']){
    const source=readFileSync('frontend/app/api/studio/'+file,'utf8');
    assert.doesNotMatch(source,/upsertStudioProject|upsertStudioSequence/,file);
  }
});
