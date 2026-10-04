import assert from 'node:assert/strict';
import test from 'node:test';
import {addDemoCreditPack,consumeDemoCredits,createDemoCreditWallet,demoPurchasedBalance} from './fixtures/studio-assistance-preview/demo-credit-wallet';

test('a $2 pack plus a $10 pack retains prior usage and accumulates 12,000 demo credits', () => {
  const before = createDemoCreditWallet();
  const after = addDemoCreditPack(before, 10);
  assert.deepEqual(demoPurchasedBalance(after), {total: 12000, remaining: 11280});
  assert.deepEqual(after.packs[0], before.packs[0]);
  assert.deepEqual(after.included, before.included);
  assert.equal(before.packs.length, 1);
  const third = addDemoCreditPack(after, 2);
  assert.deepEqual(demoPurchasedBalance(third), {total: 14000, remaining: 13280});
  assert.deepEqual(third.packs.map(pack => pack.id), [1, 2, 3]);
});

test('demo usage exhausts included credits before touching purchased packs', () => {
  const before = addDemoCreditPack(createDemoCreditWallet(), 10);
  const first = consumeDemoCredits(before, 100);
  assert.equal(first.wallet.included.remaining, 44);
  assert.equal(first.includedUsed, 100);
  assert.equal(first.purchasedUsed, 0);
  assert.deepEqual(first.wallet.packs, before.packs);
  const second = consumeDemoCredits(first.wallet, 100);
  assert.equal(second.wallet.included.remaining, 0);
  assert.equal(second.includedUsed, 44);
  assert.equal(second.purchasedUsed, 56);
  assert.equal(second.wallet.packs[0].remaining, 1224);
  assert.equal(second.wallet.packs[1].remaining, 10000);
  assert.equal(before.included.remaining, 144);
});

test('demo consumption crosses purchased packs in order and never creates a negative balance', () => {
  const wallet = addDemoCreditPack(createDemoCreditWallet(), 10);
  const result = consumeDemoCredits(wallet, 1500);
  assert.equal(result.wallet.included.remaining, 0);
  assert.deepEqual(result.wallet.packs.map(pack => pack.remaining), [0, 9924]);
  assert.equal(result.unfulfilled, 0);
  const exhausted = consumeDemoCredits(result.wallet, 10000);
  assert.deepEqual(demoPurchasedBalance(exhausted.wallet), {total: 12000, remaining: 0});
  assert.equal(exhausted.unfulfilled, 76);
});

test('invalid demo purchases and usage are rejected', () => {
  for (const price of [0, -2, 3, NaN]) assert.throws(() => addDemoCreditPack(createDemoCreditWallet(), price));
  for (const usage of [0, -1, 0.5, NaN, Infinity]) assert.throws(() => consumeDemoCredits(createDemoCreditWallet(), usage));
});
