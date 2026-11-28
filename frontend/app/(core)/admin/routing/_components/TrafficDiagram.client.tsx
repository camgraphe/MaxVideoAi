'use client';

import { useId, type CSSProperties } from 'react';
import { Box, Layers3, Route } from 'lucide-react';
import type { MapNode, MapTone } from '../_lib/traffic-map-model';
import layout from './TrafficMap.module.css';
import s from './TrafficDiagram.module.css';

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

const familyColors: [RegExp, string][] = [
  [/^wan-|^alibaba/, '#8fa7ff'],
  [/seedance|byteplus/, '#eaa0bc'],
  [/minimax|hailuo/, '#7cd3b9'],
  [/kling/, '#efac7e'],
  [/apimart/, '#d1a4fe'],
  [/wavespeed/, '#6fcedf'],
  [/^fal$/, '#efd483'],
  [/luma/, '#a4d498'],
  [/veo|vertex|gemini/, '#9bbce9'],
];
const familyColor = (key: string) => familyColors.find(([pattern]) => pattern.test(key))?.[1] ?? '#aec9cb';
const statusLabel: Record<MapTone, string> = {
  idle: 'In map', candidate: 'In plan', active: 'Selected', success: 'Confirmed',
  fallback: 'Fallback', failure: 'Failed', warning: 'Uncertain',
};
const panelHeight = 49;

function Wire({ path, tone = 'idle', pulse, tail }: { path: string; tone?: MapTone; pulse: boolean; tail: string }) {
  const active = tone !== 'idle' && tone !== 'candidate';
  return <g data-tone={tone} aria-hidden="true">
    {active && <path className={s.halo} d={path}/>}
    <path className={s.cable} d={path}/>
    {pulse && [0, 1, 2, 3].map(i => <g key={i} className={s.packet}
      style={{offsetPath: 'path("' + path + '")', '--lag': (i * 0.075).toFixed(3)} as CSSProperties}>
      <path d={`M -${29-i*4} 0 H 0`} stroke={`url(#${tail})`} strokeWidth={i ? 1.6 : 3.5} strokeLinecap="round"/>
      <circle r={i ? 4 : 7} fill="currentColor" opacity=".14"/>
      <circle r={i ? 1.8 : 3.4} fill="currentColor"/><circle r={i ? .7 : 1.4} fill="#fff"/>
    </g>)}
  </g>;
}

function NodePanel({ node, x, y, width, engine, selected, onClick }: {
  node: MapNode; x: number; y: number; width: number; engine?: boolean; selected: boolean; onClick: () => void;
}) {
  const tone = node.tone ?? 'idle';
  const Icon = engine ? Layers3 : Box;
  const recorded = node.detail?.endsWith(' record') || node.detail?.endsWith(' records');
  const state = node.stateLabel ?? (node.standby ? 'Standby' : recorded && tone === 'candidate' ? 'Recorded' : statusLabel[tone]);
  const value = node.detail && !node.standby ? node.detail : engine ? node.id : '';
  // Long labels can occur on historical engines. Preserve the complete label inside its panel.
  const textWidth = width - 36;
  const fitLongLabel = node.label.length * 7.4 > textWidth;
  return <g transform={`translate(${x} ${y})`} role="button" tabIndex={0}
    aria-label={(engine ? 'Show engine ' : 'Inspect provider ') + node.label} aria-pressed={selected}
    data-tone={tone} style={{'--family':familyColor(node.id)} as CSSProperties} className={s.panel}
    onClick={onClick} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}>
    <title>{[node.label, value, state].filter(Boolean).join(' · ')}</title>
    <rect className={s.panelFrame} width={width} height={panelHeight} rx="5"/>
    <path className={s.cap} d={`M 5 .5 H ${width-5} Q ${width-.5} .5 ${width-.5} 5 V 22 H .5 V 5 Q .5 .5 5 .5 Z`}/>
    <g className={s.icon} transform="translate(8 4.5)"><Icon width="13" height="13" strokeWidth="1.8"/></g>
    <text className={s.name} x="28" y="15.5" textLength={fitLongLabel ? textWidth : undefined}
      lengthAdjust={fitLongLabel ? 'spacingAndGlyphs' : undefined}>{node.label}</text>
    <circle className={node.standby ? s.standby : s.light} cx="12" cy="35.5" r="2.9"/>
    <text className={s.state} x="21" y="39">{state}</text>
    {value && <text className={s.value} x={width-8} y="39" textAnchor="end"
      textLength={value.length * 5.8 > width-80 ? width-80 : undefined} lengthAdjust="spacingAndGlyphs">{value}</text>}
  </g>;
}

