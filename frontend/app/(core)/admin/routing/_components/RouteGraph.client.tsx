'use client';

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import {
  Aperture,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleSlash,
  Clock3,
  Film,
  GitFork,
  Pause,
  Play,
  Repeat2,
  RotateCcw,
  X,
} from 'lucide-react';
import { PROVIDER_LABELS, type PurchaseDecision } from '@/lib/video-purchase-decision';
import type { RoutingScenario } from '../_lib/routing-scenarios';
import { dollars, type Frame } from '../_lib/route-playback';
import s from './routing.module.css';

const statusLabel = {
  queued: 'Ready',
  sending: 'Sending',
  refused: 'Balance refused',
  accepted: 'Accepted',
  uncertain: 'Response lost',
  invalid: 'Invalid request',
  excluded: 'Excluded',
};
const outcomeTone = {
  intake: 'cyan',
  empty: 'amber',
  sending: 'violet',
  accepted: 'green',
  refused: 'red',
  uncertain: 'amber',
  invalid: 'red',
} as const;
const glyph = {
  queued: Aperture,
  sending: ArrowUpRight,
  accepted: Check,
  refused: X,
  uncertain: Clock3,
  invalid: X,
  excluded: CircleSlash,
};
const pos = (x: number, y: number): CSSProperties => ({ left: x, top: y });
function Wire({ d, tone, active }: { d: string; tone: string; active: boolean }) {
  return (
    <g data-tone={tone}>
      <path d={d} className={s.wire} />
      {active && (
        <g className={s.pulse} style={{ offsetPath: 'path("' + d + '")' }}>
          <circle r="8" fill="currentColor" opacity=".18" />
          <circle r="4" fill="currentColor" />
          <circle r="1.7" fill="white" />
        </g>
      )}
    </g>
  );
}

