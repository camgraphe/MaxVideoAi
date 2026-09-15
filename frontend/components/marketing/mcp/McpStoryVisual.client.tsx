'use client';
import { useId, useState } from 'react';
import Image from 'next/image';
import { ArrowRight, Check, MessageSquare, SlidersHorizontal, Film } from 'lucide-react';
import type { AppLocale } from '@/i18n/locales';
import type { McpIntegrationId } from '@/lib/mcp-integration-registry';
import { getMcpEditorialCopy } from './mcp-editorial-copy';
import { McpIntegrationMark } from './McpIntegrationMark';

export function McpStoryVisual({ locale, client, priority = false }: { locale: AppLocale; client?: McpIntegrationId; priority?: boolean }) {
  const copy = getMcpEditorialCopy(locale);
  const [stage, setStage] = useState(0);
  const id = useId();
  const cover = client === 'chatgpt' ? '/hero/best-for-fast-drafts-city.webp' : client === 'n8n' ? '/hero/best-for-product-ads.webp' : client === 'openclaw' ? '/hero/showcase-minimax-h3-max-12s.webp' : '/hero/best-for-cinematic-realism.webp';
  const icons = [MessageSquare, SlidersHorizontal, Film];
  return <figure className="mcp-story" data-stage={stage}>
    <div className="mcp-story-scene">
      <Image src={cover} alt="" aria-hidden="true" width={1200} height={615} sizes="(min-width: 1024px) 58vw, 100vw" priority={priority} fetchPriority={priority ? 'high' : 'auto'} className="mcp-story-image" />
      <div className="mcp-story-top"><span>{copy.visualLabel}</span><span className="mcp-story-connection">{client ? <McpIntegrationMark integration={client} size={18} className="h-[18px] w-[18px]" /> : <MessageSquare size={17} />}<ArrowRight size={13} /><Image src="/assets/branding/logo-mark.svg" alt="MaxVideoAI" width={19} height={19} /></span></div>
      {client === 'n8n' ? <div className="mcp-workflow-nodes" aria-label={copy.visualLabel}>{[locale === 'es' ? 'Brief' : 'Brief', locale === 'fr' ? 'Validation' : locale === 'es' ? 'Aprobación' : 'Approval', locale === 'fr' ? 'Vidéo' : 'Video'].map((label,index) => {const Icon=icons[index];return <div key={label}><span><Icon size={21}/></span><strong>{label}</strong>{index<2?<ArrowRight size={16} aria-hidden="true"/>:null}</div>;})}</div> : <div className="mcp-story-message"><span className="mcp-story-message-icon"><MessageSquare size={18} /></span><p>{copy.prompt}</p><ArrowRight size={20} aria-hidden="true" /></div>}
      <div className="mcp-story-caption" id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${stage}`}>
        <span className="mcp-story-count">0{stage + 1} / 03</span><h3>{copy.stageTitles[stage]}</h3><p>{copy.stageBodies[stage]}</p>
      </div>
    </div>
    <div className="mcp-story-tabs" role="tablist" aria-label={copy.visualLabel}>{copy.stages.map((label, index) => { const Icon = icons[index]; return <button key={label} type="button" role="tab" id={`${id}-${index}`} aria-controls={`${id}-panel`} aria-selected={stage === index} tabIndex={stage === index ? 0 : -1} onClick={() => setStage(index)} onKeyDown={(event) => { const next = event.key === 'ArrowRight' ? (index + 1) % 3 : event.key === 'ArrowLeft' ? (index + 2) % 3 : event.key === 'Home' ? 0 : event.key === 'End' ? 2 : null; if (next !== null) { event.preventDefault(); setStage(next); document.getElementById(`${id}-${next}`)?.focus(); } }}><Icon size={16} aria-hidden="true" /><span>{label}</span>{stage === index ? <Check size={14} aria-hidden="true" /> : <span className="mcp-tab-number">0{index + 1}</span>}</button>; })}</div>
  </figure>;
}
