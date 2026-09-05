import Image from 'next/image';
import { ArrowRight, ChevronLeft, ChevronRight, Clapperboard, ClipboardCheck, Menu, MessageSquareText, UserRound } from 'lucide-react';
import type { AppLocale } from '@/i18n/locales';
import { MCP_PROJECT_DEMO_COPY, type McpProjectDemoCopy } from '../_lib/mcp-project-demo-copy';
import { MCP_PROJECT_DEMO_MEDIA } from '../_lib/mcp-project-demo-media';
import { McpScrollVideo } from './McpScrollVideo.client';

function ProductWindow({ copy, motion = false }: { copy: McpProjectDemoCopy; motion?: boolean }) {
  const media = MCP_PROJECT_DEMO_MEDIA;
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#090c10] text-white shadow-lg">
      <div aria-hidden="true" className="flex h-8 items-center gap-2 border-b border-white/10 px-3">
        <span className="flex gap-1"><span className="h-1.5 w-1.5 rounded-full bg-red-400" /><span className="h-1.5 w-1.5 rounded-full bg-yellow-300" /><span className="h-1.5 w-1.5 rounded-full bg-green-400" /></span>
        <ChevronLeft className="ml-3 h-3 w-3 text-white/50" /><ChevronRight className="h-3 w-3 text-white/50" />
        <span className="ml-3 h-3 w-2/5 rounded bg-white/10" />
      </div>
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-xs">
        <span>{copy.product}</span><Menu aria-hidden="true" className="h-4 w-4" />
      </div>
      <div className="relative aspect-[1.22] overflow-hidden">
        {motion && media.videoSrc ? (
          <McpScrollVideo
            label={copy.videoAlt}
            scrollHint={copy.scrollHint}
            playLabel={copy.playLabel}
            resumeScrollLabel={copy.resumeScrollLabel}
            poster={media.posterSrc}
            src={media.videoSrc}
          />
        ) : (
          <Image
            src={motion ? media.posterSrc : media.photoSrc}
            alt={motion ? copy.videoAlt : copy.photoAlt}
            fill
            sizes="(min-width: 1024px) 31vw, (min-width: 640px) 540px, 100vw"
            className="object-cover object-[35%_center]"
          />
        )}
        <div className="pointer-events-none absolute left-4 top-6 w-[39%] text-white [text-shadow:0_1px_8px_#000] sm:left-5 sm:top-8">
          <p className="text-lg font-semibold leading-tight sm:text-xl xl:text-[28px]">{copy.productHeadline}</p>
          <p className="mt-3 text-xs leading-5 xl:text-sm">{copy.productDescription}</p>
          <span className="mt-4 inline-block rounded-full bg-[#dcff00] px-4 py-2 text-[11px] font-semibold text-black [text-shadow:none]">{copy.discover}</span>
        </div>
        {!motion ? (
          <div className="absolute bottom-4 left-4 flex w-[39%] flex-col items-center gap-2 rounded-xl border border-dashed border-white/45 bg-black/65 px-2 py-3 text-center text-[10px] sm:left-5">
            <Clapperboard aria-hidden="true" className="h-6 w-6 text-[#dcff00]" />{copy.videoSlot}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Conversation({ copy }: { copy: McpProjectDemoCopy }) {
  return (
    <div className="flex h-full min-h-[365px] flex-col rounded-2xl border border-[#3457ff] bg-bg px-5 py-6 shadow-sm sm:px-6 dark:border-blue-400">
      <p className="border-b border-[#3457ff]/35 pb-5 text-xl font-semibold tracking-tight text-text-primary xl:text-2xl">{copy.chatTitle}</p>
      <div className="mt-6 flex items-start gap-3">
        <UserRound aria-hidden="true" className="mt-7 h-7 w-7 shrink-0 rounded-full bg-text-primary p-1.5 text-bg" />
        <div className="min-w-0"><p className="mb-2 text-sm text-text-secondary">{copy.user}</p><p className="rounded-xl bg-surface px-3 py-3 text-sm leading-6 text-text-primary xl:text-base">{copy.prompt}</p></div>
      </div>
      <div className="mb-6 mt-6 flex items-start gap-3">
        <MessageSquareText aria-hidden="true" className="mt-7 h-7 w-7 shrink-0 rounded-full bg-text-primary p-1.5 text-bg" />
        <div className="min-w-0"><p className="mb-2 text-sm text-text-secondary">{copy.assistantName}</p><p className="rounded-xl bg-surface px-3 py-3 text-sm leading-6 text-text-primary xl:text-base">{copy.answer}</p></div>
      </div>
      <p className="mt-auto flex items-center gap-3 rounded-xl border border-[#3457ff]/60 p-3 text-xs leading-5 text-text-primary dark:border-blue-400/60"><ClipboardCheck aria-hidden="true" className="h-5 w-5 shrink-0 text-[#3457ff] dark:text-blue-400" />{copy.approval}</p>
    </div>
  );
}

export function McpProjectDemo({ locale }: { locale: AppLocale }) {
  const copy = MCP_PROJECT_DEMO_COPY[locale];
  return (
    <section id="project-demo" aria-labelledby="project-demo-title" className="scroll-mt-24 border-b border-hairline bg-bg py-12 text-text-primary sm:py-16 dark:border-white/10">
      <div className="container-page max-w-[1560px]">
        <div className="mx-auto mb-10 max-w-[1400px] text-center">
          <h2 id="project-demo-title" className="font-serif text-4xl font-medium leading-[1.08] tracking-tight sm:text-5xl xl:text-[64px]">{copy.title}</h2>
          <p className="mt-5 text-base leading-7 text-text-secondary sm:text-lg">{copy.subtitle}</p>
        </div>
        <ol className="mx-auto grid max-w-[560px] gap-8 lg:max-w-none lg:grid-cols-[1fr_0.9fr_1fr] lg:gap-6">
          {copy.steps.map((step, index) => (
            <li key={step} className="flex min-w-0 flex-col">
              <h3 className="mb-5 flex items-center justify-between text-lg font-semibold xl:text-xl"><span>{`0${index + 1}`} <span aria-hidden="true">—</span> {step}</span>{index < 2 ? <ArrowRight aria-hidden="true" className="hidden h-6 w-6 text-[#3457ff] lg:block dark:text-blue-400" /> : null}</h3>
              {index === 1 ? <Conversation copy={copy} /> : <ProductWindow copy={copy} motion={index === 2} />}
              <p className="mt-4 min-h-5 text-center text-xs leading-5 text-text-secondary">{index === 0 ? copy.photoCaption : index === 2 ? copy.videoCaption : null}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10 border-t border-hairline pt-6 text-center dark:border-white/10">
          <a href="#first-video" className="inline-flex min-h-11 items-center justify-center gap-3 rounded-lg px-4 py-2 text-base font-semibold text-text-primary hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{copy.cta}<ArrowRight aria-hidden="true" className="h-4 w-4" /></a>
        </div>
      </div>
    </section>
  );
}
