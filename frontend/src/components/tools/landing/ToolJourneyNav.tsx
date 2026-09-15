import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { resolveDictionary } from '@/lib/i18n/server';
import type { MarketingToolId } from './tool-workspace-assets';

export async function ToolJourneyNav({ active }: { active: MarketingToolId }) {
  const { dictionary } = await resolveDictionary();
  const c = dictionary.toolMarketing.journey;
  const items = [['character-builder', c.character], ['angle', c.angle], ['upscale', c.upscale], ['background-removal', c.background]];
  return <nav className="tool-journey-nav" aria-label={c.nav}><div className="container-page">
    <Link href="/tools"><ArrowLeft size={14} />{c.all}</Link>
    <div>{items.map(([id,label]) => <Link key={id} href={`/tools/${id}`} aria-current={id===active?'page':undefined}>{label}</Link>)}</div>
    <Link className="tool-journey-open" href={`/app/tools/${active}`} prefetch={false}>{c.open}<ArrowUpRight size={15} /></Link>
  </div></nav>;
}
