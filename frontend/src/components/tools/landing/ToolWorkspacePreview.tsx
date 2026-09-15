import Image from 'next/image';
import { ArrowUpRight, Maximize2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { resolveDictionary } from '@/lib/i18n/server';
import { TOOL_WORKSPACE_CAPTURES, type MarketingToolId } from './tool-workspace-assets';

export async function ToolWorkspacePreview({ tool, title, body }: { tool: MarketingToolId; title: string; body?: string }) {
  const { dictionary } = await resolveDictionary();
  const c = dictionary.toolMarketing.journey;
  const src=TOOL_WORKSPACE_CAPTURES[tool];
  return <section className="tool-workspace-section" id="workspace"><div className="container-page">
    <header><div><p className="tool-kicker">{c.workspace}</p><h2>{title}</h2>{body?<p>{body}</p>:null}</div><Link href={`/app/tools/${tool}`} prefetch={false}>{c.open}<ArrowUpRight size={18} /></Link></header>
    <figure><a href={src} target="_blank" rel="noreferrer" aria-label={c.full}><Image unoptimized src={src} alt={`${title} — ${c.capture}`} width={1316} height={820} sizes="(max-width: 700px) 100vw, 1120px" loading="lazy" className="tool-workspace-image"/><span><Maximize2 size={15}/>{c.full}</span></a><figcaption>{c.capture}</figcaption></figure>
  </div></section>;
}
