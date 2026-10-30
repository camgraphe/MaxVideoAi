import assert from 'node:assert/strict';
import test from 'node:test';
import * as contract from '../frontend/src/lib/studio/assistance-contract';
import {readStudioUsage,studioProviderReservation} from '../frontend/src/server/studio/assistance-provider-facts';
import {quoteStudioAssistance} from '../frontend/server/pricing/quote-studio-assistance';

test('Terra uses its own supplier and retail rates; old tariffs remain immutable',()=>{
  const facts=readStudioUsage({input_tokens:1000,input_tokens_details:{cached_tokens:200},output_tokens:100,output_tokens_details:{reasoning_tokens:50}},'gpt-6.1-terra','default');
  assert.ok(facts);
  assert.equal(facts.providerMinNanoUsd,1_310_000);
  assert.equal(facts.providerMaxNanoUsd,1_510_000);
  assert.equal(facts.tariffBasisNanoUsd,1_510_000);
  assert.equal(studioProviderReservation('gpt-6.1-terra' as never,1000,2200),12_250_000);
  const tariff=contract.studioAssistanceTariff('studio-terra-usd-2026-10-29-v1');
  assert.ok(tariff);assert.equal(tariff.noncachedInputUsdPerMillion,2.5);assert.equal(tariff.cachedInputUsdPerMillion,0.1);assert.equal(tariff.outputUsdPerMillion,10);
  assert.equal(quoteStudioAssistance(5_000_000,tariff.version).customerTotalCents,1);
  assert.equal(quoteStudioAssistance(5_000_000,'studio-sol-usd-2026-10-03-v1').customerTotalCents,2);
  assert.equal(readStudioUsage({input_tokens:1,input_tokens_details:{cached_tokens:0},output_tokens:1},'gpt-6.1-terra','priority'),null);
});

test('Terra is an explicit revisioned account choice',()=>{
  assert.equal(contract.studioAssistanceChoiceSchema.safeParse({action:'select_terra',expectedRevision:1}).success,true);
  assert.equal(contract.studioAssistanceChoiceSchema.safeParse({action:'select_terra'}).success,false);
});