function Hub({ x, y, width, active, target, tone, dim }: {
  x: number; y: number; width: number; active?: MapNode; target?: MapNode; tone: MapTone; dim: string;
}) {
  const half = width/2;
  return <g transform={`translate(${x} ${y})`} data-tone={tone} aria-hidden="true" className={s.station}>
    <ellipse rx={half+42} ry="102" fill={`url(#${dim})`}/>
    <rect className={s.outerFrame} x={-half-5} y="-64" width={width+10} height="128" rx="9"/>
    <rect className={s.stationFace} x={-half} y="-59" width={width} height="118" rx="7"/>
    <path className={s.stationCap} d={`M ${-half+7} -59 H ${half-7} Q ${half} -59 ${half} -52 V -37 H ${-half} V -52 Q ${-half} -59 ${-half+7} -59 Z`}/>
    <g transform={`translate(${-half+10} -55)`}><Route width="14" height="14" strokeWidth="2"/></g>
    <text className={s.stationKicker} x={-half+31} y="-44">ROUTE CONTROL</text>
    <g className={s.stationDots}>{[0,1,2].map(i=><circle key={i} cx={half-13-i*6} cy="-48" r="1.5"/>)}</g>
    <text className={s.stationTitle} textAnchor="middle" y="-8">Purchase router</text>
    <path className={s.stationRule} d={`M ${-half+11} 4 h${width-22}`}/>
    <text className={s.stationLabel} x={-half+11} y="23">ENGINE</text>
    <text className={s.stationValue} x={half-11} y="23" textAnchor="end"
      textLength={(active?.label.length ?? 0) * 6 > width-76 ? width-76 : undefined}
      lengthAdjust="spacingAndGlyphs">{active?.label ?? '—'}</text>
    <text className={s.stationLabel} x={-half+11} y="43">PROVIDER</text>
    <text className={s.stationValue} x={half-11} y="43" textAnchor="end"
      textLength={(target?.label.length ?? 0) * 6 > width-76 ? width-76 : undefined}
      lengthAdjust="spacingAndGlyphs">{target?.label ?? '—'}</text>
  </g>;
}

