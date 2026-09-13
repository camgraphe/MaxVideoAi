import { validateToolBlock, type ToolBlock } from '@/lib/toolbox/contract';
import { isFinishingToolId } from '@/lib/toolbox/finishing';
import { computeCanonicalFinishingBillingSnapshot } from '@/server/pricing/quote-billing';
import { estimateFinishingVendorBudget, prepareFinishingProvider } from './finishing-providers';
import { resolveFinishingSource } from './finishing-source';
import { readToolVideoMetadata } from './toolbox-video-metadata';
import { isFinishingProfileReleased } from './finishing-release';

export async function prepareFinishingTool(value: unknown, userId: string) {
  const block: ToolBlock = validateToolBlock(value);
  if (!isFinishingToolId(block.toolId)) throw new Error('Unsupported finishing tool.');
  const source = await resolveFinishingSource(userId, block.inputs[0]);
  const facts = await readToolVideoMetadata(source.url, userId);
  const prepared = prepareFinishingProvider(block.toolId, block.settings, source.url, facts);
  const vendorBudgetUsd = estimateFinishingVendorBudget(block.toolId, prepared.settings, facts);
  const pricing = await computeCanonicalFinishingBillingSnapshot({ toolId: block.toolId, quality: prepared.settings.quality, vendorBudgetUsd, durationSec: facts.durationSec, profileId: prepared.profile.id, pricingSource: prepared.profile.pricingSource });
  return { block, source, facts, ...prepared, pricing, released: isFinishingProfileReleased(prepared.profile, prepared.settings.quality) };
}
export type PreparedFinishingTool = Awaited<ReturnType<typeof prepareFinishingTool>>;
