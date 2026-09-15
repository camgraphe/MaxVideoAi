import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight } from 'lucide-react';
import type { AppLocale } from '@/i18n/locales';
import { getMcpEditorialCopy } from '@/components/marketing/mcp/mcp-editorial-copy';
import type { McpHostProof } from '../_lib/mcp-host-proof';
import { McpHostProofCard } from './McpHostProofCard';
export function McpEditorialSections({locale,hostProof}: {locale:AppLocale;hostProof:McpHostProof|null}) {
 const copy=getMcpEditorialCopy(locale);const prefix=locale==='en'?'':`/${locale}`;
 return <>
   <section className="mcp-workflow mcp-section"><div className="container-page"><div className="mcp-section-heading"><div><p className="mcp-eyebrow">{copy.workflowEyebrow}</p><h2>{copy.workflowTitle}</h2></div><p>{copy.workflowIntro}</p></div><div className="mcp-workflow-grid">{copy.stages.map((stage,index)=><article key={stage}><div className="mcp-workflow-image"><Image src={['/hero/best-for-image-to-video.webp','/hero/best-for-fast-drafts-city.webp','/hero/best-for-product-ads.webp'][index]} alt="" aria-hidden="true" width={600} height={340} sizes="(min-width: 768px) 31vw, 100vw" loading="lazy" /><span>0{index+1}</span></div><h3>{copy.stageTitles[index]}</h3><p>{copy.stageBodies[index]}</p></article>)}</div><div className="mcp-resource-links"><Link href={`${prefix}/${locale==='fr'?'galerie':locale==='es'?'galeria':'examples'}`}>{copy.examples}<ArrowUpRight size={16}/></Link><Link href={`${prefix}/${locale==='fr'?'comparatif':locale==='es'?'comparativa':'ai-video-engines'}`}>{copy.models}<ArrowUpRight size={16}/></Link><Link href={`${prefix}/${locale==='fr'?'tarifs':locale==='es'?'precios':'pricing'}`}>{copy.pricing}<ArrowUpRight size={16}/></Link></div></div></section>
   {hostProof ? <section className="mcp-proof mcp-section" id="real-result"><div className="container-page mcp-proof-grid"><div><p className="mcp-eyebrow">{copy.proofEyebrow}</p><h2>{copy.proofTitle}</h2><p className="mcp-lead">{copy.proofBody}</p><Link href={`${prefix}/integrations/claude`.replace('/es/integrations/','/es/integraciones/')} className="mcp-button">{copy.guide} Claude<ArrowUpRight size={17}/></Link></div><McpHostProofCard proof={hostProof}/></div></section> : null}

 </>;
}
