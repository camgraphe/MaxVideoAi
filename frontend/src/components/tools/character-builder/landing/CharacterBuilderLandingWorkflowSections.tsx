import Image from 'next/image';
import { Card } from '@/components/ui/Card';
import {
  SHEET_IMAGE_CLASSNAME,
  WORKFLOW_CHARACTER_SHEET_ASSET,
  WORKFLOW_NANO_BANANA_ASSET,
  WORKFLOW_VIDEO_START_FRAME_ASSET,
  type CharacterBuilderLandingContent,
} from './character-builder-landing-assets';
import { HowItWorksPill, LinkChip, SectionHeader } from './CharacterBuilderLandingPrimitives';

export function CharacterBuilderOutputsWorkflowSection({ content }: { content: CharacterBuilderLandingContent }) {
  const portraitOutputCard = content.outputsWorkflow.cards[0]!;
  const sheetOutputCard = content.outputsWorkflow.cards[1]!;
  const videoPrepOutputCard = content.outputsWorkflow.cards[2]!;
  const portraitOutputPill = portraitOutputCard.pills[0]!;
  const videoPrepOutputPill = videoPrepOutputCard.pills[0]!;
  const workflowSheetStep = content.outputsWorkflow.workflow.steps[0]!;
  const workflowStillStep = content.outputsWorkflow.workflow.steps[1]!;
  const workflowVideoStep = content.outputsWorkflow.workflow.steps[2]!;

  return (
    <section className="border-t border-hairline bg-bg section">
      <div className="container-page max-w-6xl stack-gap-lg">
        <SectionHeader
          eyebrow={content.outputsWorkflow.eyebrow}
          title={content.outputsWorkflow.title}
          body={<p>{content.outputsWorkflow.body}</p>}
        />
        <div className="character-builder-panel-soft rounded-[34px] border border-hairline bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,249,252,0.96))] p-4 shadow-[0_28px_80px_rgba(15,23,42,0.05)] sm:p-5 lg:p-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)_minmax(0,0.96fr)] lg:items-stretch">
            <Card className="tool-surface-card overflow-hidden border-hairline bg-white p-0 shadow-[0_18px_42px_rgba(15,23,42,0.06)]">
              <div className="p-4">
                <div className="relative aspect-[4/4.8] overflow-hidden rounded-[22px] bg-[linear-gradient(180deg,#fff4ec,#ffffff)]">
                  <Image
                    src="https://media.maxvideoai.com/marketing/marketing/45c7a9ef-3023-4f30-95f2-5a4598f7e8ba.png"
                    alt={portraitOutputCard.imageAlt}
                    fill
                    sizes="(max-width: 1280px) 100vw, 320px"
                    className="object-cover object-center"
                  />
                </div>
              </div>
              <div className="stack-gap-sm px-5 pb-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-muted">{portraitOutputCard.eyebrow}</p>
                <h3 className="text-xl font-semibold text-text-primary">{portraitOutputCard.title}</h3>
                <p className="text-sm leading-6 text-text-secondary">{portraitOutputCard.body}</p>
                <div className="pt-1">
                  <HowItWorksPill>{portraitOutputPill}</HowItWorksPill>
                </div>
              </div>
            </Card>

            <Card className="tool-surface-card tool-surface-card--warm overflow-hidden border-[1.5px] border-[#f1d1bb] bg-[linear-gradient(180deg,#fff8f3,#fffefc)] p-0 shadow-[0_24px_60px_rgba(196,91,45,0.12)]">
              <div className="flex items-center justify-between px-5 pt-5">
                <div className="inline-flex rounded-full border border-[#f4d8c6] bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#b96135]">
                  {sheetOutputCard.badge}
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b96135]">{sheetOutputCard.stats}</span>
              </div>
              <div className="px-5 pb-5 pt-4">
                <div className="relative aspect-[16/11] overflow-hidden rounded-[24px] bg-[#f7f1ea]">
                  <Image
                    src="https://media.maxvideoai.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/5daf21e0-e99a-42e5-891a-eca3ba162344.webp"
                    alt={sheetOutputCard.imageAlt}
                    fill
                    sizes="(max-width: 1280px) 100vw, 480px"
                    className={SHEET_IMAGE_CLASSNAME}
                  />
                </div>
              </div>
              <div className="stack-gap-sm px-5 pb-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-muted">{sheetOutputCard.eyebrow}</p>
                <h3 className="text-2xl font-semibold tracking-tight text-text-primary">{sheetOutputCard.title}</h3>
                <p className="text-sm leading-6 text-text-secondary">{sheetOutputCard.body}</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {sheetOutputCard.pills.map((item) => (
                    <HowItWorksPill key={item}>{item}</HowItWorksPill>
                  ))}
                </div>
              </div>
            </Card>

            <Card className="overflow-hidden border-slate-800 bg-[linear-gradient(180deg,#0b1320,#101b2b)] p-0 text-white shadow-[0_26px_64px_rgba(15,23,42,0.16)]">
              <div className="p-4">
                <div className="relative aspect-[16/11] overflow-hidden rounded-[22px] border border-white/10 bg-black">
                  <Image
                    src="https://media.maxvideoai.com/marketing/marketing/534f6c60-b23e-4a9b-9064-01d80350d1ec.jpg"
                    alt={videoPrepOutputCard.imageAlt}
                    fill
                    sizes="(max-width: 1280px) 100vw, 360px"
                    className="object-cover object-center"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#08111c]/80 via-transparent to-transparent" />
                  <div className="absolute bottom-3 right-3 rounded-full border border-white/10 bg-black/45 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-100">
                    {videoPrepOutputCard.badge}
                  </div>
                </div>
              </div>
              <div className="stack-gap-sm px-5 pb-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">{videoPrepOutputCard.eyebrow}</p>
                <h3 className="text-xl font-semibold text-white">{videoPrepOutputCard.title}</h3>
                <p className="text-sm leading-6 text-slate-300">{videoPrepOutputCard.body}</p>
                <div className="pt-1">
                  <HowItWorksPill>{videoPrepOutputPill}</HowItWorksPill>
                </div>
              </div>
            </Card>
          </div>

          <div className="mt-6 rounded-[34px] border border-slate-800 bg-[linear-gradient(180deg,#0a1320,#101d2d)] p-5 text-white shadow-[0_32px_90px_rgba(15,23,42,0.16)] lg:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">{content.outputsWorkflow.workflow.label}</p>
                <p className="mt-2 text-lg font-semibold tracking-[0.1em] text-white">{content.outputsWorkflow.workflow.title}</p>
              </div>
              <p className="text-sm font-semibold tracking-[0.12em] text-slate-200">{content.outputsWorkflow.workflow.chainLabel}</p>
            </div>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,0.82fr)_minmax(0,1.36fr)] lg:items-stretch">
              <div className="rounded-[22px] border border-white/10 bg-[#111a28] p-3">
                <div className="relative aspect-[16/12] overflow-hidden rounded-[18px] bg-[#dfe8f4]">
                  <Image
                    src={WORKFLOW_CHARACTER_SHEET_ASSET.url}
                    alt={workflowSheetStep.imageAlt}
                    fill
                    sizes="(min-width: 1024px) 280px, 100vw"
                    className={SHEET_IMAGE_CLASSNAME}
                  />
                </div>
                <div className="mt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">{workflowSheetStep.label}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{workflowSheetStep.body}</p>
                </div>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-[#111a28] p-3">
                <div className="relative aspect-[16/12] overflow-hidden rounded-[18px] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.14),transparent_55%),linear-gradient(135deg,rgba(244,127,94,0.26),rgba(76,132,255,0.16))]">
                  <Image
                    src={WORKFLOW_NANO_BANANA_ASSET.url}
                    alt={workflowStillStep.imageAlt}
                    fill
                    sizes="(min-width: 1024px) 280px, 100vw"
                    className="object-cover object-center"
                  />
                </div>
                <div className="mt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">{workflowStillStep.label}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{workflowStillStep.body}</p>
                </div>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-[#0f1826] p-3">
                <div className="overflow-hidden rounded-[18px] border border-white/10 bg-black">
                  <video
                    className="aspect-[16/12] w-full object-cover"
                    controls
                    playsInline
                    preload="metadata"
                    poster={WORKFLOW_VIDEO_START_FRAME_ASSET.url}
                  >
                    <source src={WORKFLOW_VIDEO_START_FRAME_ASSET.videoUrl} type="video/mp4" />
                  </video>
                </div>
                <div className="mt-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">{workflowVideoStep.label}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{workflowVideoStep.body}</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200">
                    {content.outputsWorkflow.workflow.videoBadge}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              {content.outputsWorkflow.workflow.links.map((link) => (
                <LinkChip key={link.href} href={link.href} label={link.label} dark />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
