import test from 'node:test';
import assert from 'node:assert/strict';
import {studioActionRequestSchema} from '../frontend/lib/studio/conversation-action-contract';
import {automaticStudioProjectTitle,isUntitledStudioProject,normalizeStudioProjectName} from '../frontend/lib/studio/conversation-project-title';

test('names a conversation from its first meaningful brief, in the language supplied',()=>{
  for(const opener of ['Hello','Hello there','Thank you','Can you help me?','Buenos días','Peux-tu m’aider ?',"Peux-tu m'aider ?"])assert.equal(automaticStudioProjectTitle(opener),null);
  assert.equal(automaticStudioProjectTitle('Hello. A cinematic perfume launch in Paris.'),'A cinematic perfume launch in Paris');
  assert.equal(automaticStudioProjectTitle('Imagine'),null);
  assert.equal(automaticStudioProjectTitle('OK, go!'),null);
  assert.equal(automaticStudioProjectTitle('Create a cinematic perfume launch in Paris. Keep it warm.'),'Cinematic perfume launch in Paris');
  assert.equal(automaticStudioProjectTitle('Je voudrais une vidéo pour un parfum à Paris.'),'Une vidéo pour un parfum à Paris');
  assert.equal(automaticStudioProjectTitle('Animate @Image 1 with gentle movement https://private.example/a?token=secret'),'Animate with gentle movement');
});

test('keeps names bounded and rejects empty or multiline manual input',()=>{
  const title=automaticStudioProjectTitle('Create '+('Beautiful landscape '.repeat(20)));
  assert.ok(title&&title.length<=80);
  assert.ok(!title?.endsWith('Beaut'));
  assert.equal(normalizeStudioProjectName('  My film  '),'My film');
  assert.throws(()=>normalizeStudioProjectName('\n\t'));
  assert.throws(()=>normalizeStudioProjectName('One\nTwo'));
  assert.equal(isUntitledStudioProject('Projet sans titre'),true);
  assert.equal(isUntitledStudioProject('New project'),true);
  assert.equal(isUntitledStudioProject('My film'),false);
});


test('a malformed optional semantic title never discards a valid brief or old saved action',()=>{
  const memory={action:'project.remember',revision:0,brief:'A useful campaign brief.',decisions:[]};
  assert.deepEqual(studioActionRequestSchema.parse(memory),memory);
  for(const projectTitle of ['', 'x'.repeat(81), 'Paris\nlaunch']){
    const parsed=studioActionRequestSchema.parse({...memory,projectTitle});
    if(parsed.action!=='project.remember')throw new Error('Expected memory');assert.equal(parsed.brief,memory.brief);assert.equal(parsed.projectTitle,null);
  }
  assert.equal(studioActionRequestSchema.safeParse({...memory,unexpected:true}).success,false);
});
