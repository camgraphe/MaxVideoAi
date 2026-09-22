import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateMinimaxH3MaxReferenceTokenBudget as budget } from '../frontend/src/lib/minimax-h3-max-pricing';
const image={kind:'image' as const,url:'https://assets.example/image.png',width:2048,height:2048};
const video={kind:'video' as const,url:'https://assets.example/video.mp4',width:1920,height:1080,durationSec:15};
test('reference budget normalizes images rather than billing source megapixels',()=>{
 assert.equal(budget({resolution:'768P',durationSec:5,references:[image]}),1024);
 assert.equal(budget({resolution:'768P',durationSec:5,references:[image,image]}),1024);
 assert.equal(budget({resolution:'768P',durationSec:5,references:[{...image,width:3840,height:2160}]}),1824);
});
test('video budget stays above published 24fps examples without charging beyond requested output',()=>{
 const examples={ '480P':[4680,12480,26130,39780], '768P':[12096,32256,67536,102816], '1080P':[12096,32256,67536,102816] };
 for(const [resolution,costs] of Object.entries(examples)) for(const [i,durationSec] of [2,5,10,15].entries()) {
  const value=budget({resolution,durationSec,references:[video]});
  assert.ok(value>=costs[i]!,`${resolution}/${durationSec}`);
  assert.ok(value<=costs[i]!*1.5,`bounded buffer ${resolution}/${durationSec}`);
 }
 assert.equal(budget({resolution:'768P',durationSec:5,references:[video]}),budget({resolution:'1080P',durationSec:5,references:[{...video,durationSec:5}]}));
});
test('audio budget retains a modest buffer and rejects unverifiable media facts',()=>{
 assert.equal(budget({resolution:'768P',durationSec:5,references:[{kind:'audio',url:'https://assets.example/a.wav',durationSec:10}]}),960);
 assert.throws(()=>budget({resolution:'768P',durationSec:5,references:[{...video,durationSec:null}]}),/metadata/i);
 assert.throws(()=>budget({resolution:'768P',durationSec:5,references:[{...image,width:null}]}),/metadata/i);
});
