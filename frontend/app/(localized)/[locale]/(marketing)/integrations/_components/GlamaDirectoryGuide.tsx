import '@/styles/marketing-mcp.css';
import '@/styles/marketing-integration-guides.css';
import Image from 'next/image';
import Link from 'next/link';
import type { AppLocale } from '@/i18n/locales';
import { localizePathFromEnglish } from '@/lib/i18n/paths';
import { getMcpDirectoryGuide } from '@/lib/mcp-integration-registry';
import { MCP_PRODUCTION_RESOURCE_URL } from '@/server/mcp/config';
import { guideLabels, guideMediaPath } from '../_content/guide-presentation';
import { glamaText } from '../_content/glama';
import { IntegrationGuideAccount } from './IntegrationGuideAccount';

export function GlamaDirectoryGuide({ locale, connectionAvailable }: {locale: AppLocale; connectionAvailable: boolean}) {
  const text = glamaText[locale];
  const label = guideLabels[locale];
  const listing = getMcpDirectoryGuide('glama');
  const inspector = new URL('https://glama.ai/mcp/inspector');
  inspector.search = new URLSearchParams({
    servers: JSON.stringify([{ authType: 'oauth', id: MCP_PRODUCTION_RESOURCE_URL, name: 'MaxVideoAI', url: MCP_PRODUCTION_RESOURCE_URL }]),
    tab: 'tools', tool: 'list_models',
  }).toString();
  return <div className="mcp-redesign mcp-guide"><header className="guide-opening"><div className="container-page">
    <nav aria-label={label.hub} className="guide-crumb"><Link href={localizePathFromEnglish(locale,'/mcp')}>{label.hub}</Link><span>/</span><span>Glama</span></nav>
    <div className="guide-opening-grid"><div className="guide-intro">
      <div className="guide-identity"><Image src={`${guideMediaPath}/glama.svg`} width={36} height={36} alt="" aria-hidden="true"/><span>{text.kind}</span></div>
      <h1>{text.heading}</h1><p className="guide-lede">{text.intro}</p><div className="guide-actions">
        <a className="mcp-button" href={listing.listingUrl}>{text.action} ↗</a><a className="guide-text-link" href="#first-video">{label.inspect} →</a>
      </div>{connectionAvailable && <IntegrationGuideAccount locale={locale}/>}</div>
      <aside className="guide-inspector"><h2>{text.details}</h2><dl>{[
        [text.publisher,'com.maxvideoai'],[text.transport,'Streamable HTTP'],[text.auth, 'OAuth'],
      ].map(([key,value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl><code>{MCP_PRODUCTION_RESOURCE_URL}</code></aside>
    </div></div></header>
    <section id="setup" className="mcp-entry mcp-section"><div className="container-page"><h2>{text.setup}</h2><ol className="mcp-entry-steps">
      {text.steps.map(([title,body],i) => <li key={title}><span aria-hidden="true">0{i+1}</span><h3>{title}</h3><p>{body}</p></li>)}
    </ol></div></section>
    <section id="first-video" className="guide-prompt"><div className="container-page guide-split"><div><h2>{text.tool}</h2><p>{text.toolHelp}</p></div>
      <div id="real-result" className="guide-prompt-card"><code>list_models</code><a className="guide-text-link" href={inspector.href}>{text.tool} ↗</a></div>
    </div></section>
    <aside className="container-page guide-bottom"><Link href={localizePathFromEnglish(locale,'/docs/mcp')}>{text.docs} →</Link></aside>
  </div>;
}
