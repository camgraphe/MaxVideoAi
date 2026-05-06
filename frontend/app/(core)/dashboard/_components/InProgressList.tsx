import Image from 'next/image';
import { Button, ButtonLink } from '@/components/ui/Button';
import type { Job } from '@/types/jobs';
import { formatCurrencyLocal } from '../_lib/dashboard-formatters';
import { getJobCostCents, resolveWorkspaceJobHref } from '../_lib/dashboard-media';
import type { DashboardCopy } from '../_lib/dashboard-copy';
import { SectionGlyph } from './DashboardGlyphs';

const DASHBOARD_ROW_THUMB_SIZES = '(max-width: 640px) calc(100vw - 48px), 112px';

export function InProgressList({
  copy,
  jobs,
  onOpen,
}: {
  copy: DashboardCopy;
  jobs: Job[];
  onOpen: (job: Job) => void;
}) {
  if (!jobs.length) {
    return (
      <section className="overflow-hidden rounded-card border border-hairline bg-surface p-4 shadow-card sm:p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <SectionGlyph />
              <h2 className="text-lg font-semibold text-text-primary">{copy.inProgress.title}</h2>
            </div>
            <p className="mt-1 text-sm text-text-secondary">{copy.inProgress.empty}</p>
          </div>
          <InProgressVisual />
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-card border border-hairline bg-surface shadow-card">
      <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <SectionGlyph />
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-text-primary">{copy.inProgress.title}</h2>
            <p className="mt-0.5 text-sm text-text-secondary">
              {`${jobs.length} active render${jobs.length > 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        <span className="hidden items-center gap-1.5 rounded-pill border border-hairline bg-surface-2 px-2.5 py-1 text-xs font-semibold text-text-secondary sm:inline-flex">
          Live queue
        </span>
      </div>
      <div className="stack-gap-sm px-4 py-3">
        {jobs.map((job) => (
          <InProgressRow key={job.jobId} job={job} copy={copy} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}

function InProgressRow({
  job,
  copy,
  onOpen,
}: {
  job: Job;
  copy: DashboardCopy;
  onOpen: (job: Job) => void;
}) {
  const progress = typeof job.progress === 'number' ? Math.max(0, Math.min(100, Math.round(job.progress))) : 0;
  const eta = formatEta(job.etaLabel, job.etaSeconds);
  const priceCents = getJobCostCents(job);
  const price = priceCents != null ? formatCurrencyLocal(priceCents / 100, job.currency) : null;
  const prompt = job.prompt ? truncate(job.prompt, 140) : '';

  return (
    <div className="flex flex-col gap-3 rounded-input border border-hairline bg-surface-2/70 p-2.5 sm:flex-row sm:items-center">
      <div className="relative h-20 w-full overflow-hidden rounded-input border border-hairline bg-surface sm:h-16 sm:w-28">
        {job.thumbUrl ? (
          <Image src={job.thumbUrl} alt="" fill className="object-cover" sizes={DASHBOARD_ROW_THUMB_SIZES} />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-text-muted">{copy.actions.noPreview}</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-sm font-semibold text-text-primary">{job.engineLabel}</p>
            <span className="shrink-0 rounded-pill border border-[var(--brand-border)] bg-[var(--brand-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-micro text-brand">
              {job.status ?? 'running'}
            </span>
          </div>
          {price ? <span className="text-xs font-semibold text-text-primary">{price}</span> : null}
        </div>
        <p className="mt-1 truncate text-xs text-text-muted">{prompt}</p>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface">
          <div className="h-full rounded-full bg-[image:var(--brand-gradient)]" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-1 flex items-center justify-between text-xs text-text-muted">
          <span>{copy.inProgress.progressLabel}: {progress}%</span>
          <span>{copy.inProgress.etaLabel}: {eta}</span>
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onOpen(job)}
          className="border-hairline px-3 py-1.5 text-xs font-semibold text-text-secondary hover:bg-surface-2 hover:text-text-primary"
        >
          {copy.inProgress.open}
        </Button>
        <ButtonLink
          href={resolveWorkspaceJobHref(job.jobId, job.surface)}
          variant="outline"
          size="sm"
          className="border-hairline px-3 py-1.5 text-xs font-semibold text-text-secondary hover:bg-surface-2 hover:text-text-primary"
        >
          {copy.inProgress.remix}
        </ButtonLink>
      </div>
    </div>
  );
}

function InProgressVisual() {
  return (
    <div className="relative hidden h-28 w-72 shrink-0 sm:block" aria-hidden>
      <svg viewBox="0 0 360 180" className="h-full w-full overflow-visible">
        <defs>
          <linearGradient id="dashboardProgressGlow" x1="36" x2="326" y1="121" y2="129" gradientUnits="userSpaceOnUse">
            <stop stopColor="#F4F8FF" stopOpacity="0.12" />
            <stop offset="0.22" stopColor="#CADAF5" stopOpacity="0.58" />
            <stop offset="0.68" stopColor="#AFC6EC" stopOpacity="0.72" />
            <stop offset="1" stopColor="#D8E7FF" stopOpacity="0.34" />
          </linearGradient>
          <linearGradient id="dashboardProgressCard" x1="101" x2="278" y1="42" y2="142" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FBFDFF" />
            <stop offset="0.34" stopColor="#DCE7F8" />
            <stop offset="0.72" stopColor="#AFC3E4" />
            <stop offset="1" stopColor="#7895C1" />
          </linearGradient>
          <linearGradient id="dashboardProgressCardEdge" x1="99" x2="272" y1="63" y2="151" gradientUnits="userSpaceOnUse">
            <stop stopColor="#A8BFE2" stopOpacity="0.88" />
            <stop offset="1" stopColor="#506D99" stopOpacity="0.96" />
          </linearGradient>
          <linearGradient id="dashboardProgressPlay" x1="126" x2="193" y1="65" y2="111" gradientUnits="userSpaceOnUse">
            <stop stopColor="#7FA0D4" />
            <stop offset="1" stopColor="#4F6F9D" />
          </linearGradient>
          <linearGradient id="dashboardProgressImageCard" x1="253" x2="331" y1="78" y2="137" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FBFDFF" />
            <stop offset="0.56" stopColor="#DCE7F8" />
            <stop offset="1" stopColor="#AFC3E4" />
          </linearGradient>
          <linearGradient id="dashboardProgressMiniPlayer" x1="85" x2="300" y1="35" y2="119" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFFFFF" stopOpacity="0.92" />
            <stop offset="0.52" stopColor="#D7E1F3" stopOpacity="0.86" />
            <stop offset="1" stopColor="#8EA8CF" stopOpacity="0.9" />
          </linearGradient>
          <radialGradient id="dashboardProgressOrb" cx="0" cy="0" r="1" gradientTransform="matrix(27 0 0 27 77 121)" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFFFFF" stopOpacity="0.92" />
            <stop offset="0.34" stopColor="#A0B9DD" />
            <stop offset="1" stopColor="#6685B7" />
          </radialGradient>
          <filter
            id="dashboardProgressSoftShadow"
            x="24"
            y="22"
            width="314"
            height="146"
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feDropShadow dx="0" dy="14" stdDeviation="10" floodColor="#637FA8" floodOpacity="0.22" />
          </filter>
          <filter
            id="dashboardProgressTinyShadow"
            x="48"
            y="20"
            width="276"
            height="116"
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feDropShadow dx="0" dy="9" stdDeviation="7" floodColor="#637FA8" floodOpacity="0.16" />
          </filter>
          <filter
            id="dashboardProgressGlowBlur"
            x="0"
            y="88"
            width="360"
            height="86"
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>
        <ellipse cx="178" cy="132" rx="152" ry="27" fill="url(#dashboardProgressGlow)" filter="url(#dashboardProgressGlowBlur)" />
        <ellipse cx="178" cy="129" rx="136" ry="22" fill="url(#dashboardProgressGlow)" opacity="0.72" />
        <g filter="url(#dashboardProgressTinyShadow)">
          <g transform="rotate(-16 130 70)" opacity="0.42">
            <rect x="82" y="42" width="105" height="62" rx="16" fill="url(#dashboardProgressMiniPlayer)" stroke="#8FACD7" strokeOpacity="0.24" strokeWidth="2" />
            <rect x="97" y="58" width="36" height="24" rx="7" fill="#6686BD" opacity="0.72" />
            <path d="M112 64v12l11-6Z" fill="#FFFFFF" opacity="0.88" />
            <path d="M143 64h26" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" opacity="0.52" />
            <path d="M100 91h67" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" opacity="0.7" />
            <path d="M100 91h35" stroke="#4F6E9B" strokeWidth="4" strokeLinecap="round" opacity="0.74" />
          </g>
          <g transform="rotate(10 250 61)" opacity="0.5">
            <rect x="198" y="36" width="112" height="64" rx="17" fill="url(#dashboardProgressMiniPlayer)" stroke="#8FACD7" strokeOpacity="0.28" strokeWidth="2" />
            <rect x="214" y="52" width="39" height="26" rx="7" fill="#6686BD" opacity="0.74" />
            <path d="M230 58v13l12-6.5Z" fill="#FFFFFF" opacity="0.9" />
            <path d="M263 58h28" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" opacity="0.52" />
            <path d="M217 88h70" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" opacity="0.72" />
            <path d="M217 88h42" stroke="#4F6E9B" strokeWidth="4" strokeLinecap="round" opacity="0.78" />
          </g>
          <g transform="rotate(-2 199 44)" opacity="0.34">
            <rect x="146" y="23" width="104" height="54" rx="15" fill="url(#dashboardProgressMiniPlayer)" stroke="#8FACD7" strokeOpacity="0.2" strokeWidth="2" />
            <rect x="160" y="37" width="34" height="22" rx="7" fill="#6686BD" opacity="0.62" />
            <path d="M174 42v11l10-5.5Z" fill="#FFFFFF" opacity="0.86" />
            <path d="M202 43h27" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" opacity="0.48" />
            <path d="M162 67h59" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" opacity="0.62" />
            <path d="M162 67h31" stroke="#4F6E9B" strokeWidth="3.5" strokeLinecap="round" opacity="0.7" />
          </g>
        </g>
        <circle cx="77" cy="121" r="25" fill="url(#dashboardProgressOrb)" opacity="0.95" />
        <circle cx="69" cy="112" r="7" fill="#FFFFFF" opacity="0.55" />
        <g filter="url(#dashboardProgressSoftShadow)" transform="rotate(-7 186 91)">
          <rect x="105" y="50" width="173" height="94" rx="23" fill="url(#dashboardProgressCardEdge)" />
          <path
            d="M119 42h139c12 0 22 10 22 22v57c0 12-10 22-22 22H119c-12 0-22-10-22-22V64c0-12 10-22 22-22Z"
            fill="url(#dashboardProgressCard)"
            stroke="#8FACD7"
            strokeOpacity="0.42"
            strokeWidth="2.4"
          />
          <path
            d="M123 48h128c11 0 20 9 20 20v7c-38 8-102 9-164-2v-5c0-11 6-20 16-20Z"
            fill="#FFFFFF"
            opacity="0.22"
          />
          <rect
            x="126"
            y="66"
            width="66"
            height="45"
            rx="10"
            fill="url(#dashboardProgressPlay)"
            stroke="#FFFFFF"
            strokeOpacity="0.76"
            strokeWidth="2"
          />
          <path d="M152 78v21l20-10.5Z" fill="#FFFFFF" opacity="0.94" />
          <path d="M130 122h96" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" opacity="0.92" />
          <path d="M130 122h58" stroke="#4F6E9B" strokeWidth="6" strokeLinecap="round" opacity="0.9" />
          <path d="M199 122h21" stroke="#4F6E9B" strokeWidth="6" strokeLinecap="round" opacity="0.42" />
          <path d="M205 86h38" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" opacity="0.7" />
          <path d="M207 99h28" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" opacity="0.46" />
          <circle cx="232" cy="68" r="5.4" fill="#FFFFFF" opacity="0.74" />
          <circle cx="252" cy="70" r="4.4" fill="#D8E7FF" opacity="0.8" />
          <circle cx="242" cy="79" r="3" fill="#FFFFFF" opacity="0.46" />
        </g>
        <g filter="url(#dashboardProgressSoftShadow)" transform="rotate(4 292 105)">
          <rect
            x="253"
            y="79"
            width="78"
            height="59"
            rx="13"
            fill="url(#dashboardProgressImageCard)"
            stroke="#8FACD7"
            strokeOpacity="0.36"
            strokeWidth="2"
          />
          <path d="M265 125l23-26 18 21 10-11 7 16Z" fill="#B6C9E9" opacity="0.92" />
          <path d="M268 125l20-22 15 17 8-8 10 13Z" fill="#FFFFFF" opacity="0.34" />
          <circle cx="272" cy="92" r="5.5" fill="#FFFFFF" opacity="0.9" />
          <path
            d="m312 88 5 3 5-3-3 5 3 5-5-3-5 3 3-5Z"
            fill="#FFFFFF"
            opacity="0.9"
          />
        </g>
        <circle cx="49" cy="105" r="2.7" fill="var(--brand)" opacity="0.68" />
        <path d="M57 99h10M62 94v10" stroke="#C4D4EF" strokeWidth="2.1" strokeLinecap="round" opacity="0.72" />
        <circle cx="291" cy="50" r="2.2" fill="#FFFFFF" opacity="0.64" />
        <circle cx="306" cy="47" r="1.7" fill="var(--brand)" opacity="0.5" />
        <path
          d="M329 104c8 1 13 5 14 12 1 7-3 13-9 16-7 3-14 0-17-6-4-8 2-17 12-22Z"
          fill="#D5E5FF"
          opacity="0.78"
        />
        <path
          d="M330 108c5 1 9 4 9 9s-3 9-8 11c-5 1-10-1-12-6-2-6 3-12 11-14Z"
          fill="#FFFFFF"
          opacity="0.45"
        />
      </svg>
    </div>
  );
}

function formatEta(label?: string | null, seconds?: number | null): string {
  if (label && label.trim().length) return label;
  if (typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0) {
    if (seconds >= 60) {
      return `${Math.round(seconds / 60)}m`;
    }
    return `${Math.round(seconds)}s`;
  }
  return '—';
}

function truncate(value: string, limit: number): string {
  if (value.length <= limit) return value;
  const slice = value.slice(0, limit - 1).trimEnd();
  return `${slice}…`;
}
