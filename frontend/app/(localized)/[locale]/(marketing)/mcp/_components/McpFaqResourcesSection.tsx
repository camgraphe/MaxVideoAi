import Link from 'next/link';
import { Plus, ArrowUpRight } from 'lucide-react';
import type { AppLocale } from '@/i18n/locales';
import type { McpPublicationState } from '@/lib/mcp-publication';
import { getMcpDocsLink } from '@/lib/mcp-internal-links';
import { getMcpEditorialCopy } from '@/components/marketing/mcp/mcp-editorial-copy';
import type { McpPageCopy } from '../_lib/mcp-page-types';
import { formatMcpCheckpointDate } from '../_lib/mcp-compatibility';
export function McpFaqResourcesSection({copy,lastChecked,locale,publication}: {copy:McpPageCopy;lastChecked:string;locale:AppLocale;publication:McpPublicationState}) {
 const editorial=getMcpEditorialCopy(locale);const docs=getMcpDocsLink(locale,'hub',publication);
 const existing=Object.entries(copy.answers.items).map(([key,item])=>({question:item.title,answer:publication[key==='references'?'showReferenceClaim':'connectionAvailable']?item.liveBody:item.gatedBody}));
 const faq=publication.connectionAvailable&&publication.showPaidGenerationClaim ? [...editorial.faq,...existing] : existing;
 return <section className="mcp-faq mcp-section"><div className="container-page mcp-faq-grid"><div><p className="mcp-eyebrow">MCP · MAXVIDEOAI</p><h2>{editorial.faqTitle}</h2><p className="mcp-check-date">{copy.answers.updatedLabel} : <time dateTime={lastChecked}>{formatMcpCheckpointDate(locale,lastChecked)}</time></p><div className="mcp-faq-resources">{docs?<Link href={docs.href}>{editorial.docs}<ArrowUpRight size={15}/></Link>:null}<a href={copy.answers.repositoryHref} target="_blank" rel="noreferrer">{editorial.repo}<ArrowUpRight size={15}/></a><Link href={copy.trust.support.href}>{editorial.support}<ArrowUpRight size={15}/></Link></div></div><div>{faq.map(item=><details key={item.question} name="mcp-faq" data-faq-item><summary>{item.question}<Plus size={19} aria-hidden="true"/></summary><p>{item.answer}</p></details>)}</div></div></section>;
}