export function TrafficDiagram({ engines, providers, activeEngine, activeProvider, previousProvider, focusedProvider, activityKey, animate, compact, onEngine, onProvider }: Props) {
  const svgId = useId().replace(/:/g,'');
  const glow = svgId+'-glow', trail = svgId+'-trail', grid = svgId+'-grid';
  const w = compact ? 444 : 1040;
  const h = compact ? 281 + Math.ceil(providers.length/2)*61 : Math.max(387, Math.max(engines.length,providers.length)*60+48);
  const hx = w/2, hy = compact ? 155 : h/2+5;
  const hubW = compact ? 212 : 220;
  const tileW = compact ? 194 : 237;
  const leftX = compact ? hx-tileW/2 : 35, rightX = w-35-tileW;
  const active = engines.find(n=>n.id===activeEngine), target = providers.find(n=>n.id===activeProvider);
  const shownEngines = compact ? active ? [active] : engines.slice(0,1) : engines;
  const rowY = (i:number, count:number) => hy-(count-1)*30-panelHeight/2+i*60;
  const portY = (i:number,count:number) => hy+(i-(count-1)/2)*Math.min(8,78/Math.max(1,count-1));
  const incoming = shownEngines.map((node,i)=>{
    const y = compact ? 11 : rowY(i,shownEngines.length), py = portY(i,shownEngines.length), endX=hx-hubW/2-6;
    const path = compact ? `M ${hx} ${y+panelHeight} V ${hy-64}` :
      `M ${leftX+tileW} ${y+34} h14 C ${leftX+tileW+77} ${y+34} ${endX-65} ${py} ${endX-18} ${py} H ${endX}`;
    return {node,x:leftX,y,path,py};
  });
  const outgoing = providers.map((node,i)=>{
    const x = compact ? i%2===0 ? 15 : w-15-tileW : rightX;
    const y = compact ? 263+Math.floor(i/2)*61 : rowY(i,providers.length);
    const py = portY(i,providers.length), startX = hx+hubW/2+6;
    const side = i%2===0 ? -1 : 1;
    const path = compact ? `M ${hx+side*(hubW/2+6)} ${hy} C ${hx+side*(hubW/2+46)} ${hy+32} ${hx-side*18} ${y+34} ${x+(i%2===0?tileW:0)} ${y+34}` :
      `M ${startX} ${py} h18 C ${startX+65} ${py} ${x-77} ${y+34} ${x-14} ${y+34} H ${x}`;
    return {node,x,y,path,py};
  });
  const previous = outgoing.find(p=>p.node.id===previousProvider), current = outgoing.find(p=>p.node.id===activeProvider);
  let handoff: string | undefined;
  if (previous && current && previous !== current) {
    const fromLeft = compact && previous.x<hx, toLeft = compact && current.x<hx;
    const fromX = previous.x+(fromLeft?0:tileW), toX=current.x+(toLeft?0:tileW);
    const fromY = previous.y+34, toY=current.y+34;
    if (fromLeft===toLeft) {
      const gutter = fromX+(fromLeft?-12:compact?12:22);
      handoff=`M ${fromX} ${fromY} C ${gutter} ${fromY} ${gutter} ${fromY} ${gutter} ${(fromY+toY)/2} S ${gutter} ${toY} ${toX} ${toY}`;
    } else {
      const lane = Math.max(previous.y,current.y)+54;
      handoff=`M ${previous.x+tileW/2} ${previous.y+panelHeight} V ${lane} H ${current.x+tileW/2} V ${current.y+panelHeight}`;
    }
  }
  return <svg className={layout.svg+' '+s.board} viewBox={`0 0 ${w} ${h}`} aria-label="Routing network diagram" role="group">
    <defs>
      <radialGradient id={glow}><stop offset="0%" stopColor="#d653a4" stopOpacity=".29"/><stop offset="100%" stopColor="#955198" stopOpacity="0"/></radialGradient>
      <linearGradient id={trail} x1="-30" y1="0" x2="0" y2="0" gradientUnits="userSpaceOnUse">
        <stop stopColor="currentColor" stopOpacity="0"/><stop offset=".45" stopColor="currentColor" stopOpacity=".53"/><stop offset="1" stopColor="#f9ffff"/>
      </linearGradient>
      <pattern id={grid} width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0 H0 V48" fill="none" stroke="#b0b7df" strokeOpacity=".065"/></pattern>
    </defs>
    <rect width={w} height={h} fill={`url(#${grid})`} aria-hidden="true"/>
    {!compact && <g className={s.lanes} aria-hidden="true">
      <text x={leftX} y="21">ENGINES</text><text x={hx} y="21" textAnchor="middle">DECISION</text><text x={rightX} y="21">PROVIDERS</text>
      <path d={`M ${leftX+61} 17 h${tileW-61} M ${rightX+75} 17 h${tileW-75} M ${hx-139} 34 V ${h-10} M ${hx+139} 34 V ${h-10}`}/>
    </g>}
    {incoming.map(({node,path})=><Wire key={node.id+activityKey} path={path} tone={node.id===activeEngine?'active':'idle'} pulse={node.id===activeEngine&&animate} tail={trail}/>)}
    {outgoing.map(({node,path})=><Wire key={node.id+activityKey} path={path} tone={node.tone} pulse={node.id===activeProvider&&animate} tail={trail}/>)}
    {handoff && <g className={s.handoff}><Wire key={activityKey} path={handoff} tone="fallback" pulse={animate} tail={trail}/></g>}
    <Hub x={hx} y={hy} width={hubW} active={active} target={target} tone={target?.tone ?? 'active'} dim={glow}/>
    {!compact && <g aria-hidden="true">
      {incoming.map(({node,py})=><circle key={node.id} data-tone={node.id===activeEngine?'active':'idle'} className={s.port} cx={hx-hubW/2-6} cy={py} r="2.5"/>)}
      {outgoing.map(({node,py})=><circle key={node.id} data-tone={node.tone??'idle'} className={s.port} cx={hx+hubW/2+6} cy={py} r="2.5"/>)}
    </g>}
    {compact && <text x="15" y="247" className={s.caption}>PROVIDERS</text>}
    {incoming.map(({node,x,y})=><NodePanel key={node.id} node={{...node,tone:node.id===activeEngine?'active':'idle'}} engine x={x} y={y} width={tileW} selected={node.id===activeEngine} onClick={()=>onEngine(node.id)}/>)}
    {outgoing.map(({node,x,y})=><NodePanel key={node.id} node={node} x={x} y={y} width={tileW} selected={focusedProvider===node.id} onClick={()=>onProvider(node.id)}/>)}
  </svg>;
}
