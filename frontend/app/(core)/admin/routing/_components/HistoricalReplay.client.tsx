'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, CirclePause, CirclePlay, History, RotateCw } from 'lucide-react';
import type { HistoricalReplayReport } from '../_lib/historical-replay-types';
import { dollars } from '../_lib/route-playback';
import { ReplayProfile, type ReplayPath } from './ReplayProfile.client';
import { ReplayBreakdown } from './ReplayBreakdown';
import s from './HistoricalReplay.module.css';

type ReplayResponse = {
  report: HistoricalReplayReport;
  source: 'archive' | 'database';
  startDay: string;
  endDay: string;
  capturedAt: string;
  engineOptions: string[];
  statusOptions: string[];
};

const pageSize = 50;
const number = new Intl.NumberFormat('en-US');
const madridTime = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Madrid',
});
const replayTime = (value: string) => madridTime.format(new Date(value));
const dayBefore = (exclusive: string) => {
  const day = new Date(exclusive + 'T00:00:00Z');
  day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0,10);
};

function ProfileTimeline({ total, position, onSeek, onPause }: {
  total: number; position: number; onSeek: (position: number) => void; onPause: () => void;
}) {
  const dragging = useRef(false);
  const [preview, setPreview] = useState<number | null>(null);
  const index = preview ?? total - position;
  return <div className={s.timeline}><span>Oldest</span><input type="range" aria-label="Historical profile timeline"
    aria-valuetext={`Profile ${index} of ${total}`} min={1} max={total} value={index} disabled={total <= 1}
    onPointerDown={event => {
      dragging.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      onPause();
    }}
    onChange={event => {
      const value = Number(event.currentTarget.value);
      if (dragging.current) setPreview(value);
      else onSeek(total - value);
    }}
    onPointerUp={event => {
      dragging.current = false;
      setPreview(null);
      onSeek(total - Number(event.currentTarget.value));
    }}
    onPointerCancel={() => { dragging.current = false; setPreview(null); }} />
    <span>Latest</span><output>{number.format(index)} / {number.format(total)}</output></div>;
}

