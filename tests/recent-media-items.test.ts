import assert from 'node:assert/strict';
import test from 'node:test';
import { RecentMediaItems } from '../frontend/lib/recent-media-items';

test('recent media survives a return scroll, evicts the oldest and never retains removed collection members', () => {
  const items = new Map(Array.from({length: 1000}, (_, key) => [key, {key}]));
  const recent = new RecentMediaItems<{key:number}>(3, 120_000);
  const resolve = (key:number) => items.get(key) ?? null;
  const visit = (keys:number[], time:number) => recent.include(keys.map(key => items.get(key)!), resolve, time);
  assert.deepEqual(visit([0,1],0).map(item=>item.key),[0,1]);
  assert.deepEqual(visit([2],1000).map(item=>item.key),[2,0,1]);
  assert.deepEqual(visit([0],2000).map(item=>item.key),[0,1,2]);
  assert.deepEqual(visit([3],3000).map(item=>item.key),[3,2,0]);
  items.delete(0);
  assert.deepEqual(visit([3],4000).map(item=>item.key),[3,2]);
  assert.deepEqual(visit([4],124001).map(item=>item.key),[4]);
  for(let key=5;key<1000;key++) assert.ok(visit([key],124002+key).length<=3);
});

test('all currently visible rows remain present even when the viewport exceeds the recent window', () => {
  const items=Array.from({length:5},(_,key)=>({key}));
  const recent=new RecentMediaItems<{key:number}>(2);
  assert.deepEqual(recent.include(items,key=>items[key]??null),items);
});
