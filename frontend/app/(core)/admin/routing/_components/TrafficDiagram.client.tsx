'use client';

import { useId, type CSSProperties } from 'react';
import { Boxes, Layers3, Waypoints } from 'lucide-react';
import type { MapNode, MapTone } from '../_lib/traffic-map-model';
import s from './TrafficMap.module.css';

type Props = {
  engines: MapNode[];
  providers: MapNode[];
  activeEngine: string;
  activeProvider?: string;
  previousProvider?: string;
  focusedProvider: string;
  activityKey: string;
  animate: boolean;
  compact: boolean;
  onEngine: (id: string) => void;
  onProvider: (id: string) => void;
};

const beamTone = (tone?: MapTone) => tone && tone !== 'idle' && tone !== 'candidate' ? tone : undefined;

function Wire({ path, tone = 'idle', pulse }: { path: string; tone?: MapTone; pulse: boolean }) {
  return (
    <g data-tone={tone} aria-hidden="true">
      {beamTone(tone) && <path className={s.bloom} d={path} />}
      <path className={s.wire} d={path} />
      {pulse && <g style={{ offsetPath: 'path("' + path + '")' } as CSSProperties} className={s.packet}>
        <circle r="8" fill="currentColor" opacity=".18" /><circle r="3.5" fill="currentColor" /><circle r="1.4" fill="#f4fffa" />
      </g>}
    </g>
  );
}

function Socket({ node, x, y, width, type, selected, onClick }: {
  node: MapNode; x: number; y: number; width: number; type: 'engine' | 'provider'; selected: boolean; onClick: () => void;
}) {
  const Glyph = type === 'provider' ? Boxes : Layers3;
  const maxLabel = Math.max(8, Math.floor((width - 47) / 7.4));
  const name = node.label.length > maxLabel ? node.label.slice(0, maxLabel - 1) + '…' : node.label;
  return (
    <g transform={`translate(${x} ${y})`} role="button" tabIndex={0}
      aria-label={(type === 'engine' ? 'Show engine ' : 'Inspect provider ') + node.label}
      aria-pressed={selected} className={s.socket} data-tone={node.tone ?? 'idle'}
      onClick={onClick} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}>
      <title>{[node.label, node.detail].filter(Boolean).join(' · ')}</title>
      <rect className={s.node} width={width} height="35" rx="7" />
      <g transform="translate(10 10)"><Glyph width="15" height="15" strokeWidth="1.5" /></g>
      <text className={s.nodeText} x="34" y={node.detail ? 14 : 22}>{name}</text>
      {node.detail && <text className={s.nodeSub} x="34" y="27">{node.detail}</text>}
      {node.standby
        ? <path className={s.standbyMark} d={`M ${width-15} 14 v7 m4 -7 v7`} />
        : <circle cx={width-10} cy="17.5" r="2.1" fill="currentColor" />}
    </g>
  );
}

function RouterHub({ x, y, tone, grid }: { x: number; y: number; tone: MapTone; grid: string }) {
  return (
    <g transform={`translate(${x} ${y})`} data-tone={tone} aria-hidden="true">
      <circle fill={`url(#${grid})`} r="74" />
      <circle className={s.guideRing} r="56" /><circle className={s.outerRing} r="48" />
      <circle className={s.dial} r="43" strokeDasharray="1 6.5" />
      <circle className={s.hub} r="35" /><circle className={s.innerRing} r="30" />
      <g transform="translate(-13 -13)"><Waypoints width="26" height="26" strokeWidth="1.8" /></g>
      <circle r="2.8" cx="-48" fill="currentColor" /><circle r="2.8" cx="48" fill="currentColor" />
      <text className={s.hubName} textAnchor="middle" y="76">Purchase router</text>
    </g>
  );
}

