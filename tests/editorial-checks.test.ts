import test from 'node:test';import assert from 'node:assert/strict';
import { checkedFixture } from './fixtures/editorial-checks.ts';
test('publication checks require actual complete views and exact content/media identity',async()=>{
 const {validateEditorialCheckReport}=await import('../frontend/lib/editorial/checks.ts');const {draft,digest,report}=checkedFixture();
 assert.equal(validateEditorialCheckReport(draft,digest,report).digest,digest);
 for(const mutate of [(v:any)=>v.views.pop(),(v:any)=>v.digest='b'.repeat(64),(v:any)=>v.media[0].sha256='b'.repeat(64),(v:any)=>v.links[0].status=404,(v:any)=>v.views[0].h1Count=2,(v:any)=>v.views[0].failures=['overflow'],(v:any)=>v.views[0].canonical='https://evil.test/',(v:any)=>v.rendererVersion='old']){const changed=structuredClone(report);mutate(changed);assert.throws(()=>validateEditorialCheckReport(draft,digest,changed));}
});

test('an external source refusing robots is reported as unverifiable, while broken links and internal refusals block publication',async()=>{
 const {validateEditorialCheckReport}=await import('../frontend/lib/editorial/checks');const {draft,digest,report}=checkedFixture();
 report.links[0].status=403;
 assert.equal(validateEditorialCheckReport(draft,digest,report).links[0].status,403);
 report.links[1].status=403;assert.throws(()=>validateEditorialCheckReport(draft,digest,report),/Link/);
 report.links[1].status=200;report.links[0].status=404;assert.throws(()=>validateEditorialCheckReport(draft,digest,report),/Link/);
});
