import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useWorkspacePreviewState } from '../frontend/app/(core)/(workspace)/app/_hooks/useWorkspacePreviewState';
import type { Job } from '../frontend/types/jobs';
import type { VideoGroup } from '../frontend/types/video-groups';

test('an opened pending snapshot follows its completion into history after active rows are removed', () => {
  const snapshot: VideoGroup = {id:'selected',provider:'fal',layout:'x1',createdAt:'2026-09-15T00:00:00Z',status:'loading',
    items:[{id:'job',jobId:'job',url:'',aspect:'16:9',meta:{status:'pending',observation:{stage:'queued',checkedAt:100}}}]};
  const job = {jobId:'job',engineLabel:'Wan 3 Prime',durationSec:15,prompt:'fixture',createdAt:'2026-09-15T00:00:00Z',
    status:'completed',videoUrl:'https://example.com/ready.mp4'} as Job;
  let state!: ReturnType<typeof useWorkspacePreviewState>;
  function Fixture({recentJobs}:{recentJobs:Job[]}) {
    state=useWorkspacePreviewState({recentJobs,provider:'fal',selectedPreview:null,pendingSummaryMap:new Map(),
      compositeOverride:snapshot,activeVideoGroup:null,initialPreviewGroup:null,effectiveRequestedEngineId:null,
      effectiveRequestedEngineToken:null,requestedJobId:null,fromVideoId:null});
    return null;
  }
  let renderer!: ReactTestRenderer;
  act(()=>{renderer=create(React.createElement(Fixture,{recentJobs:[]}));});
  assert.equal(state.displayCompositeGroup?.status,'loading');
  act(()=>renderer.update(React.createElement(Fixture,{recentJobs:[job]})));
  assert.equal(state.displayCompositeGroup?.status,'ready');
  assert.equal(state.displayCompositeGroup?.items[0].url,job.videoUrl);
  act(()=>state.setViewerTarget({kind:'group',group:snapshot}));
  assert.equal(state.viewerGroup?.items[0].url,job.videoUrl);
  act(()=>renderer.unmount());
});
