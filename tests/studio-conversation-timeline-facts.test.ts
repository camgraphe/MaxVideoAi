import assert from 'node:assert/strict';
import test from 'node:test';
import {projectStudioConversationTimeline} from '../frontend/src/server/studio/conversation-timeline';

test('Milo reads the saved sequence framing rather than guessing from a source clip',()=>{
  const workspace={project:{id:'film',workspaceState:{activeSequenceId:'portrait'},revision:3,updatedAt:'2026-10-28T21:27:46.000Z'},sequences:[
    {id:'landscape',name:'Landscape',settings:{fps:25,aspectRatio:'16:9',resolution:'1080p'},timelineState:{timelineItems:[]}},
    {id:'portrait',name:'Portrait',settings:{fps:30,aspectRatio:'9:16',resolution:'720p'},timelineState:{timelineItems:[]}},
  ]} as unknown as Parameters<typeof projectStudioConversationTimeline>[0];
  const active=projectStudioConversationTimeline(workspace).data;
  assert.equal(active.aspectRatio,'9:16');
  assert.equal(active.resolution,'720p');
  assert.equal(active.fps,30);
  assert.equal(projectStudioConversationTimeline(workspace,'landscape').data.aspectRatio,'16:9');
});
