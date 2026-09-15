import { ShieldCheck, BadgeDollarSign, Unplug } from 'lucide-react';
import type { AppLocale } from '@/i18n/locales';
import { getMcpEditorialCopy } from './mcp-editorial-copy';
export function McpTrustStrip({locale}: {locale: AppLocale}) {
  const copy = getMcpEditorialCopy(locale); const icons = [ShieldCheck, BadgeDollarSign, Unplug];
  return <section className="mcp-trust mcp-section"><div className="container-page"><div className="mcp-section-heading"><div><p className="mcp-eyebrow">{copy.trustEyebrow}</p><h2>{copy.trustTitle}</h2></div></div><div className="mcp-trust-grid">{copy.trust.map((item,index) => {const Icon = icons[index];return <article key={item.title}><Icon size={24} strokeWidth={1.4} aria-hidden="true" /><h3>{item.title}</h3><p>{item.body}</p></article>;})}</div></div></section>;
}
