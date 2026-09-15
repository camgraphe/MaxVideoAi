import Image from 'next/image';
import type { McpPublicationState } from '@/lib/mcp-publication';
import type { IntegrationPageCopy } from '../_lib/integration-copy';
export function IntegrationWorkflowSection({copy,publication}: {copy:IntegrationPageCopy;publication:McpPublicationState}) {
 const steps=publication.showPaidGenerationClaim?copy.workflow.liveSteps:copy.workflow.previewSteps;
 return <section className="mcp-integration-workflow mcp-section"><div className="container-page"><div className="mcp-section-heading"><div><p className="mcp-eyebrow">{copy.workflow.eyebrow}</p><h2>{copy.workflow.title}</h2></div><p>{copy.workflow.intro}</p></div><div className="mcp-integration-workflow-grid"><div className="mcp-workflow-art"><Image src="/hero/best-for-image-to-video.webp" alt="" width={800} height={650} sizes="(min-width: 1024px) 40vw, 100vw" loading="lazy"/><span>MaxVideoAI × {copy.clientLabel}</span></div><ol>{steps.map((step,index)=><li key={step.title}><span>0{index+1}</span><div><h3>{step.title}</h3><p>{step.body}</p></div></li>)}</ol></div><div className="mcp-reference-note"><h3>{copy.references.title}</h3><p>{publication.showReferenceClaim?copy.references.liveBody:copy.references.gatedBody}</p></div></div></section>;
}
