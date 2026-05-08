import type { ReactNode } from 'react';
import Image from 'next/image';
import { CheckCircle2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import {
  CHARACTER_WORKSPACE_HERO_PATH,
  type CharacterBuilderLandingContent,
} from './character-builder-landing-assets';

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
      <div
        className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${
          light
            ? 'border-white/12 bg-white/6 text-slate-200'
            : 'border-hairline bg-surface text-text-muted shadow-[0_10px_24px_rgba(15,23,42,0.04)]'
        }`}
      >
        {eyebrow}
      </div>
      <h2 className={`text-3xl font-semibold tracking-tight sm:text-4xl ${light ? 'text-white' : 'text-text-primary'}`}>
        {title}
      </h2>
      <div className={`text-sm leading-7 sm:text-base ${light ? 'text-slate-300' : 'text-text-secondary'}`}>{body}</div>
    </div>
  );
}

export function LinkChip({
  href,
  label,
  dark = false,
}: {
  href: string;
  label: string;
  dark?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center rounded-full border px-4 py-2 text-sm font-semibold transition ${
        dark
          ? 'border-white/12 bg-white/6 text-white hover:border-white/20 hover:bg-white/10'
          : 'border-hairline bg-surface text-text-primary hover:border-border-hover hover:bg-surface-hover'
      }`}
    >
      {label}
    </Link>
  );
}

export function HeroProofCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[20px] border border-hairline/90 bg-surface/90 px-4 py-3 text-sm leading-6 text-text-primary shadow-[0_18px_42px_rgba(15,23,42,0.06)] backdrop-blur-sm">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
        <span className="text-text-secondary">{children}</span>
      </div>
    </div>
  );
}

export function HeroScreenshotPreview({ content }: { content: CharacterBuilderLandingContent['hero']['showcase'] }) {
  return (
    <div className="overflow-hidden rounded-t-[34px] rounded-b-[30px] border border-slate-900/12 bg-[linear-gradient(180deg,#07101b,#0d1b2d)] text-white shadow-[0_36px_120px_rgba(15,23,42,0.16)]">
      <div className="flex items-center justify-end gap-3 border-b border-white/10 px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300 sm:px-6">
        <span>{content.topLabel}</span>
      </div>
      <div className="bg-[#e9eef5] p-4 sm:p-5">
        <div className="overflow-hidden rounded-[28px] border border-slate-300/70 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.12)]">
          <div className="flex items-center gap-1.5 border-b border-slate-300/70 px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-[#f97316]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#facc15]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#22c55e]" />
            <span className="ml-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{content.windowLabel}</span>
          </div>
          <div className="relative aspect-[16/9] bg-[#eef3f9]">
            <Image
              src={CHARACTER_WORKSPACE_HERO_PATH}
              alt={content.imageAlt}
              fill
              priority
              sizes="(max-width: 1440px) 100vw, 1320px"
              className="object-cover object-[center_12%]"
            />
          </div>
        </div>
      </div>
      <div className="grid gap-px bg-white/10 md:grid-cols-3">
        {content.callouts.map((item) => (
          <div key={item.label} className="bg-[rgba(7,13,21,0.92)] px-5 py-4 sm:px-6 sm:py-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{item.label}</p>
            <p className="mt-2 text-base font-semibold text-white">{item.title}</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">{item.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HowItWorksPill({ children }: { children: ReactNode }) {
  return (
    <span className="character-builder-pill inline-flex items-center rounded-full border border-hairline bg-white/80 px-3 py-2 text-sm text-text-secondary shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
      {children}
    </span>
  );
}
