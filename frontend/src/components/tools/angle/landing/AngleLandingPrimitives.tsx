import type { ReactNode } from 'react';
import Image from 'next/image';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import {
  ANGLE_HERO_OUTPUT_URL,
  ANGLE_OUTPUT_URL,
  ANGLE_SOURCE_URL,
  ANGLE_STORY_SOURCE_URL,
  ANGLE_WORKSPACE_SCREENSHOT_PATH,
  MOBILE_IMAGE_MAX_WIDTH,
  type AngleLandingContent,
} from './angle-landing-assets';

export function SectionHeader({
  eyebrow,
  title,
  body,
  light = false,
}: {
  eyebrow: string;
  title: string;
  body: ReactNode;
  light?: boolean;
}) {
  return (
    <div className="max-w-3xl stack-gap-sm">
      <p
        className={`text-[11px] font-semibold uppercase tracking-[0.24em] ${
          light ? 'text-slate-300' : 'text-text-muted'
        }`}
      >
        {eyebrow}
      </p>
      <h2
        className={`text-3xl font-semibold tracking-tight sm:text-4xl ${
          light ? 'text-white' : 'text-text-primary'
        }`}
      >
        {title}
      </h2>
      <div className={`text-sm leading-7 sm:text-base ${light ? 'text-slate-300' : 'text-text-secondary'}`}>{body}</div>
    </div>
  );
}

export function AngleThumb({
  label,
  note,
  src,
  alt,
  background,
  imageClassName = 'object-cover object-center',
}: {
  label: string;
  note: string;
  src: string;
  alt: string;
  background: string;
  imageClassName?: string;
}) {
  return (
    <div className="angle-thumb-card overflow-hidden rounded-[18px] border border-hairline bg-white">
      <div className={`relative aspect-[4/3] ${background}`}>
        <Image src={src} alt={alt} fill sizes="180px" className={imageClassName} />
      </div>
      <div className="angle-thumb-copy space-y-1 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-primary">{label}</p>
        <p className="text-xs leading-5 text-text-secondary">{note}</p>
      </div>
    </div>
  );
}

export function ProductAngleMock({
  beforeLabel,
  afterLabel,
}: {
  beforeLabel: string;
  afterLabel: string;
}) {
  return (
    <div className="angle-product-mock rounded-[22px] border border-hairline bg-[linear-gradient(180deg,#f5f8fb,#ffffff)] p-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,0.82fr)_auto_minmax(0,1fr)] sm:items-center">
        <div className="angle-product-mock__frame rounded-[18px] border border-hairline bg-white p-3">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[16px] bg-[#edf3f8]">
            <Image src={ANGLE_SOURCE_URL} alt={beforeLabel} fill sizes="280px" className="object-cover" />
          </div>
          <div className="mt-3 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">{beforeLabel}</div>
        </div>
        <ArrowRight className="mx-auto h-4 w-4 text-brand" />
        <div className="angle-product-mock__frame rounded-[18px] border border-hairline bg-white p-3">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[16px] bg-[#e8f0f8]">
            <Image src={ANGLE_OUTPUT_URL} alt={afterLabel} fill sizes="320px" className="object-cover" />
          </div>
          <div className="mt-3 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">{afterLabel}</div>
        </div>
      </div>
    </div>
  );
}

export function HeroAngleFlowPanel({ content }: { content: AngleLandingContent['hero']['panel'] }) {
  return (
    <div className="overflow-hidden rounded-[36px] border border-slate-900/12 bg-[linear-gradient(180deg,#07101b,#0d1b2d)] text-white shadow-[0_42px_140px_rgba(15,23,42,0.18)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300 sm:px-7">
        <span>{content.topLeft}</span>
        <span>{content.topRight}</span>
      </div>
      <div className="grid gap-5 p-6 sm:p-7 lg:p-8">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_180px_minmax(0,1.08fr)] lg:items-center">
          <div className={`rounded-[28px] border border-white/10 bg-white/6 p-4 ${MOBILE_IMAGE_MAX_WIDTH}`}>
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">{content.sourceLabel}</p>
            <div className="relative aspect-[5/4] overflow-hidden rounded-[22px] bg-[#dce7f3]">
              <Image
                src={ANGLE_STORY_SOURCE_URL}
                alt={content.sourceAlt}
                fill
                priority
                sizes="(max-width: 1280px) 100vw, 520px"
                className="object-cover"
              />
            </div>
          </div>
          <div className="grid gap-4 justify-items-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/6 text-white">
              <ArrowRight className="h-5 w-5" />
            </div>
            <div className="grid w-full gap-2">
              {content.controls.map((item) => (
                <div key={item.title} className="rounded-[18px] border border-white/10 bg-white/6 px-3 py-3 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white">{item.title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-300">{item.note}</p>
                </div>
              ))}
            </div>
          </div>
          <div className={`rounded-[28px] border border-white/10 bg-white/6 p-4 ${MOBILE_IMAGE_MAX_WIDTH}`}>
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">{content.outputLabel}</p>
            <div className="relative aspect-[5/4] overflow-hidden rounded-[22px] bg-[#d9e6f3]">
              <Image
                src={ANGLE_HERO_OUTPUT_URL}
                alt={content.outputAlt}
                fill
                priority
                sizes="(max-width: 1280px) 100vw, 560px"
                className="object-cover"
              />
            </div>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {content.bullets.map((item) => (
            <div key={item} className="rounded-[20px] border border-white/10 bg-[rgba(255,255,255,0.05)] px-4 py-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                <p className="text-sm leading-6 text-slate-200">{item}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function WorkspaceShowcase({ content }: { content: AngleLandingContent['workspace'] }) {
  return (
    <div className="overflow-hidden rounded-[34px] border border-slate-900/12 bg-[linear-gradient(180deg,#07101b,#0d1b2d)] text-white shadow-[0_36px_120px_rgba(15,23,42,0.16)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300 sm:px-6">
        <span>{content.topLeft}</span>
        <span>{content.topRight}</span>
      </div>
      <div className="bg-[#e9eef5] p-4 sm:p-5">
        <div className={`overflow-hidden rounded-[28px] border border-slate-300/70 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.12)] ${MOBILE_IMAGE_MAX_WIDTH}`}>
          <div className="flex items-center gap-1.5 border-b border-slate-300/70 px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-[#f97316]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#facc15]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#22c55e]" />
            <span className="ml-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{content.windowLabel}</span>
          </div>
          <div className="relative aspect-[16/9]">
            <Image
              src={ANGLE_WORKSPACE_SCREENSHOT_PATH}
              alt={content.imageAlt}
              fill
              sizes="(max-width: 1440px) 100vw, 1320px"
              className="object-cover object-top"
            />
          </div>
        </div>
      </div>
      <div className="grid gap-px bg-white/10 md:grid-cols-3">
        {content.callouts.map((item) => (
          <div key={item.title} className="bg-[rgba(7,13,21,0.92)] px-5 py-4 sm:px-6 sm:py-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{item.title}</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">{item.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
