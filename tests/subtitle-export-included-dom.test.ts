import assert from 'node:assert/strict';
import test from 'node:test';
import { mountToolFixture } from './helpers/tool-selection-fixture';

test('included MP4 export confirms the saved zero-cost operation without a second price prompt', async () => {
  const f = await mountToolFixture(`import {CreatorOperationPanel} from './src/components/tools/creator/CreatorOperationPanel';
    function App(){return <CreatorOperationPanel locale="en" includedExport operation={window.operation} onPrepare={()=>{}}/>}`, {
    './creator-workspace.module.css':'export default {};',
    'next/link':"import React from 'react';export default p=>React.createElement('a',{href:p.href},p.children);",
  }, w => { w.confirmations=0; w.operation={quote:{price:{amountCents:0,currency:'USD'},expiresAt:'2099-01-01T00:00:00Z'},confirm:async()=>{w.confirmations++}}; });
  try {
    assert.match(f.w.document.body.textContent,/MP4 export included/);
    assert.doesNotMatch(f.w.document.body.textContent,/Your price|Confirm price|\$0\.00/);
    const button=Array.from(f.w.document.querySelectorAll('button')).find((node:any)=>node.textContent==='Create the MP4') as any;
    assert.ok(button); await f.act(()=>button.click()); assert.equal(f.w.confirmations,1);
    f.w.operation={...f.w.operation,quote:{...f.w.operation.quote,price:{amountCents:48,currency:'USD'}}};await f.render();
    assert.match(f.w.document.body.textContent,/Your price/);
    assert.doesNotMatch(f.w.document.body.textContent,/MP4 export included/,'a historical paid quote must never be relabeled free');
  } finally { await f.close(); }
});
