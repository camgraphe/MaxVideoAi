import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { AppLocale } from '@/i18n/locales';
import { getMcpIntegrationIds, getMcpIntegration, getMcpPublicIntegrationIds } from '@/lib/mcp-integration-registry';
import { getMcpEditorialCopy } from './mcp-editorial-copy';
import { McpIntegrationMark } from './McpIntegrationMark';

export function McpIntegrationCards({locale, compact = false}: {locale: AppLocale; compact?: boolean}) {
  const copy = getMcpEditorialCopy(locale);
  const ids = getMcpPublicIntegrationIds();
  return <section className={`mcp-integrations mcp-section ${compact ? 'mcp-integrations-compact' : ''}`} id="integrations">
    <div className="container-page">
      <div className="mcp-section-heading"><div><p className="mcp-eyebrow">{copy.clientsEyebrow}</p><h2>{copy.clientsTitle}</h2></div><p>{copy.clientsIntro}</p></div>
      <div className="mcp-integration-grid">{ids.map(id => {
        const integration = getMcpIntegration(id);
        const key = id as keyof typeof copy.modes;
        const href = `${locale === 'en' ? '' : `/${locale}`}${integration.englishPath.replace('/integrations/', locale === 'es' ? '/integraciones/' : '/integrations/')}`;
        return <Link key={id} href={href} className="mcp-integration-card" data-client={id} prefetch={false}>
          <div className="mcp-integration-card-top"><McpIntegrationMark integration={id} size={34} className="h-[34px] w-[34px]" /><ArrowUpRight size={19} aria-hidden="true" /></div>
          <span className="mcp-integration-mode">{copy.modes[key]}</span><h3>{integration.label}</h3><p>{copy.benefits[key]}</p><span className="mcp-integration-limit">{copy.limits[key]}</span><span className="mcp-integration-guide">{copy.guide}<ArrowUpRight size={14} aria-hidden="true" /></span>
        </Link>;
      })}</div>
      {!compact ? <div className="mcp-preparing"><div><strong>{copy.preparing}</strong><p>{copy.preparingNote}</p></div><div>{getMcpIntegrationIds().filter(id => getMcpIntegration(id).site.publication === 'hidden').map(id => <span key={id}><McpIntegrationMark integration={id} size={20} className="h-5 w-5" />{getMcpIntegration(id).label}</span>)}</div></div> : null}
    </div>
  </section>;
}