export function TrafficDiagram({ engines, providers, activeEngine, activeProvider, previousProvider, focusedProvider, activityKey, animate, compact, onEngine, onProvider }: Props) {
  const glow = useId().replace(/:/g, '');
  const w = compact ? 430 : 1000;
  const h = compact ? 244 + Math.ceil(providers.length / 2) * 49 : Math.max(357, Math.max(engines.length, providers.length) * 43 + 62);
  const hx = w / 2, hy = compact ? 130 : h / 2 - 8;
  const tileW = compact ? 176 : 198;
  const leftX = compact ? hx - tileW / 2 : 38;
  const rightX = w - tileW - 38;
  const active = engines.find(n => n.id === activeEngine);
  const shownEngines = compact ? active ? [active] : engines.slice(0, 1) : engines;
  const rowY = (i: number, count: number) => (h - (count - 1) * 43) / 2 + i * 43 - 3;
  const incoming = shownEngines.map((node, i) => {
    const x = leftX, y = compact ? 19 : rowY(i, shownEngines.length) - 17;
    const path = compact ? `M ${hx} ${y+35} V ${hy-48}`
      : `M ${x+tileW} ${y+17} C ${x+tileW+98} ${y+17} ${hx-104} ${hy} ${hx-48} ${hy}`;
    return { node, x, y, path };
  });
  const outgoing = providers.map((node, i) => {
    const x = compact ? i % 2 === 0 ? 22 : w - tileW - 22 : rightX;
    const y = compact ? 241 + Math.floor(i/2)*49 : rowY(i, providers.length)-17;
    const funnel = i % 2 === 0 ? 1 : -1;
    const path = compact
      ? `M ${hx-48*funnel} ${hy} C ${hx-70*funnel} ${hy+13} ${hx-2*funnel} ${y+17} ${x+(i%2===0?tileW:0)} ${y+17}`
      : `M ${hx+48} ${hy} C ${hx+121} ${hy} ${x-95} ${y+17} ${x} ${y+17}`;
    return { node, x, y, path };
  });
  const previous = outgoing.find(p => p.node.id === previousProvider);
  const current = outgoing.find(p => p.node.id === activeProvider);
  let handoff: string | undefined;
  if (previous && current && previous !== current) {
    const fromLeft = compact && previous.x < hx, toLeft = compact && current.x < hx;
    const fromX = previous.x + (fromLeft ? 0 : tileW), toX = current.x + (toLeft ? 0 : tileW);
    const fromY = previous.y + 17, toY = current.y + 17;
    if (fromLeft === toLeft) {
      const gutter = fromX + (fromLeft ? -18 : 22);
      handoff = `M ${fromX} ${fromY} C ${gutter} ${fromY} ${gutter} ${fromY} ${gutter} ${(fromY+toY)/2} S ${gutter} ${toY} ${toX} ${toY}`;
    } else {
      const sourceX = previous.x + tileW/2, targetX = current.x + tileW/2;
      const laneY = Math.max(previous.y, current.y) + 42;
      handoff = `M ${sourceX} ${previous.y+35} V ${laneY} H ${targetX} V ${current.y+35}`;
    }
  }
  const hubTone = providers.find(p => p.id === activeProvider)?.tone;
  return (
    <svg className={s.svg} viewBox={`0 0 ${w} ${h}`} aria-label="Routing network diagram" role="group">
      <defs>
        <radialGradient id={glow}><stop offset="0%" stopColor="#4cc7cd" stopOpacity=".23" /><stop offset="100%" stopColor="#4cc7cd" stopOpacity="0" /></radialGradient>
      </defs>
      {!compact && <g className={s.lanes} aria-hidden="true">
        <text x={leftX} y="23">ENGINES</text><text x={hx} y="23" textAnchor="middle">DECISION</text><text x={rightX} y="23">PROVIDERS</text>
        <path d={`M ${leftX+70} 19 h125 M ${rightX+92} 19 h102`} />
      </g>}
      {incoming.map(({node, path}) => <Wire key={node.id+activityKey} path={path} tone={node.id === activeEngine ? 'active' : 'idle'} pulse={node.id === activeEngine && animate} />)}
      {outgoing.map(({node,path}) => <Wire key={node.id+activityKey} path={path} tone={node.tone} pulse={node.id === activeProvider && animate} />)}
      {handoff && <g className={s.handoff}><Wire key={activityKey} path={handoff} tone="fallback" pulse={animate} /></g>}
      <RouterHub x={hx} y={hy} grid={glow} tone={beamTone(hubTone) ?? (activeEngine ? 'active' : 'idle')} />
      {compact && <text x="22" y="224" className={s.laneCaption}>PROVIDERS</text>}
      {incoming.map(({node,x,y}) => <Socket key={node.id} node={{...node, tone: node.id === activeEngine ? 'active' : 'idle'}}
        x={x} y={y} width={tileW} type="engine" selected={node.id === activeEngine} onClick={() => onEngine(node.id)} />)}
      {outgoing.map(({node,x,y}) => <Socket key={node.id} node={node} x={x} y={y} width={tileW} type="provider"
        selected={focusedProvider === node.id} onClick={() => onProvider(node.id)} />)}
    </svg>
  );
}
