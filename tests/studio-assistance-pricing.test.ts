import assert from 'node:assert/strict';
import test from 'node:test';

test('assistance tariff aggregates subcent calls before customer rounding and never invents missing usage', async () => {
  const pricing = await import('../frontend/server/pricing/quote-studio-assistance').catch(() => null);
  assert.ok(pricing, 'Studio requires a canonical assistance quote owner');
  assert.equal(pricing.quoteStudioAssistance(100_000).customerTotalCents, 1);
  assert.equal(pricing.quoteStudioAssistance(200_000).customerTotalCents, 1);
  assert.equal(pricing.quoteStudioAssistance(5_000_000).customerTotalCents, 1);
  assert.equal(pricing.quoteStudioAssistance(50_000_000).customerTotalCents, 10);
  assert.equal(pricing.quoteStudioAssistance(5_000_000,'studio-sol-usd-2026-10-03-v1').customerTotalCents,2,'Historical settlements retain the original tariff');
  const facts = await import('../frontend/src/server/studio/assistance-provider-facts');
  const actual = facts.readStudioUsage({input_tokens: 1000,input_tokens_details: {cached_tokens: 200},output_tokens: 100,output_tokens_details: {reasoning_tokens: 50}},'gpt-6.1-sol','default');
  assert.deepEqual(actual, {inputTokens: 1000,cachedTokens: 200,cacheWriteTokens: null,outputTokens: 100,reasoningTokens: 50,providerMinNanoUsd: 2_620_000,providerMaxNanoUsd: 3_020_000,tariffBasisNanoUsd: 3_020_000});
  assert.equal(facts.readStudioUsage(null,'gpt-6.1-sol','default'),null);
  assert.equal(facts.readStudioUsage({input_tokens: 1,output_tokens: 1,input_tokens_details: {cached_tokens: 2}},'gpt-6.1-sol','default'),null);
  assert.equal(facts.readStudioUsage({input_tokens: 1,output_tokens: 1,input_tokens_details: {cached_tokens: 0}},'gpt-6.1-sol','priority'),null);
});

test('billing remains disabled until reviewed activation and unsupported regional endpoints cannot use global rates',async()=>{
 const {studioAssistancePolicy}=await import('../frontend/src/server/studio/assistance-policy');
 assert.equal(studioAssistancePolicy({}).enabled,false);
 assert.equal(studioAssistancePolicy({NODE_ENV:'production',STUDIO_ASSISTANCE_ENABLED:'true'}).enabled,false);
 const approved={NODE_ENV:'production',STUDIO_ASSISTANCE_ENABLED:'true',STUDIO_ASSISTANCE_APPROVED_POLICY:'studio-beta-2026-10-03-v1'};
 assert.equal(studioAssistancePolicy(approved).enabled,false,'The previous production approval cannot activate packs');
 assert.equal(studioAssistancePolicy({...approved,STUDIO_ASSISTANCE_APPROVED_POLICY:'studio-credits-2026-10-05-v2'}).enabled,true);
 assert.equal(studioAssistancePolicy({...approved,OPENAI_BASE_URL:'https://eu.api.openai.com/v1'}).enabled,false);
});
