import Link from 'next/link';
import { Plus, ArrowUpRight, Unplug } from 'lucide-react';
import type { AppLocale } from '@/i18n/locales';
import { getMcpDocsLink } from '@/lib/mcp-internal-links';
import type { McpPublicationState } from '@/lib/mcp-publication';
import type { IntegrationPageCopy } from '../_lib/integration-copy';
export function IntegrationTroubleshootingSection({copy,locale,publication}: {copy:IntegrationPageCopy;locale:AppLocale;publication:McpPublicationState}) {
 const docs=getMcpDocsLink(locale,'integration',publication);
 return <section className="mcp-faq mcp-section"><div className="container-page mcp-faq-grid"><div><p className="mcp-eyebrow">{copy.troubleshooting.eyebrow}</p><h2>{copy.troubleshooting.title}</h2><p className="mcp-lead">{copy.troubleshooting.intro}</p><aside className="mcp-disconnect"><Unplug size={23}/><h3>{copy.disconnect.title}</h3><p>{copy.disconnect.body}</p><ol>{copy.disconnect.steps.map(step=><li key={step}>{step}</li>)}</ol></aside></div><div>{copy.troubleshooting.items.map(item=><details key={item.question} name="integration-faq" data-faq-item><summary>{item.question}<Plus size={19} aria-hidden="true"/></summary><p>{item.answer}{item.link ? <> <a href={item.link.href} target="_blank" rel="noreferrer">{item.link.label}</a></> : null}</p></details>)}<div className="mcp-faq-resources">{docs?<Link href={docs.href}>{docs.label}<ArrowUpRight size={15}/></Link>:null}<Link href={copy.support.href}>{copy.support.label}<ArrowUpRight size={15}/></Link></div></div></div></section>;
}
