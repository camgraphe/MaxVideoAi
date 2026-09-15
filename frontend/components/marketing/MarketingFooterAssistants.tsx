import Image from 'next/image';
import { ArrowUpRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { MARKETING_NAV_ASSISTANTS } from '@/config/navigation';

type Copy = { title: string; body: string; cta: string; docs: string; anchors: Record<string, string> };
export function MarketingFooterAssistants({ copy }: { copy: Copy }) {
  if (!MARKETING_NAV_ASSISTANTS.length) return null;
  return <div className="marketing-footer-assistants">
    <div><p className="marketing-menu-caption">MaxVideoAI MCP</p><h2>{copy.title}</h2><p>{copy.body}</p></div>
    <div className="marketing-footer-assistants-access">
      <div className="marketing-footer-assistant-logos">{MARKETING_NAV_ASSISTANTS.map(client => <Link key={client.key} href={client.href} prefetch={false} aria-label={copy.anchors[client.key] ?? client.label}>
        {client.logo ? <Image src={client.logo} alt="" aria-hidden="true" width={25} height={25} /> : null}<span>{client.key === 'openclaw' ? 'OpenClaw' : client.label}</span>
      </Link>)}</div>
      <div className="marketing-footer-assistants-links"><Link href="/mcp" prefetch={false} className="marketing-footer-assistants-cta" data-analytics-event="cta_click" data-analytics-cta-name="footer_mcp" data-analytics-cta-location="marketing_footer">{copy.cta}<ArrowUpRight size={17} aria-hidden="true" /></Link>
      <Link href={{ pathname: '/docs/[slug]', params: { slug: 'mcp' } }} prefetch={false} className="marketing-footer-docs-link">{copy.docs}</Link></div>
    </div>
  </div>;
}