export function HistoricalReplay({ labels, compact, motion, visible, initialEngine }: {
  initialEngine?: string; labels: Map<string, string>; compact: boolean; motion: boolean; visible: boolean;
}) {
  const [engine, setEngine] = useState(initialEngine ?? '');
  const [date, setDate] = useState('');
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('default');
  const [tariff, setTariff] = useState('list');
  const [path, setPath] = useState<ReplayPath>('all');
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [revision, reload] = useState(0);
  const [data, setData] = useState<{key: string; value: ReplayResponse} | null>(null);
  const [error, setError] = useState<{key: string; denied: boolean} | null>(null);
  const offset = Math.floor(position / pageSize) * pageSize;
  const query = useMemo(() => {
    const params = new URLSearchParams({ offset: String(offset), limit: String(pageSize), source, tariff });
    if (engine) params.set('engine', engine);
    if (date) params.set('date', date);
    if (status) params.set('status', status);
    return params.toString();
  }, [offset, source, tariff, engine, date, status]);
  const requestKey = query + '#' + revision;
  const result = data?.key === requestKey ? data.value : null;
  const failure = error?.key === requestKey ? error : null;
  const report = result?.report;
  const trace = report?.traces[position - offset];

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;
    const deadline = setTimeout(() => controller.abort(), 30_000);
    async function load() {
      try {
        const response = await fetch('/api/admin/routing/replay?' + query, { cache: 'no-store', signal: controller.signal });
        if (!mounted) return;
        if (!response.ok) {
          const denied = response.status === 401 || response.status === 403;
          if (denied) setData(null);
          setError({ key: requestKey, denied });
          setPlaying(false);
          return;
        }
        const value: ReplayResponse = await response.json();
        if (!mounted) return;
        setData({ key: requestKey, value });
        setError(null);
        if (value.report.totalProfiles > 0) setPosition(current => Math.min(current, value.report.totalProfiles - 1));
      } catch {
        if (mounted) {
          setError({ key: requestKey, denied: false });
          setPlaying(false);
        }
      } finally {
        clearTimeout(deadline);
      }
    }
    const scheduled = setTimeout(() => void load(), 0);
    return () => {
      mounted = false;
      clearTimeout(scheduled);
      clearTimeout(deadline);
      controller.abort();
    };
  }, [query, requestKey]);

  useEffect(() => {
    if (!playing || !visible || !trace) return;
    const timer = setTimeout(() => {
      if (position === 0) setPlaying(false);
      else setPosition(position - 1);
    }, 2300);
    return () => clearTimeout(timer);
  }, [playing, visible, trace, position]);

  function changeFilter(update: (value: string) => void, value: string) {
    setPlaying(false);
    setPosition(0);
    update(value);
  }
  function move(index: number) {
    setPlaying(false);
    setPosition(index);
  }
  function togglePlay() {
    if (!report) return;
    if (!playing && position === 0) setPosition(Math.max(0, report.totalProfiles - 1));
    setPlaying(!playing);
  }
  const options = data?.value;
  const totals = report?.totals;
  const totalProfiles = report?.totalProfiles ?? 0;
  const period = result ? result.startDay + ' — ' + dayBefore(result.endDay) : '';
  const readableEngine = (id: string) => labels.get(id) ?? id;
  return <div className={s.replay} role="region" aria-label="Historical routing replay">
    <div className={s.filters}>
      <label>Engine<select aria-label="Engine" value={engine} onChange={event => changeFilter(setEngine, event.target.value)}>
        <option value="">All engines</option>{(options?.engineOptions ?? []).map(id => <option key={id} value={id}>{readableEngine(id)}</option>)}
      </select></label>
      <label>Job status<select aria-label="Job status" value={status} onChange={event => changeFilter(setStatus, event.target.value)}>
        <option value="">All statuses</option>{(options?.statusOptions ?? []).map(id => <option key={id} value={id}>{id}</option>)}
      </select></label>
      <label>Madrid day<input aria-label="Madrid day" type="date" value={date} min={options?.startDay} max={options && dayBefore(options.endDay)}
        onChange={event => changeFilter(setDate, event.target.value)} /></label>
      <label>Data source<select aria-label="Data source" value={source} onChange={event => changeFilter(setSource, event.target.value)}>
        <option value="default">Default cohort</option><option value="database">Environment database</option>
      </select></label>
      <label>Wan Standard pricing<select aria-label="Wan Standard pricing" value={tariff} onChange={event => changeFilter(setTariff, event.target.value)}>
        <option value="list">Published list</option><option value="alibaba-discount">Alibaba −30% scenario</option>
      </select></label>
    </div>
    {failure ? <div role="status" className={s.message}><History/>
      <strong>{failure.denied ? 'Admin access is required to view the replay.' : 'Historical replay is unavailable.'}</strong>
      <button type="button" onClick={() => reload(n => n+1)}><RotateCw size={14}/>Retry</button>
    </div> : !report || !result ? <div role="status" className={s.message}><History/><strong>Loading historical profiles…</strong></div> : <>
      <div className={s.provenance}><CalendarDays size={15}/>
        <strong>{result.source === 'archive' ? 'Anonymized production archive' : 'Environment database'}</strong>
        <span>{period} · Europe/Madrid</span><span>Captured {replayTime(result.capturedAt)}</span>
      </div>
      {totals && <div className={s.metrics} aria-label="Replay totals">
        <div><span>Jobs in cohort</span><strong>{number.format(totals.jobs)}</strong><small>{number.format(totals.completedPaidJobs)} completed and paid · {number.format(totals.comparableJobs)} comparable</small></div>
        <div><span>Historical owner estimate</span><strong>{dollars(totals.historicalMicros)}</strong><small>{report.alibabaStandardDiscount ? 'Alibaba −30% scenario' : 'Published rates'} · comparable jobs</small></div>
        <div><span>Installed routing</span><strong>{dollars(totals.installedMicros)}</strong><small>Estimated saving {dollars(totals.installedSavingsMicros)}</small></div>
        <div><span>With candidate suppliers</span><strong>{dollars(totals.allMicros)}</strong><small>Additional saving {dollars(totals.additionalSavingsMicros)}</small></div>
      </div>}
      {trace ? <>
        <div className={s.transport}>
          <div><div className={s.eyebrow}>Profile timeline</div><strong>{trace.bucketAt ? replayTime(trace.bucketAt) + ' Madrid · hourly group' : 'Unspecified time'}</strong></div>
          <div className={s.transportActions}>
            <button type="button" aria-label="Previous historical profile (older)" disabled={position >= totalProfiles-1}
              onClick={() => move(position + 1)}><ChevronLeft size={16}/></button>
            <button type="button" aria-label={playing ? 'Pause historical replay' : 'Play historical replay'} disabled={totalProfiles < 2}
              onClick={togglePlay}>{playing ? <CirclePause size={15}/> : <CirclePlay size={15}/>} {playing ? 'Pause' : 'Play'}</button>
            <button type="button" aria-label="Next historical profile (newer)" disabled={position === 0}
              onClick={() => move(position - 1)}><ChevronRight size={16}/></button>
          </div>
        </div>
        <ProfileTimeline total={totalProfiles} position={position} onSeek={move} onPause={() => setPlaying(false)}/>
        <ReplayProfile key={requestKey + '/' + position} trace={trace} path={path} onPath={setPath} coverage={report.coverage} labels={labels}
          compact={compact} animate={motion && visible} onEngine={value => changeFilter(setEngine, value === engine ? '' : value)}/>
      </> : <div className={s.message}><History/><strong>No historical profiles match these filters.</strong></div>}
      <ReplayBreakdown report={report} labels={labels} onEngine={value => changeFilter(setEngine, value === engine ? '' : value)}/>
    </>}
  </div>;
}
