import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { AppLocale } from '@/i18n/locales';
import { getMcpDirectoryGuide, getMcpIntegration, getMcpPublicIntegrationIds } from '@/lib/mcp-integration-registry';
import { getMcpDocsLink } from '@/lib/mcp-internal-links';
import { localizePathFromEnglish } from '@/lib/i18n/paths';
import type { McpPublicationState } from '@/lib/mcp-publication';
import { getMcpEditorialCopy } from '@/components/marketing/mcp/mcp-editorial-copy';
import { McpIntegrationMark } from '@/components/marketing/mcp/McpIntegrationMark';
import { mcpHubCopy } from '@/components/marketing/mcp/mcp-hub-copy';

export function McpHubDirectory({ locale, publication }: { locale: AppLocale; publication: McpPublicationState }) {
  const labels = mcpHubCopy[locale];
  const editorial = getMcpEditorialCopy(locale);
  const docs = getMcpDocsLink(locale, 'hub', publication);
  const cards = getMcpPublicIntegrationIds().map(id => {
    const integration = getMcpIntegration(id);
    return {
      id, name: integration.label, href: localizePathFromEnglish(locale, integration.englishPath),
      type: editorial.modes[id as keyof typeof editorial.modes],
      icon: id === 'codex'
        ? <Image src="/media/mcp/hub-redesign/codex.png" width={25} height={25} alt="" aria-hidden="true"/>
        : <McpIntegrationMark integration={id} size={23} className="h-[23px] w-[23px]"/>,
    };
  });
  const glama = getMcpDirectoryGuide('glama');
  const guides = glama.site.publication === 'hidden' ? cards : [
    ...cards, { id: 'glama', name: glama.label, type: labels.glama, href: localizePathFromEnglish(locale, glama.englishPath),
      icon: <Image src="/media/mcp/hub-redesign/glama.svg" width={24} height={24} alt="" aria-hidden="true"/> },
  ];
  return <section id="integrations" className="hub-directory">
    <div className="hub-directory-title"><h2>{labels.directory}</h2>{docs && <Link href={docs.href}>{labels.docs} ↗</Link>}</div>
    <div className="hub-directory-grid">
      {guides.map(item => <Link key={item.id} href={item.href} prefetch={false} className="hub-tile" data-client={item.id}>
        <span className="hub-tile-logo">{item.icon}</span><span className="hub-tile-type"><strong>{item.name}</strong><small>{item.type}</small></span>
        <ArrowUpRight size={15} className="hub-tile-arrow" aria-hidden="true"/>
      </Link>)}
    </div>
    {docs && <p className="hub-other">{labels.other} <Link href={docs.href + '#endpoint'}>{labels.server} →</Link></p>}
  </section>;
}