export function RouteGraph({
  scenario,
  decision,
  frames,
}: {
  scenario: RoutingScenario;
  decision: PurchaseDecision;
  frames: Frame[];
}) {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [loop, setLoop] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  const last = frames.length - 1;
  const frame = frames[step];
  const atEnd = step === last;
  const finished = atEnd && !(loop && playing);
  const latest = new Map(frames.slice(0, step + 1).map((event) => [event.provider, event]));

  useLayoutEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    function respectMotion() {
      if (query.matches) {
        setLoop(false);
        setPlaying(false);
        setStep(last);
      }
    }
    respectMotion();
    query.addEventListener('change', respectMotion);
    return () => query.removeEventListener('change', respectMotion);
  }, [last]);
  useEffect(() => {
    if (!playing || finished) return;
    const delay = atEnd ? 1700 : frame.kind === 'refused' ? 1350 : 1020;
    const timer = window.setTimeout(() => setStep(atEnd ? 0 : step + 1), delay);
    return () => window.clearTimeout(timer);
  }, [playing, finished, atEnd, step, frame.kind]);

  const byProvider = new Map(decision.candidates.map(row => [row.provider, row]));
  const ordered = [
    ...decision.order.map(provider => byProvider.get(provider)!),
    ...decision.candidates.filter(row => row.excluded),
  ];
  const count = ordered.length;
  const compact = width < 610;
  const height = Math.max(compact ? 294 : 272, count * (compact ? 88 : 78) + 30);
  const yMid = height / 2;
  const requestX = width * (compact ? 0.18 : 0.125);
  const hubX = compact ? requestX : width * 0.405;
  const hubY = compact ? height * 0.68 : yMid;
  const requestY = compact ? 46 : yMid;
  const cardX = width * (compact ? 0.405 : 0.632);
  const cardWidth = width * (compact ? 0.565 : 0.322);
  const requestPath = compact
    ? `M ${requestX} ${requestY + 52} V ${hubY - 31}`
    : `M ${requestX + 25} ${requestY} H ${hubX - 39}`;
  function play() {
    if (finished) {
      setStep(0);
      setPlaying(true);
    } else setPlaying(!playing);
  }
  const ControlIcon = finished ? RotateCcw : playing ? Pause : Play;
  return (
    <div className={s.playback} data-paused={!playing || atEnd} aria-label="Routing playback">
      <div className={s.map} ref={viewport} data-compact={compact} style={{ height }}>
        <svg className={s.wires} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
          <Wire d={requestPath} tone="cyan" active={frame.kind === 'intake'} />
          {ordered.map((row, i) => {
            const endY = ((i + 0.5) * height) / count;
            const startX = hubX + (compact ? 30 : 39);
            const middleX = startX + (cardX - startX) * 0.57;
            const d = `M ${startX} ${hubY} C ${middleX} ${hubY}, ${middleX} ${endY}, ${cardX} ${endY}`;
            const event = latest.get(row.provider);
            return (
              <Wire
                key={row.provider}
                d={d}
                tone={event ? outcomeTone[event.kind] : 'idle'}
                active={event?.kind === 'sending'}
              />
            );
          })}
        </svg>
        <div className={s.station} style={pos(requestX, requestY)} data-tone="cyan">
          <div className={s.source}>
            <Film aria-hidden="true" size={21} />
          </div>
          <span className={s.stationLabel}>{scenario.engineLabel}</span>
        </div>
        <div className={s.station} style={pos(hubX, hubY)} data-tone="violet">
          <div className={s.hub}>
            <GitFork size={29} aria-hidden="true" />
          </div>
          <span className={s.stationLabel}>Purchase router</span>
        </div>
        {ordered.map((row, i) => {
          const event = latest.get(row.provider);
          const status =
            event?.kind === 'intake' || event?.kind === 'empty' || !event
              ? row.excluded
                ? 'excluded'
                : 'queued'
              : event.kind;
          const Icon = glyph[status];
          const rank = decision.order.indexOf(row.provider);
          return (
            <div
              key={row.provider}
              className={s.offer}
              data-tone={event ? outcomeTone[event.kind] : 'idle'}
              data-status={status}
              style={{ ...pos(cardX, ((i + 0.5) * height) / count), width: cardWidth }}
              title={row.excluded ?? row.tariff}
            >
              <span className={s.port} aria-hidden="true" />
              <span className={s.offerGlyph}>
                <Icon size={17} aria-hidden="true" />
              </span>
              <div className={s.offerBody}>
                <strong>{PROVIDER_LABELS[row.provider]}</strong>
                <span className={s.offerMeta}>
                  <b>{row.costMicros === null ? '—' : dollars(row.costMicros)}</b>
                  <span>·</span>
                  {status === 'queued'
                    ? rank === 0
                      ? 'First choice'
                      : 'Fallback ' + rank
                    : (row.excluded ?? statusLabel[status])}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div className={s.transport}>
        <div className={s.readout} data-tone={outcomeTone[frame.kind]} aria-live="polite" aria-atomic="true">
          <span className={s.signal} aria-hidden="true" />
          <div>
            <strong>{frame.title}</strong>
            <p>{frame.detail}</p>
          </div>
        </div>
        <div className={s.controls}>
          <button
            aria-label="Previous step"
            disabled={!step}
            onClick={() => {
              setPlaying(false);
              setStep(step - 1);
            }}
          >
            <ChevronLeft size={16} />
          </button>
          <span className={s.counter} aria-label="Playback step">
            {step + 1} / {frames.length}
          </span>
          <button
            aria-label="Next step"
            disabled={atEnd}
            onClick={() => {
              setPlaying(false);
              setStep(step + 1);
            }}
          >
            <ChevronRight size={16} />
          </button>
          <button
            aria-label="Loop playback"
            title="Loop playback"
            aria-pressed={loop}
            onClick={() => {
              setLoop(!loop);
              if (!loop && atEnd) {
                setStep(0);
                setPlaying(true);
              }
            }}
          >
            <Repeat2 size={15} />
          </button>
          <button className={s.play} onClick={play}>
            <ControlIcon size={14} />
            {finished ? 'Replay' : playing ? 'Pause' : 'Play'}
          </button>
        </div>
      </div>
      <span className="sr-only">
        {scenario.label} · {scenario.settings}
      </span>
    </div>
  );
}
