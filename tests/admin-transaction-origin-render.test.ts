import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {JSDOM} from 'jsdom';
import {AppRouterContext} from 'next/dist/shared/lib/app-router-context.shared-runtime';
import {SearchParamsContext} from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import type {AdminTransactionRecord} from '../frontend/server/admin-transactions/types';

test('transaction list and selected receipt show their recorded origin independently of the amount', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'React');
  Object.defineProperty(globalThis, 'React', {value: React, configurable: true});
  try {
    const {AdminTransactionTable} = await import('../frontend/components/admin/TransactionTable');
    const records = (['studio','mcp','toolbox','unknown'] as const).map((origin,index): AdminTransactionRecord => ({
      receiptId:index+1,userId:null,userEmail:null,type:'charge',amountCents:100,currency:'USD',
      description:null,refundReason:null,jobId:null,jobStatus:null,jobPaymentStatus:null,jobEngineLabel:null,
      jobVideoUrl:null,jobDurationSec:null,isMcpGeneration:origin==='mcp',origin,jobCreatedAt:null,
      jobProgress:null,jobMessage:null,createdAt:'2026-10-20T13:00:00Z',hasRefund:false,latestChargeId:null,
      isLatestCharge:true,canRefund:false,
    }));
    const router = {back(){},forward(){},refresh(){},push(){},replace(){},prefetch:async()=>{}};
    const html = renderToStaticMarkup(React.createElement(AppRouterContext.Provider,{value:router},
      React.createElement(SearchParamsContext.Provider,{value:new URLSearchParams('receipt=1')},
        React.createElement(AdminTransactionTable,{
          initialTransactions:records,filters:{period:'all',type:'all',query:'',limit:50},
          nextCursor:null,initialReceipt:records[0],
        }))));
    const dom = new JSDOM(html);
    try {
      const headers = [...dom.window.document.querySelectorAll('thead th')].map(node=>node.textContent);
      assert.ok(headers.includes('Origin'), 'the origin must be visible in the transaction list');
      const column = headers.indexOf('Origin');
      const origins = [...dom.window.document.querySelectorAll('tbody tr')].map(row=>row.children[column].textContent);
      assert.deepEqual(origins,['Studio','MCP','Toolbox','Unknown']);
      const detail = [...dom.window.document.querySelectorAll('aside dt')].find(node=>node.textContent==='Origin');
      assert.equal(detail?.nextElementSibling?.textContent,'Studio');
    } finally {dom.window.close();}
  } finally {
    if(previous)Object.defineProperty(globalThis,'React',previous);
    else Reflect.deleteProperty(globalThis,'React');
  }
});
