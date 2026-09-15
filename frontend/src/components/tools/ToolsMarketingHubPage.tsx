import Image from 'next/image';
import { ArrowDown, ArrowUpRight } from 'lucide-react';
import type { Dictionary } from '@/lib/i18n/types';
import { resolveLocale, resolveDictionary } from '@/lib/i18n/server';
import { Link } from '@/i18n/navigation';
import { getToolDefinition } from '@/lib/toolbox/catalogue';
import { QUICK_TOOL_ART, WORKSHOP_ART } from './toolbox-art';
import { toolboxCopy } from './toolbox-copy';

type Content = Dictionary['toolMarketing']['hub'];
export async function ToolsMarketingHubPage({ content }: { content: Content }) {
  const locale=await resolveLocale();
  const {dictionary}=await resolveDictionary({locale});
  const c=dictionary.toolMarketing.journey;
  const labels=toolboxCopy(locale);
  const workshops=[
    {id:'character-builder',href:'/tools/character-builder',src:WORKSHOP_ART['character-builder']},
    {id:'angle',href:'/tools/angle',src:WORKSHOP_ART.angle},
    {id:'storyboard',href:getToolDefinition('storyboard')!.href,src:WORKSHOP_ART.storyboard},
  ] as const;
  const finishing=Object.entries(QUICK_TOOL_ART).map(([id,src])=>({id,src,href:id.startsWith('upscale')?'/tools/upscale':id==='background-removal'?'/tools/background-removal':getToolDefinition(id)!.href}));
  return <div className="tools-hub-redesign">
    <section className="tools-hub-hero"><div className="container-page">
      <div className="tools-hub-intro"><p className="tool-kicker">{content.hero.badge}</p><h1>{content.hero.title}</h1><p>{content.hero.body}</p><div className="tool-actions"><a href="#workshops" className="tool-primary-action">{c.browse}<ArrowDown size={17}/></a><Link href="/app/tools" prefetch={false}>{c.studio}<ArrowUpRight size={17}/></Link></div></div>
      <div className="tools-hub-montage" aria-hidden="true"><figure><Image unoptimized src={WORKSHOP_ART['character-builder']} alt="" width={1536} height={1024} priority sizes="(max-width: 700px) 90vw, 48vw"/><figcaption>01 / {c.character}</figcaption></figure><figure><Image unoptimized src={WORKSHOP_ART.angle} alt="" width={900} height={600} sizes="(max-width: 700px) 42vw, 24vw"/><figcaption>02 / {c.angle}</figcaption></figure><figure><Image unoptimized src={QUICK_TOOL_ART['upscale-image']} alt="" width={900} height={600} sizes="(max-width: 700px) 42vw, 24vw"/><figcaption>03 / {c.upscale}</figcaption></figure></div>
    </div></section>
    <section id="workshops" className="tools-hub-collection"><div className="container-page"><header><p className="tool-kicker">{labels.workshops}</p><h2>{c.workshops}</h2></header><div className="tools-hub-workshops">{workshops.map(tool=>{const t=labels.tools[tool.id];return <article key={tool.id}><Link href={tool.href} prefetch={false} className="tools-hub-card" data-analytics-event="tool_cta_click" data-analytics-tool-name={tool.id} data-analytics-tool-surface="public" data-analytics-cta-location="tools_hub_workshops"><div><Image unoptimized src={tool.src} alt={t.title} fill sizes="(max-width: 700px) 100vw, 33vw" loading="lazy" className={tool.id==='character-builder'?'object-contain':'object-cover'} /></div><small>{t.tag}</small><h3>{t.title}<ArrowUpRight size={19}/></h3><p>{t.body}</p><span>{tool.href.startsWith('/app')?c.open:c.learn}<ArrowUpRight size={15}/></span></Link></article>})}</div></div></section>
    <section className="tools-hub-finishing" id="finishing"><div className="container-page"><header><p className="tool-kicker">{labels.quick}</p><h2>{c.finishing}</h2></header><div className="tools-hub-quick">{finishing.map(tool=>{const t=labels.tools[tool.id as keyof typeof labels.tools];return <Link key={tool.id} href={tool.href} prefetch={false} className="tools-hub-quick-card" data-analytics-event="tool_cta_click" data-analytics-tool-name={tool.id} data-analytics-tool-surface="public" data-analytics-cta-location="tools_hub_finishing"><Image unoptimized src={tool.src} alt="" width={240} height={160} sizes="(max-width: 700px) 100px, 150px" loading="lazy"/><div><small>{t.tag}</small><h3>{t.title}</h3><p>{t.body}</p></div><ArrowUpRight size={17}/></Link>})}</div></div></section>
    <section className="tools-hub-start"><div className="container-page"><div><p className="tool-kicker">MaxVideoAI</p><h2>{c.start}</h2><p>{c.startBody}</p><div className="tool-actions"><Link href="/app/image" className="tool-primary-action" prefetch={false}>{c.image}<ArrowUpRight size={17}/></Link><Link href="/app/audio" prefetch={false}>{c.audio}<ArrowUpRight size={17}/></Link></div></div><Image unoptimized src="/assets/tools/redesign/character-portrait-v1.webp" alt={c.proof} width={900} height={1125} sizes="(max-width: 700px) 80vw, 32vw" loading="lazy"/></div></section>
  </div>;
}
